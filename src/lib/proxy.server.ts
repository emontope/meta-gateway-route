import { globMatch, joinUrl, sha256Hex } from "./server-helpers";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}

function err(status: number, message: string) {
  return Response.json({ error: { message, type: "toperouter_error" } }, { status, headers: CORS });
}

type Gw = { id: string; name: string; slug: string; base_url: string; api_key: string; last_latency_ms: number | null };

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.startsWith("tr-")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", await sha256Hex(token))
    .eq("revoked", false)
    .maybeSingle();
  if (!data) return null;
  return { admin: supabaseAdmin, keyId: data.id, userId: data.user_id };
}

export async function handleModels(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return err(401, "Invalid or missing Toperouter API key");
  const { data: gws } = await auth.admin
    .from("gateways")
    .select("slug, base_url, api_key")
    .eq("user_id", auth.userId)
    .eq("enabled", true);
  const results = await Promise.all(
    (gws ?? []).map(async (g) => {
      try {
        const r = await fetch(joinUrl(g.base_url, "models"), { headers: { Authorization: `Bearer ${g.api_key}` } });
        if (!r.ok) return [];
        const j = (await r.json()) as { data?: { id: string }[] } | { id: string }[];
        const arr = Array.isArray(j) ? j : (j.data ?? []);
        return arr.map((m) => ({ id: `${g.slug}/${m.id}`, object: "model", owned_by: g.slug }));
      } catch {
        return [];
      }
    }),
  );
  return Response.json({ object: "list", data: results.flat() }, { headers: CORS });
}

export async function handleChat(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return err(401, "Invalid or missing Toperouter API key");
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return err(400, "Body must be JSON");
  }
  const model = typeof body.model === "string" ? body.model : "";
  if (!model) return err(400, "`model` is required");

  const { admin, userId, keyId } = auth;
  const { data: gwRows } = await admin
    .from("gateways")
    .select("id, name, slug, base_url, api_key, last_latency_ms")
    .eq("user_id", userId)
    .eq("enabled", true);
  const gws = (gwRows ?? []) as Gw[];
  if (!gws.length) return err(503, "No enabled upstream gateways. Add one in the Toperouter dashboard.");

  // Build ordered candidate list: explicit slug prefix > routing rules > all gateways by latency.
  const candidates: { gw: Gw; upstreamModel: string }[] = [];
  const slash = model.indexOf("/");
  const prefixed = slash > 0 ? gws.find((g) => g.slug === model.slice(0, slash)) : undefined;
  if (prefixed) {
    candidates.push({ gw: prefixed, upstreamModel: model.slice(slash + 1) });
  } else {
    const { data: rules } = await admin
      .from("routing_rules")
      .select("model_pattern, gateway_id, upstream_model, priority")
      .eq("user_id", userId)
      .order("priority", { ascending: true });
    for (const r of rules ?? []) {
      if (!globMatch(r.model_pattern, model)) continue;
      const gw = gws.find((g) => g.id === r.gateway_id);
      if (gw) candidates.push({ gw, upstreamModel: r.upstream_model || model });
    }
    if (!candidates.length) {
      [...gws]
        .sort((a, b) => (a.last_latency_ms ?? 1e9) - (b.last_latency_ms ?? 1e9))
        .forEach((gw) => candidates.push({ gw, upstreamModel: model }));
    }
  }

  const stream = body.stream === true;
  let lastErr = "";
  let lastStatus = 502;
  for (const { gw, upstreamModel } of candidates) {
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(joinUrl(gw.base_url, "chat/completions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${gw.api_key}` },
        body: JSON.stringify({ ...body, model: upstreamModel }),
        signal: request.signal,
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await log(admin, { userId, keyId, gw, model, upstreamModel, status: 0, latency: Date.now() - t0, stream, error: lastErr });
      continue;
    }
    const latency = Date.now() - t0;
    if (res.status === 429 || res.status >= 500) {
      lastStatus = res.status;
      lastErr = (await res.text()).slice(0, 300);
      await log(admin, { userId, keyId, gw, model, upstreamModel, status: res.status, latency, stream, error: lastErr });
      continue; // fall through to next gateway
    }
    const headers = new Headers(CORS);
    headers.set("Content-Type", res.headers.get("content-type") ?? "application/json");
    headers.set("X-Toperouter-Gateway", gw.slug);
    headers.set("X-Toperouter-Upstream-Model", upstreamModel);
    if (stream && res.ok && res.body) {
      headers.set("Cache-Control", "no-cache, no-transform");
      await log(admin, { userId, keyId, gw, model, upstreamModel, status: res.status, latency, stream });
      return new Response(res.body, { status: res.status, headers });
    }
    const text = await res.text();
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    try {
      usage = (JSON.parse(text) as { usage?: typeof usage }).usage;
    } catch {
      /* non-JSON */
    }
    await log(admin, {
      userId, keyId, gw, model, upstreamModel, status: res.status, latency, stream,
      promptTokens: usage?.prompt_tokens, completionTokens: usage?.completion_tokens,
      error: res.ok ? undefined : text.slice(0, 300),
    });
    return new Response(text, { status: res.status, headers });
  }
  return err(lastStatus, `All upstream gateways failed. Last error: ${lastErr || "unknown"}`);
}

type Admin = NonNullable<Awaited<ReturnType<typeof authenticate>>>["admin"];

async function log(
  admin: Admin,
  e: {
    userId: string; keyId: string; gw: Gw; model: string; upstreamModel: string; status: number;
    latency: number; stream: boolean; promptTokens?: number; completionTokens?: number; error?: string;
  },
) {
  await Promise.all([
    admin.from("usage_logs").insert({
      user_id: e.userId,
      api_key_id: e.keyId,
      gateway_id: e.gw.id,
      gateway_name: e.gw.name,
      model: e.model,
      upstream_model: e.upstreamModel,
      status: e.status,
      latency_ms: e.latency,
      stream: e.stream,
      prompt_tokens: e.promptTokens ?? null,
      completion_tokens: e.completionTokens ?? null,
      error: e.error ?? null,
    }),
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", e.keyId),
  ]);
}
