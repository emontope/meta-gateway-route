import { joinUrl, sha256Hex } from "./server-helpers";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Toperouter-Gateway, X-Toperouter-Upstream-Model, X-Toperouter-Balance",
};

export const UPSTREAM_HEADERS_TIMEOUT_MS = 60_000;
export const UPSTREAM_TOTAL_TIMEOUT_MS = 300_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}

function err(status: number, message: string, code = "toperouter_error") {
  return Response.json({ error: { message, type: code } }, { status, headers: CORS });
}

export type Gw = { id: string; name: string; slug: string; base_url: string; api_key: string };
export type Candidate = { upstream: string; isFree: boolean; inRate: number; outRate: number; gw: Gw };
export type LogEntry = {
  userId: string; keyId: string; c: Candidate; model: string; status: number; latency: number; stream: boolean;
  promptTokens?: number | undefined; completionTokens?: number | undefined; charged: number; error?: string | undefined;
};

/** Persistence boundary for the proxy. Credit methods map 1:1 to atomic SQL functions. */
export interface ProxyStore {
  authenticate(keyHash: string): Promise<{ keyId: string; userId: string } | null>;
  profile(userId: string): Promise<{ balance: number; blocked: boolean } | null>;
  candidates(model: string): Promise<Candidate[]>;
  /** Atomically deducts `amount`; returns hold id or null when funds are insufficient / zero / blocked. */
  reserve(userId: string, amount: number, note: string): Promise<string | null>;
  /** Idempotent: settles against actual cost, refunding the unused hold. Returns amount charged or null if already finalized. */
  settle(holdId: string, actual: number): Promise<number | null>;
  /** Idempotent: returns the whole hold. */
  release(holdId: string, reason: string): Promise<boolean>;
  releaseStale(): Promise<void>;
  log(e: LogEntry): Promise<void>;
}

/* ---------------- pricing helpers (pure) ---------------- */
export function estimatePromptTokens(body: Record<string, unknown>) {
  // Conservative: ~3 chars/token + overhead, so the hold usually exceeds the real prompt cost.
  const chars = JSON.stringify(body["messages"] ?? body["prompt"] ?? "").length;
  return Math.ceil(chars / 3) + 16;
}
export function costOf(c: Candidate, prompt: number, completion: number) {
  if (c.isFree) return 0;
  return Math.ceil(Math.max(0, prompt) * c.inRate + Math.max(0, completion) * c.outRate);
}
function requestedMaxOutput(body: Record<string, unknown>) {
  for (const k of ["max_completion_tokens", "max_tokens"] as const) {
    const v = body[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return { key: k, value: Math.floor(v) };
  }
  return { key: "max_tokens" as const, value: DEFAULT_MAX_OUTPUT_TOKENS };
}
/**
 * Plans a hold covering the worst case (prompt estimate + max output).
 * When the balance can't cover the requested max output, max output is clamped to what is affordable.
 */
export function planHold(c: Candidate, body: Record<string, unknown>, balance: number) {
  const req = requestedMaxOutput(body);
  if (c.isFree) return { hold: 0, maxKey: req.key, maxOut: req.value, clamped: false };
  const promptCost = Math.ceil(estimatePromptTokens(body) * c.inRate);
  const affordable = c.outRate > 0 ? Math.floor((balance - promptCost) / c.outRate) : req.value;
  const maxOut = Math.min(req.value, affordable);
  if (maxOut < 1) return null;
  return { hold: costOf(c, estimatePromptTokens(body), maxOut), maxKey: req.key, maxOut, clamped: maxOut < req.value };
}

/* ---------------- Supabase-backed store ---------------- */
export async function supabaseStore(): Promise<ProxyStore> {
  const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");
  const rpcErr = (fn: string, e: { message: string } | null) => { if (e) throw new Error(`${fn}: ${e.message}`); };
  return {
    async authenticate(hash) {
      const { data } = await a.from("api_keys").select("id, user_id").eq("key_hash", hash).eq("revoked", false).maybeSingle();
      return data ? { keyId: data.id, userId: data.user_id } : null;
    },
    async profile(uid) {
      const { data } = await a.from("profiles").select("token_balance, blocked").eq("id", uid).maybeSingle();
      return data ? { balance: Number(data.token_balance), blocked: data.blocked } : null;
    },
    async candidates(model) {
      const { data } = await a
        .from("models")
        .select("upstream_model, is_free, input_rate, output_rate, priority, gateways!inner(id, name, slug, base_url, api_key, enabled)")
        .eq("slug", model).eq("enabled", true).eq("gateways.enabled", true)
        .order("priority", { ascending: true });
      return (data ?? []).map((r) => ({
        upstream: r.upstream_model, isFree: r.is_free, inRate: Number(r.input_rate), outRate: Number(r.output_rate),
        gw: r.gateways as unknown as Gw,
      }));
    },
    async reserve(uid, amount, note) {
      const { data, error } = await a.rpc("reserve_credits", { _uid: uid, _amount: amount, _note: note });
      rpcErr("reserve_credits", error);
      return (data as string | null) ?? null;
    },
    async settle(id, actual) {
      const { data, error } = await a.rpc("settle_credits", { _rid: id, _actual: actual });
      rpcErr("settle_credits", error);
      return data == null ? null : Number(data);
    },
    async release(id, reason) {
      const { data, error } = await a.rpc("release_credits", { _rid: id, _reason: reason });
      rpcErr("release_credits", error);
      return !!data;
    },
    async releaseStale() {
      await a.rpc("release_stale_credits", {});
    },
    async log(e) {
      await Promise.all([
        a.from("usage_logs").insert({
          user_id: e.userId, api_key_id: e.keyId, gateway_id: e.c.gw.id, gateway_name: e.c.gw.name, model: e.model, upstream_model: e.c.upstream,
          status: e.status, latency_ms: e.latency, stream: e.stream, prompt_tokens: e.promptTokens ?? null, completion_tokens: e.completionTokens ?? null,
          cost_tokens: e.charged, error: e.error ?? null,
        }),
        a.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", e.keyId),
      ]);
    },
  };
}

async function bearer(request: Request, store: ProxyStore) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !token.startsWith("tr-") || token.length > 100) return null;
  return store.authenticate(await sha256Hex(token));
}

export async function handleModels(request: Request) {
  const store = await supabaseStore();
  const auth = await bearer(request, store);
  if (!auth) return err(401, "Invalid or missing Toperouter API key");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("models").select("slug, display_name, is_free, input_rate, output_rate, gateways!inner(enabled)").eq("enabled", true).eq("gateways.enabled", true);
  const seen = new Set<string>();
  const list = (data ?? []).filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true))).map((m) => ({
    id: m.slug, object: "model", owned_by: "toperouter", name: m.display_name,
    pricing: { free: m.is_free, input_tokens_per_token: Number(m.input_rate), output_tokens_per_token: Number(m.output_rate) },
  }));
  return Response.json({ object: "list", data: list }, { headers: CORS });
}

type Usage = { prompt_tokens?: number; completion_tokens?: number };

export async function handleChat(request: Request, store?: ProxyStore, fetcher: typeof fetch = fetch) {
  const s = store ?? (await supabaseStore());
  const auth = await bearer(request, s);
  if (!auth) return err(401, "Invalid or missing Toperouter API key");
  const { userId, keyId } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return err(400, "Body must be JSON");
  }
  const model = typeof body["model"] === "string" ? body["model"] : "";
  if (!model) return err(400, "`model` is required");

  await s.releaseStale().catch(() => undefined);
  const prof = await s.profile(userId);
  if (!prof) return err(403, "Account not found");
  if (prof.blocked) return err(403, "Account suspended", "account_blocked");
  if (prof.balance <= 0) return err(402, "Token balance is 0. Top up or redeem a code to continue.", "insufficient_balance");

  const candidates = await s.candidates(model);
  if (!candidates.length) return err(404, `Model '${model}' is not available. GET /models lists available models.`, "model_not_found");

  const stream = body["stream"] === true;
  const promptEstimate = estimatePromptTokens(body);
  let lastErr = "";
  let lastStatus = 502;

  for (const c of candidates) {
    // Re-read balance each attempt (previous holds were released) and plan a fully covered hold.
    const p = await s.profile(userId);
    const plan = p ? planHold(c, body, p.balance) : null;
    if (!plan) return err(402, "Insufficient token balance for this request.", "insufficient_balance");
    const holdId = await s.reserve(userId, plan.hold, `${model} via ${c.gw.slug}`);
    if (!holdId) return err(402, "Insufficient token balance for this request.", "insufficient_balance");

    const upstreamBody: Record<string, unknown> = { ...body, model: c.upstream, [plan.maxKey]: plan.maxOut };
    if (stream) upstreamBody["stream_options"] = { include_usage: true };

    const ctl = new AbortController();
    const onClientAbort = () => ctl.abort(new Error("client aborted"));
    request.signal.addEventListener("abort", onClientAbort, { once: true });
    let timer = setTimeout(() => ctl.abort(new Error("upstream timeout")), UPSTREAM_HEADERS_TIMEOUT_MS);
    const t0 = Date.now();

    let res: Response;
    try {
      res = await fetcher(joinUrl(c.gw.base_url, "chat/completions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.gw.api_key}` },
        body: JSON.stringify(upstreamBody),
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onClientAbort);
      lastErr = e instanceof Error ? e.message : String(e);
      await s.release(holdId, `network: ${lastErr}`);
      await s.log({ userId, keyId, c, model, status: 0, latency: Date.now() - t0, stream, charged: 0, error: lastErr });
      if (request.signal.aborted) return err(499, "Client closed request");
      continue;
    }
    const latency = Date.now() - t0;

    if (res.status === 429 || res.status >= 500) {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onClientAbort);
      lastStatus = res.status;
      lastErr = (await res.text().catch(() => "")).slice(0, 300);
      await s.release(holdId, `upstream ${res.status}`);
      await s.log({ userId, keyId, c, model, status: res.status, latency, stream, charged: 0, error: lastErr });
      continue; // fail over
    }

    const headers = new Headers(CORS);
    headers.set("Content-Type", res.headers.get("content-type") ?? "application/json");
    headers.set("X-Toperouter-Gateway", c.gw.slug);
    headers.set("X-Toperouter-Upstream-Model", c.upstream);

    if (!res.ok) {
      // Non-retryable client error from upstream: nothing billable.
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onClientAbort);
      const text = await res.text().catch(() => "");
      await s.release(holdId, `upstream ${res.status}`);
      await s.log({ userId, keyId, c, model, status: res.status, latency, stream, charged: 0, error: text.slice(0, 300) });
      return new Response(text, { status: res.status, headers });
    }

    if (stream && res.body) {
      clearTimeout(timer);
      headers.set("Cache-Control", "no-cache, no-transform");
      return new Response(meteredStream(res.body, { s, holdId, c, promptEstimate, onDone: (r) => {
        request.signal.removeEventListener("abort", onClientAbort);
        return s.log({ userId, keyId, c, model, status: res.status, latency: Date.now() - t0, stream, ...r });
      }, abortUpstream: () => ctl.abort(new Error("client cancelled")) }), { status: res.status, headers });
    }

    // Non-streaming: allow the full response time, then settle on actual usage.
    clearTimeout(timer);
    timer = setTimeout(() => ctl.abort(new Error("upstream timeout")), UPSTREAM_TOTAL_TIMEOUT_MS - latency);
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onClientAbort);
      const msg = e instanceof Error ? e.message : String(e);
      // The upstream may have generated output; charge the prompt estimate only, refund the rest.
      const charged = (await s.settle(holdId, costOf(c, promptEstimate, 0))) ?? 0;
      await s.log({ userId, keyId, c, model, status: 0, latency: Date.now() - t0, stream, charged, error: `body: ${msg}` });
      return err(request.signal.aborted ? 499 : 504, `Upstream response interrupted: ${msg}`);
    }
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onClientAbort);
    let usage: Usage | undefined;
    try { usage = (JSON.parse(text) as { usage?: Usage }).usage; } catch { /* non-JSON */ }
    const pt = usage?.prompt_tokens ?? promptEstimate;
    const ct = usage?.completion_tokens ?? Math.ceil(text.length / 3);
    const charged = (await s.settle(holdId, costOf(c, pt, ct))) ?? 0;
    await s.log({ userId, keyId, c, model, status: res.status, latency, stream, promptTokens: pt, completionTokens: ct, charged });
    const after = await s.profile(userId);
    if (after) headers.set("X-Toperouter-Balance", String(after.balance));
    return new Response(text, { status: res.status, headers });
  }
  return err(lastStatus, `All upstream gateways failed. Last error: ${lastErr || "unknown"}`);
}

/**
 * Pass-through SSE stream that settles the hold exactly once:
 * on normal completion (reported usage, else estimate), on upstream error, and on client cancel (partial estimate).
 */
export function meteredStream(
  upstream: ReadableStream<Uint8Array>,
  o: {
    s: ProxyStore; holdId: string; c: Candidate; promptEstimate: number;
    onDone: (r: { promptTokens: number; completionTokens: number; charged: number; error?: string }) => Promise<void>;
    abortUpstream: () => void;
  },
) {
  const reader = upstream.getReader();
  const dec = new TextDecoder();
  let tail = "";
  let usage: Usage | undefined;
  let outChars = 0;
  let finalized = false;

  function scan(chunk: Uint8Array) {
    tail += dec.decode(chunk, { stream: true });
    const lines = tail.split("\n");
    tail = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const j = JSON.parse(d) as { usage?: Usage; choices?: { delta?: { content?: string; reasoning_content?: string } }[] };
        if (j.usage) usage = j.usage;
        const delta = j.choices?.[0]?.delta;
        outChars += (delta?.content?.length ?? 0) + (delta?.reasoning_content?.length ?? 0);
      } catch { /* partial line */ }
    }
  }
  async function finalize(error?: string) {
    if (finalized) return;
    finalized = true;
    const pt = usage?.prompt_tokens ?? o.promptEstimate;
    const ct = usage?.completion_tokens ?? Math.ceil(outChars / 3);
    let charged = 0;
    try {
      charged = (await o.s.settle(o.holdId, costOf(o.c, pt, ct))) ?? 0;
    } catch (e) {
      // Leave the hold in place; release_stale_credits refunds it later rather than losing the record.
      console.error("stream settlement failed", e);
    }
    await o.onDone({ promptTokens: pt, completionTokens: ct, charged, ...(error ? { error } : {}) }).catch(() => undefined);
  }

  return new ReadableStream<Uint8Array>({
    async pull(ctl) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          await finalize();
          ctl.close();
          return;
        }
        scan(value);
        ctl.enqueue(value);
      } catch (e) {
        await finalize(`stream error: ${e instanceof Error ? e.message : String(e)}`);
        ctl.error(e);
      }
    },
    async cancel(reason) {
      o.abortUpstream();
      await reader.cancel(reason).catch(() => undefined);
      await finalize("client cancelled");
    },
  });
}
