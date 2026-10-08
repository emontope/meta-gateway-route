CREATE TABLE public.gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  provider text NOT NULL,
  base_url text NOT NULL,
  api_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_status text,
  last_latency_ms integer,
  last_model_count integer,
  last_error text,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT (id,user_id,name,slug,provider,base_url,enabled,last_status,last_latency_ms,last_model_count,last_error,last_tested_at,created_at) ON public.gateways TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gateways TO authenticated;
GRANT ALL ON public.gateways TO service_role;
ALTER TABLE public.gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gateways select" ON public.gateways FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own gateways insert" ON public.gateways FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own gateways update" ON public.gateways FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own gateways delete" ON public.gateways FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own keys all" ON public.api_keys FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_pattern text NOT NULL,
  gateway_id uuid NOT NULL REFERENCES public.gateways(id) ON DELETE CASCADE,
  upstream_model text,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routing_rules TO authenticated;
GRANT ALL ON public.routing_rules TO service_role;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rules all" ON public.routing_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  api_key_id uuid,
  gateway_id uuid,
  gateway_name text,
  model text,
  upstream_model text,
  status integer,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  stream boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_logs_user_created ON public.usage_logs (user_id, created_at DESC);
GRANT SELECT, DELETE ON public.usage_logs TO authenticated;
GRANT ALL ON public.usage_logs TO service_role;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs select" ON public.usage_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own logs delete" ON public.usage_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);