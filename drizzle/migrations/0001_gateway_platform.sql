-- Gateways become platform-owned (admin managed)
ALTER TABLE public.gateways ALTER COLUMN user_id DROP NOT NULL;
DROP POLICY IF EXISTS "own gateways delete" ON public.gateways;
DROP POLICY IF EXISTS "own gateways insert" ON public.gateways;
DROP POLICY IF EXISTS "own gateways select" ON public.gateways;
DROP POLICY IF EXISTS "own gateways update" ON public.gateways;
REVOKE ALL ON public.gateways FROM authenticated, anon;
ALTER TABLE public.gateways DROP CONSTRAINT IF EXISTS gateways_user_id_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS gateways_slug_uidx ON public.gateways(slug);
DROP POLICY IF EXISTS "own rules all" ON public.routing_rules;
REVOKE ALL ON public.routing_rules FROM authenticated, anon;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id bigint UNIQUE,
  telegram_username text,
  display_name text,
  token_balance bigint NOT NULL DEFAULT 1000000,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE TABLE public.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  display_name text NOT NULL,
  gateway_id uuid NOT NULL REFERENCES public.gateways(id) ON DELETE CASCADE,
  upstream_model text NOT NULL,
  is_free boolean NOT NULL DEFAULT false,
  input_rate numeric NOT NULL DEFAULT 1,
  output_rate numeric NOT NULL DEFAULT 1,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX models_slug_idx ON public.models(slug, priority);
GRANT SELECT (id, slug, display_name, is_free, input_rate, output_rate, enabled) ON public.models TO authenticated, anon;
GRANT ALL ON public.models TO service_role;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enabled models public" ON public.models FOR SELECT TO authenticated, anon USING (enabled);

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public settings" ON public.app_settings FOR SELECT TO authenticated, anon USING (key IN ('payments','links'));
INSERT INTO public.app_settings(key, value) VALUES
 ('payments', '{"bkash":"","binance_pay_id":"","wallets":[],"instructions":""}'),
 ('links', '{"channel":"","group":""}');

CREATE TABLE public.redeem_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  tokens bigint NOT NULL CHECK (tokens > 0),
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.redeem_codes TO service_role;
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.redeem_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tokens bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);
GRANT SELECT ON public.redemptions TO authenticated;
GRANT ALL ON public.redemptions TO service_role;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own redemptions" ON public.redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method text NOT NULL,
  amount text NOT NULL,
  tx_ref text NOT NULL,
  tokens_requested bigint,
  tokens_granted bigint,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT ON public.topup_requests TO authenticated;
GRANT ALL ON public.topup_requests TO service_role;
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own topups" ON public.topup_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.login_sessions (
  code text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  user_id uuid,
  telegram_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
GRANT ALL ON public.login_sessions TO service_role;
ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_sessions TO service_role;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_login_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_login_attempts TO service_role;
GRANT USAGE ON SEQUENCE public.admin_login_attempts_id_seq TO service_role;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS cost_tokens bigint NOT NULL DEFAULT 0;

-- Atomic balance helpers (service role only)
CREATE OR REPLACE FUNCTION public.charge_tokens(_uid uuid, _amount bigint)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET token_balance = GREATEST(0, token_balance - GREATEST(_amount,0))
  WHERE id = _uid RETURNING token_balance;
$$;
CREATE OR REPLACE FUNCTION public.adjust_tokens(_uid uuid, _delta bigint)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET token_balance = GREATEST(0, token_balance + _delta)
  WHERE id = _uid RETURNING token_balance;
$$;
CREATE OR REPLACE FUNCTION public.redeem_code(_uid uuid, _code text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.redeem_codes;
BEGIN
  SELECT * INTO c FROM public.redeem_codes WHERE code = upper(trim(_code)) FOR UPDATE;
  IF c.id IS NULL OR NOT c.active OR (c.expires_at IS NOT NULL AND c.expires_at < now()) OR c.uses >= c.max_uses THEN
    RAISE EXCEPTION 'Code is invalid, expired or fully used';
  END IF;
  IF EXISTS (SELECT 1 FROM public.redemptions WHERE code_id = c.id AND user_id = _uid) THEN
    RAISE EXCEPTION 'You already redeemed this code';
  END IF;
  INSERT INTO public.redemptions(code_id, user_id, tokens) VALUES (c.id, _uid, c.tokens);
  UPDATE public.redeem_codes SET uses = uses + 1 WHERE id = c.id;
  UPDATE public.profiles SET token_balance = token_balance + c.tokens WHERE id = _uid;
  RETURN c.tokens;
END $$;
REVOKE ALL ON FUNCTION public.charge_tokens(uuid,bigint), public.adjust_tokens(uuid,bigint), public.redeem_code(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_tokens(uuid,bigint), public.adjust_tokens(uuid,bigint), public.redeem_code(uuid,text) TO service_role;

-- Profiles for every new user (and existing ones)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, telegram_id, telegram_username, display_name)
  VALUES (NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'telegram_id','')::bigint,
    NEW.raw_user_meta_data->>'telegram_username',
    NEW.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO public.profiles(id, display_name) SELECT id, email FROM auth.users ON CONFLICT DO NOTHING;