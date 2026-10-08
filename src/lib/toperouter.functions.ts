import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { joinUrl, randomToken, sha256Hex, slugify } from "./server-helpers";

type GatewayInput = { name: string; provider: string; baseUrl: string; apiKey: string };

export const createGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: GatewayInput) => {
    if (!d.name?.trim() || !d.apiKey?.trim()) throw new Error("Name and API key are required");
    if (!/^https:\/\//.test(d.baseUrl)) throw new Error("Base URL must start with https://");
    return { ...d, name: d.name.trim().slice(0, 60), apiKey: d.apiKey.trim(), baseUrl: d.baseUrl.trim() };
  })
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("gateways")
      .insert({
        user_id: context.userId,
        name: data.name,
        slug: slugify(data.name),
        provider: data.provider,
        base_url: data.baseUrl,
        api_key: data.apiKey,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.code === "23505" ? "A gateway with that name already exists" : error.message);
    return { id: row.id };
  });

export const testGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    // Ownership check through RLS before touching the secret key.
    const { data: own } = await context.supabase.from("gateways").select("id").eq("id", data.id).maybeSingle();
    if (!own) throw new Error("Gateway not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: gw } = await supabaseAdmin.from("gateways").select("base_url, api_key").eq("id", data.id).single();
    if (!gw) throw new Error("Gateway not found");

    const t0 = Date.now();
    let status = "error";
    let count: number | null = null;
    let err: string | null = null;
    try {
      const res = await fetch(joinUrl(gw.base_url, "models"), {
        headers: { Authorization: `Bearer ${gw.api_key}` },
      });
      if (res.ok) {
        const j = (await res.json()) as { data?: unknown[] } | unknown[];
        count = Array.isArray(j) ? j.length : Array.isArray(j.data) ? j.data.length : 0;
        status = "ok";
      } else {
        err = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      }
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    const latency = Date.now() - t0;
    await supabaseAdmin
      .from("gateways")
      .update({
        last_status: status,
        last_latency_ms: latency,
        last_model_count: count,
        last_error: err,
        last_tested_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { status, latency, count, error: err };
  });

export const listGatewayModels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase.from("gateways").select("id").eq("id", data.id).maybeSingle();
    if (!own) throw new Error("Gateway not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: gw } = await supabaseAdmin.from("gateways").select("base_url, api_key").eq("id", data.id).single();
    if (!gw) throw new Error("Gateway not found");
    const res = await fetch(joinUrl(gw.base_url, "models"), { headers: { Authorization: `Bearer ${gw.api_key}` } });
    if (!res.ok) throw new Error(`Upstream returned HTTP ${res.status}`);
    const j = (await res.json()) as { data?: { id: string }[] } | { id: string }[];
    const arr = Array.isArray(j) ? j : (j.data ?? []);
    return arr.map((m) => m.id).filter(Boolean).sort();
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => ({ name: (d.name || "default").trim().slice(0, 60) }))
  .handler(async ({ data, context }) => {
    const key = `tr-${randomToken(24)}`;
    const { error } = await context.supabase.from("api_keys").insert({
      user_id: context.userId,
      name: data.name,
      key_hash: await sha256Hex(key),
      key_prefix: key.slice(0, 10),
    });
    if (error) throw new Error(error.message);
    return { key };
  });
