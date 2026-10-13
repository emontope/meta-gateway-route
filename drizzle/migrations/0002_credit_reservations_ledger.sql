-- Ledger of every balance change
CREATE TABLE public.balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  admin_identity text,
  kind text NOT NULL,
  amount bigint NOT NULL,
  reason text NOT NULL,
  balance_before bigint NOT NULL,
  balance_after bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT balance_tx_reason_len CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
  CONSTRAINT balance_tx_math CHECK (balance_after = balance_before + amount AND balance_after >= 0)
);
CREATE INDEX balance_tx_user_idx ON public.balance_transactions(user_id, created_at DESC);
CREATE INDEX balance_tx_created_idx ON public.balance_transactions(created_at DESC);
GRANT SELECT ON public.balance_transactions TO authenticated;
GRANT ALL ON public.balance_transactions TO service_role;
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions read" ON public.balance_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Credit holds taken before upstream inference
CREATE TABLE public.credit_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  charged bigint,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','settled','released')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);
CREATE INDEX credit_res_open_idx ON public.credit_reservations(user_id, created_at) WHERE status = 'reserved';
GRANT ALL ON public.credit_reservations TO service_role;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;

-- Admin action audit trail
CREATE TABLE public.admin_audit_log (
  id bigserial PRIMARY KEY,
  admin_identity text NOT NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT USAGE ON SEQUENCE public.admin_audit_log_id_seq TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._ledger_apply(_uid uuid, _amount bigint, _kind text, _reason text, _admin text, _reference text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b bigint;
BEGIN
  SELECT token_balance INTO b FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002'; END IF;
  IF b + _amount < 0 THEN RAISE EXCEPTION 'Balance underflow' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.profiles SET token_balance = b + _amount WHERE id = _uid;
  INSERT INTO public.balance_transactions(reference, user_id, admin_identity, kind, amount, reason, balance_before, balance_after)
  VALUES (_reference, _uid, _admin, _kind, _amount, _reason, b, b + _amount);
  RETURN b + _amount;
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_uid uuid, _amount bigint, _reason text, _admin text, _reference text)
RETURNS TABLE(new_balance bigint, is_duplicate boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ex public.balance_transactions;
BEGIN
  IF _amount IS NULL OR _amount = 0 OR abs(_amount) > 1000000000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _reason IS NULL OR char_length(btrim(_reason)) < 3 OR char_length(_reason) > 500 THEN RAISE EXCEPTION 'Reason is required (3-500 characters)'; END IF;
  IF _admin IS NULL OR btrim(_admin) = '' THEN RAISE EXCEPTION 'Admin identity required'; END IF;
  IF _reference IS NULL OR _reference !~ '^[A-Za-z0-9:_-]{8,100}$' THEN RAISE EXCEPTION 'Invalid reference'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_reference));
  SELECT * INTO ex FROM public.balance_transactions WHERE reference = _reference;
  IF ex.id IS NOT NULL THEN
    IF ex.user_id <> _uid OR ex.amount <> _amount THEN RAISE EXCEPTION 'Reference already used for a different adjustment'; END IF;
    RETURN QUERY SELECT ex.balance_after, true; RETURN;
  END IF;
  RETURN QUERY SELECT public._ledger_apply(_uid, _amount, 'admin_adjustment', btrim(_reason), _admin, _reference), false;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_credits(_uid uuid, _amount bigint, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b bigint; blk boolean; rid uuid;
BEGIN
  IF _amount IS NULL OR _amount < 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT token_balance, blocked INTO b, blk FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF b IS NULL OR blk THEN RETURN NULL; END IF;
  IF b <= 0 OR b < _amount THEN RETURN NULL; END IF;
  rid := gen_random_uuid();
  INSERT INTO public.credit_reservations(id, user_id, amount, note) VALUES (rid, _uid, _amount, _note);
  IF _amount > 0 THEN
    UPDATE public.profiles SET token_balance = b - _amount WHERE id = _uid;
    INSERT INTO public.balance_transactions(reference, user_id, kind, amount, reason, balance_before, balance_after)
    VALUES ('hold:' || rid, _uid, 'usage_hold', -_amount, 'Credit hold for API request', b, b - _amount);
  END IF;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.settle_credits(_rid uuid, _actual bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.credit_reservations; b bigint; delta bigint; v_charged bigint;
BEGIN
  SELECT * INTO r FROM public.credit_reservations WHERE id = _rid FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'reserved' THEN RETURN NULL; END IF;
  SELECT token_balance INTO b FROM public.profiles WHERE id = r.user_id FOR UPDATE;
  _actual := GREATEST(COALESCE(_actual, 0), 0);
  delta := r.amount - _actual;
  IF delta < 0 THEN delta := GREATEST(delta, -b); END IF;
  v_charged := r.amount - delta;
  UPDATE public.credit_reservations SET status = 'settled', charged = v_charged, finalized_at = now() WHERE id = _rid;
  IF delta <> 0 THEN
    UPDATE public.profiles SET token_balance = b + delta WHERE id = r.user_id;
    INSERT INTO public.balance_transactions(reference, user_id, kind, amount, reason, balance_before, balance_after)
    VALUES ('settle:' || _rid, r.user_id, CASE WHEN delta > 0 THEN 'usage_refund' ELSE 'usage_overage' END, delta,
            'Settlement: actual ' || _actual || ' of hold ' || r.amount, b, b + delta);
  END IF;
  RETURN v_charged;
END $$;

CREATE OR REPLACE FUNCTION public.release_credits(_rid uuid, _reason text DEFAULT 'Released')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.credit_reservations; b bigint;
BEGIN
  SELECT * INTO r FROM public.credit_reservations WHERE id = _rid FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'reserved' THEN RETURN false; END IF;
  UPDATE public.credit_reservations SET status = 'released', charged = 0, finalized_at = now(), note = COALESCE(note,'') || ' | ' || left(COALESCE(_reason,''), 200) WHERE id = _rid;
  IF r.amount > 0 THEN
    SELECT token_balance INTO b FROM public.profiles WHERE id = r.user_id FOR UPDATE;
    UPDATE public.profiles SET token_balance = b + r.amount WHERE id = r.user_id;
    INSERT INTO public.balance_transactions(reference, user_id, kind, amount, reason, balance_before, balance_after)
    VALUES ('release:' || _rid, r.user_id, 'usage_release', r.amount, left('Hold released: ' || COALESCE(_reason,''), 500), b, b + r.amount);
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.release_stale_credits(_older_than interval DEFAULT interval '15 minutes')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; n integer := 0;
BEGIN
  FOR rid IN SELECT id FROM public.credit_reservations WHERE status = 'reserved' AND created_at < now() - _older_than LIMIT 500 LOOP
    IF public.release_credits(rid, 'stale hold auto-release') THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.approve_topup(_id uuid, _tokens bigint, _note text, _admin text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.topup_requests;
BEGIN
  IF _tokens IS NULL OR _tokens <= 0 OR _tokens > 1000000000000 THEN RAISE EXCEPTION 'Invalid token amount'; END IF;
  SELECT * INTO t FROM public.topup_requests WHERE id = _id FOR UPDATE;
  IF t.id IS NULL OR t.status <> 'pending' THEN RAISE EXCEPTION 'Request was already reviewed'; END IF;
  UPDATE public.topup_requests SET status = 'approved', tokens_granted = _tokens, admin_note = NULLIF(_note,''), reviewed_at = now() WHERE id = _id;
  RETURN public._ledger_apply(t.user_id, _tokens, 'topup', left('Top-up approved (' || t.method || ' ' || t.amount || ')', 500), _admin, 'topup:' || _id);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_code(_uid uuid, _code text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.redeem_codes; rid uuid;
BEGIN
  SELECT * INTO c FROM public.redeem_codes WHERE code = upper(trim(_code)) FOR UPDATE;
  IF c.id IS NULL OR NOT c.active OR (c.expires_at IS NOT NULL AND c.expires_at < now()) OR c.uses >= c.max_uses THEN
    RAISE EXCEPTION 'Code is invalid, expired or fully used';
  END IF;
  IF EXISTS (SELECT 1 FROM public.redemptions WHERE code_id = c.id AND user_id = _uid) THEN
    RAISE EXCEPTION 'You already redeemed this code';
  END IF;
  INSERT INTO public.redemptions(code_id, user_id, tokens) VALUES (c.id, _uid, c.tokens) RETURNING id INTO rid;
  UPDATE public.redeem_codes SET uses = uses + 1 WHERE id = c.id;
  PERFORM public._ledger_apply(_uid, c.tokens, 'redeem', left('Redeemed code ' || c.code, 500), NULL, 'redeem:' || rid);
  RETURN c.tokens;
END $$;

REVOKE ALL ON FUNCTION public._ledger_apply(uuid,bigint,text,text,text,text), public.admin_adjust_balance(uuid,bigint,text,text,text),
  public.reserve_credits(uuid,bigint,text), public.settle_credits(uuid,bigint), public.release_credits(uuid,text),
  public.release_stale_credits(interval), public.approve_topup(uuid,bigint,text,text), public.redeem_code(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid,bigint,text,text,text), public.reserve_credits(uuid,bigint,text),
  public.settle_credits(uuid,bigint), public.release_credits(uuid,text), public.release_stale_credits(interval),
  public.approve_topup(uuid,bigint,text,text), public.redeem_code(uuid,text) TO service_role;

-- charge_tokens/adjust_tokens stay executable until the new code is published (the live app still calls them).
COMMENT ON FUNCTION public.charge_tokens(uuid,bigint) IS 'DEPRECATED: replaced by reserve_credits/settle_credits';
COMMENT ON FUNCTION public.adjust_tokens(uuid,bigint) IS 'DEPRECATED: replaced by admin_adjust_balance';