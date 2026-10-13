import { describe, expect, it, vi } from "vitest";
import { handleChat, planHold, type Candidate, type LogEntry, type ProxyStore } from "@/lib/proxy.server";

/** In-memory store with the same semantics as reserve_credits / settle_credits / release_credits. */
function memStore(balance: number, cands: Partial<Candidate>[] = [{}]) {
  const st = { balance, blocked: false };
  const holds = new Map<string, { amount: number; status: "reserved" | "settled" | "released" }>();
  const logs: LogEntry[] = [];
  let n = 0;
  const candidates: Candidate[] = cands.map((c, i) => ({
    upstream: "up-model", isFree: false, inRate: 1, outRate: 2,
    gw: { id: `g${i}`, name: `GW${i}`, slug: `gw${i}`, base_url: `https://gw${i}.test/v1`, api_key: "k" }, ...c,
  }));
  const store: ProxyStore = {
    authenticate: async () => ({ keyId: "key", userId: "u" }),
    profile: async () => ({ ...st }),
    candidates: async () => candidates,
    async reserve(_u, amount) {
      await Promise.resolve();
      if (st.blocked || st.balance <= 0 || st.balance < amount) return null;
      st.balance -= amount;
      const id = `h${++n}`;
      holds.set(id, { amount, status: "reserved" });
      return id;
    },
    async settle(id, actual) {
      const h = holds.get(id);
      if (!h || h.status !== "reserved") return null;
      let delta = h.amount - Math.max(0, actual);
      if (delta < 0) delta = Math.max(delta, -st.balance);
      st.balance += delta;
      h.status = "settled";
      return h.amount - delta;
    },
    async release(id) {
      const h = holds.get(id);
      if (!h || h.status !== "reserved") return false;
      st.balance += h.amount;
      h.status = "released";
      return true;
    },
    releaseStale: async () => undefined,
    log: async (e) => { logs.push(e); },
  };
  const open = () => [...holds.values()].filter((h) => h.status === "reserved").length;
  return { store, st, holds, logs, open };
}

const req = (body: Record<string, unknown>, signal?: AbortSignal) =>
  new Request("https://x.test/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer tr-test", "Content-Type": "application/json" },
    body: JSON.stringify(body), ...(signal ? { signal } : {}),
  });
const msgs = [{ role: "user", content: "hi" }];
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function sse(chunks: string[], { failAfter }: { failAfter?: number } = {}) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (failAfter !== undefined && i === failAfter) { c.error(new Error("upstream reset")); return; }
      if (i >= chunks.length) { c.close(); return; }
      c.enqueue(new TextEncoder().encode(chunks[i++]));
    },
  });
}

describe("credit reservation", () => {
  it("settles on actual usage and refunds the unused hold", async () => {
    const m = memStore(100_000);
    const f = vi.fn(async () => json({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    const res = await handleChat(req({ model: "m", messages: msgs, max_tokens: 1000 }), m.store, f as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(m.st.balance).toBe(100_000 - (10 * 1 + 5 * 2));
    expect(m.open()).toBe(0);
    expect(m.logs[0]?.charged).toBe(20);
  });

  it("reserves before calling upstream: concurrent requests cannot overdraft", async () => {
    const m = memStore(5_000);
    // each request asks for max 2000 output (hold ≈ prompt + 4000), only one fits
    const f = vi.fn(async () => { await new Promise((r) => setTimeout(r, 10)); return json({ usage: { prompt_tokens: 10, completion_tokens: 2000 } }); });
    const results = await Promise.all(Array.from({ length: 10 }, () => handleChat(req({ model: "m", messages: msgs, max_tokens: 2000 }), m.store, f as unknown as typeof fetch)));
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBeGreaterThanOrEqual(1);
    expect(results.filter((r) => r.status === 402).length).toBe(10 - ok);
    expect(f).toHaveBeenCalledTimes(ok);
    expect(m.st.balance).toBeGreaterThanOrEqual(0);
    expect(m.open()).toBe(0);
  });

  it("clamps max output to the affordable amount instead of overdrafting", async () => {
    const c = { upstream: "x", isFree: false, inRate: 1, outRate: 2, gw: { id: "g", name: "g", slug: "g", base_url: "https://g", api_key: "k" } };
    const plan = planHold(c, { messages: msgs, max_tokens: 10_000 }, 1_000)!;
    expect(plan.clamped).toBe(true);
    expect(plan.hold).toBeLessThanOrEqual(1_000);
    expect(planHold(c, { messages: msgs }, 5)).toBeNull();
  });

  it("blocks at zero balance, even for free models, without calling upstream", async () => {
    const m = memStore(0, [{ isFree: true }]);
    const f = vi.fn();
    const res = await handleChat(req({ model: "m", messages: msgs }), m.store, f as unknown as typeof fetch);
    expect(res.status).toBe(402);
    expect(f).not.toHaveBeenCalled();
  });

  it("fails over on 429/5xx, releasing each failed hold, and charges only the successful attempt", async () => {
    const m = memStore(100_000, [{}, {}]);
    const f = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(json({ usage: { prompt_tokens: 3, completion_tokens: 1 } }));
    const res = await handleChat(req({ model: "m", messages: msgs }), m.store, f as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(m.st.balance).toBe(100_000 - 5);
    expect(m.open()).toBe(0);
    expect(m.logs.map((l) => l.charged)).toEqual([0, 5]);
  });

  it("refunds fully when every upstream fails or the network errors", async () => {
    const m = memStore(10_000, [{}, {}]);
    const f = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(new Response("x", { status: 500 }));
    const res = await handleChat(req({ model: "m", messages: msgs }), m.store, f as unknown as typeof fetch);
    expect(res.status).toBe(500);
    expect(m.st.balance).toBe(10_000);
    expect(m.open()).toBe(0);
  });

  it("refunds on a non-retryable upstream 4xx", async () => {
    const m = memStore(10_000);
    const f = vi.fn(async () => json({ error: "bad" }, 400));
    const res = await handleChat(req({ model: "m", messages: msgs }), m.store, f as unknown as typeof fetch);
    expect(res.status).toBe(400);
    expect(m.st.balance).toBe(10_000);
  });

  it("treats an upstream timeout like a network failure (released, no charge)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const m = memStore(10_000);
    const f = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("upstream timeout")))));
    const p = handleChat(req({ model: "m", messages: msgs }), m.store, f as unknown as typeof fetch);
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(61_000);
    const res = await p;
    vi.useRealTimers();
    expect(res.status).toBe(502);
    expect(m.st.balance).toBe(10_000);
    expect(m.open()).toBe(0);
  });

  it("settles a completed stream from reported usage exactly once", async () => {
    const m = memStore(100_000);
    const body = sse([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":7,"completion_tokens":2}}\n\ndata: [DONE]\n\n',
    ]);
    const f = vi.fn(async () => new Response(body, { headers: { "content-type": "text/event-stream" } }));
    const res = await handleChat(req({ model: "m", messages: msgs, stream: true }), m.store, f as unknown as typeof fetch);
    expect(await res.text()).toContain("[DONE]");
    expect(m.st.balance).toBe(100_000 - (7 + 4));
    expect(m.open()).toBe(0);
    expect(m.logs).toHaveLength(1);
  });

  it("settles partial output when the client cancels mid-stream", async () => {
    const m = memStore(100_000);
    const never = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"abcdefghi"}}]}\n\n')); },
    });
    const f = vi.fn(async () => new Response(never));
    const res = await handleChat(req({ model: "m", messages: msgs, stream: true }), m.store, f as unknown as typeof fetch);
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel("user left");
    expect(m.open()).toBe(0);
    const charged = m.logs[0]!.charged;
    expect(charged).toBeGreaterThan(0); // prompt estimate + 9 chars of output
    expect(m.st.balance).toBe(100_000 - charged);
    expect(m.logs[0]!.error).toBe("client cancelled");
  });

  it("settles partial output when the upstream stream errors", async () => {
    const m = memStore(100_000);
    const body = sse(['data: {"choices":[{"delta":{"content":"abc"}}]}\n\n'], { failAfter: 1 });
    const f = vi.fn(async () => new Response(body));
    const res = await handleChat(req({ model: "m", messages: msgs, stream: true }), m.store, f as unknown as typeof fetch);
    await expect(res.text()).rejects.toThrow();
    expect(m.open()).toBe(0);
    expect(m.logs).toHaveLength(1);
    expect(m.logs[0]!.error).toMatch(/stream error/);
  });

  it("never drives the balance negative when actual usage exceeds the hold", async () => {
    const m = memStore(50);
    const f = vi.fn(async () => json({ usage: { prompt_tokens: 1000, completion_tokens: 1000 } }));
    const res = await handleChat(req({ model: "m", messages: msgs }), m.store, f as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(m.st.balance).toBe(0);
  });
});
