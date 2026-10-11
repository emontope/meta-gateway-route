import { joinUrl, sha256Hex } from "./server-helpers";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Toperouter-Gateway, X-Toperouter-Upstream-Model, X-Toperouter-Balance",
};

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}

function err(status: number, message: string, code = "toperouter_error") {
  return Response.json({ error: { message, type: code } }, { status, headers: CORS });
}

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.startsWith("tr-") || token.length > 100) return null;
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
type Admin = NonNullable<Awaited<ReturnType<typeof authenticate>>>["admin"];

export async function handleModels(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return err(401, "Invalid or missing Toperouter API key");
  const { data } = await auth.admin.from("models").select("slug, display_name, is_free, input_rate, output_rate, gateways!inner(enabled)").eq("enabled", true).eq("gateways.enabled", true);
  const seen = new Set<string>();
  const list = (data ?? []).filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true))).map((m) => ({
    id: m.slug, object: "model", owned_by: "toperouter", name: m.display_name,
    pricing: { free: m.is_free, input_tokens_per_token: Number(m.input_rate), output_tokens_per_token: Number(m.output_rate) },
  }));
  return Response.json({ object: "list", data: list }, { headers: CORS });
}

type Candidate = { modelId: string; upstream: string; isFree: boolean; inRate: number; outRate: number; gw: { id: string; name: string; slug: string; base_url: string; api_key: string } };

function cost(c: Candidate, p: number, o: number) {
  if (c.isFree) return 0;
  return Math.ceil(p * c.inRate + o * c.outRate);
}

export async function handleChat(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return err(401, "Invalid or missing Toperouter API key");
  const { admin, userId, keyId } = auth;

  const { data: prof } = await admin.from("profiles").select("token_balance, blocked").eq("id", userId).maybeSingle();
  if (!prof) return err(403, "Account not found");
  if (prof.blocked) return err(403, "Account suspended", "account_blocked");
  if (prof.token_balance <= 0) return err(402, "Token balance is 0. Top up or redeem a code to continue.", "insufficient_balance");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return err(400, "Body must be JSON");
  }
  const model = typeof body["model"] === "string" ? body["model"] : "";
  if (!model) return err(400, "`model` is required");

  const { data: rows } = await admin
    .from("models")
    .select("id, upstream_model, is_free, input_rate, output_rate, priority, gateways!inner(id, name, slug, base_url, api_key, enabled, last_latency_ms)")
    .eq("slug", model)
    .eq("enabled", true)
    .eq("gateways.enabled", true)
    .order("priority", { ascending: true });
  const candidates: Candidate[] = (rows ?? []).map((r) => {
    const g = r.gateways as unknown as Candidate["gw"];
    return { modelId: r.id, upstream: r.upstream_model, isFree: r.is_free, inRate: Number(r.input_rate), outRate: Number(r.output_rate), gw: g };
  });
  if (!candidates.length) return err(404, `Model '${model}' is not available. GET /models lists available models.`, "model_not_found");

  const stream = body["stream"] === true;
  let lastErr = "";
  let lastStatus = 502;
  for (const c of candidates) {
    const t0 = Date.now();
    const upstreamBody = { ...body, model: c.upstream, ...(stream ? { stream_options: { include_usage: true } } : {}) };
    let res: Response;
    try {
      res = await fetch(joinUrl(c.gw.base_url, "chat/completions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.gw.api_key}` },
        body: JSON.stringify(upstreamBody),
        signal: request.signal,
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await log(admin, { userId, keyId, c, model, status: 0, latency: Date.now() - t0, stream, error: lastErr });
      continue;
    }
    const latency = Date.now() - t0;
    if (res.status === 429 || res.status >= 500) {
      lastStatus = res.status;
      lastErr = (await res.text()).slice(0, 300);
      await log(admin, { userId, keyId, c, model, status: res.status, latency, stream, error: lastErr });
      continue;
    }
    const headers = new Headers(CORS);
    headers.set("Content-Type", res.headers.get("content-type") ?? "application/json");
    headers.set("X-Toperouter-Gateway", c.gw.slug);
    headers.set("X-Toperouter-Upstream-Model", c.upstream);

    if (stream && res.ok && res.body) {
      headers.set("Cache-Control", "no-cache, no-transform");
      const dec = new TextDecoder();
      let tail = "";
      let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
      let outChars = 0;
      const tx = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctl) {
          ctl.enqueue(chunk);
          tail += dec.decode(chunk, { stream: true });
          const lines = tail.split("\n");
          tail = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const d = line.slice(5).trim();
            if (!d || d === "[DONE]") continue;
            try {
              const j = JSON.parse(d) as { usage?: typeof usage; choices?: { delta?: { content?: string } }[] };
              if (j.usage) usage = j.usage;
              outChars += j.choices?.[0]?.delta?.content?.length ?? 0;
            } catch { /* partial */ }
          }
        },
        async flush() {
          const p = usage?.prompt_tokens ?? Math.ceil(JSON.stringify(body["messages"] ?? "").length / 4);
          const o = usage?.completion_tokens ?? Math.ceil(outChars / 4);
          await log(admin, { userId, keyId, c, model, status: res.status, latency: Date.now() - t0, stream, promptTokens: p, completionTokens: o, charge: cost(c, p, o) });
        },
      });
      return new Response(res.body.pipeThrough(tx), { status: res.status, headers });
    }

    const text = await res.text();
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    try { usage = (JSON.parse(text) as { usage?: typeof usage }).usage; } catch { /* non-JSON */ }
    const p = res.ok ? (usage?.prompt_tokens ?? Math.ceil(JSON.stringify(body["messages"] ?? "").length / 4)) : 0;
    const o = res.ok ? (usage?.completion_tokens ?? Math.ceil(text.length / 4)) : 0;
    const charge = res.ok ? cost(c, p, o) : 0;
    const balance = await log(admin, { userId, keyId, c, model, status: res.status, latency, stream, promptTokens: p, completionTokens: o, charge, error: res.ok ? undefined : text.slice(0, 300) });
    if (balance != null) headers.set("X-Toperouter-Balance", String(balance));
    return new Response(text, { status: res.status, headers });
  }
  return err(lastStatus, `All upstream gateways failed. Last error: ${lastErr || "unknown"}`);
}

async function log(
  admin: Admin,
  e: { userId: string; keyId: string; c: Candidate; model: string; status: number; latency: number; stream: boolean; promptTokens?: number; completionTokens?: number; charge?: number; error?: string | undefined },
) {
  let balance: number | null = null;
  if (e.charge && e.charge > 0) {
    const { data } = await admin.rpc("charge_tokens", { _uid: e.userId, _amount: e.charge });
    balance = data == null ? null : Number(data);
  }
  await Promise.all([
    admin.from("usage_logs").insert({
      user_id: e.userId, api_key_id: e.keyId, gateway_id: e.c.gw.id, gateway_name: e.c.gw.name, model: e.model, upstream_model: e.c.upstream,
      status: e.status, latency_ms: e.latency, stream: e.stream, prompt_tokens: e.promptTokens ?? null, completion_tokens: e.completionTokens ?? null,
      cost_tokens: e.charge ?? 0, error: e.error ?? null,
    }),
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", e.keyId),
  ]);
  return balance;
}
