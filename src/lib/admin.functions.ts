import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { ADMIN_COOKIE, requireAdmin } from "./admin-middleware";
import { joinUrl, randomToken, sha256Hex, slugify } from "./server-helpers";

const SESSION_HOURS = 8;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_GLOBAL = 30;
const WINDOW_MIN = 15;

function clientIp() {
  return getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function timingSafe(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------------- Session ---------------- */
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => ({ pin: String(d?.pin ?? "").slice(0, 32) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const [{ count: ipFails }, { count: allFails }] = await Promise.all([
      supabaseAdmin.from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("success", false).gte("created_at", since),
      supabaseAdmin.from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("success", false).gte("created_at", since),
    ]);
    if ((ipFails ?? 0) >= MAX_FAILS_PER_IP || (allFails ?? 0) >= MAX_FAILS_GLOBAL) {
      throw new Error(`Too many attempts. Try again in ${WINDOW_MIN} minutes.`);
    }
    const expected = process.env["ADMIN_PIN"] ?? "";
    const ok = expected.length > 0 && timingSafe(await sha256Hex(data.pin), await sha256Hex(expected));
    await supabaseAdmin.from("admin_login_attempts").insert({ ip, success: ok });
    if (!ok) throw new Error("Incorrect PIN");
    const token = randomToken(32);
    const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
    await supabaseAdmin.from("admin_sessions").insert({ token_hash: await sha256Hex(token), expires_at: expires.toISOString(), ip });
    setCookie(ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", expires });
    return { ok: true };
  });

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(ADMIN_COOKIE);
  if (!token) return { authed: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("admin_sessions").select("expires_at").eq("token_hash", await sha256Hex(token)).maybeSingle();
  return { authed: !!data && new Date(data.expires_at) > new Date() };
});

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const token = getCookie(ADMIN_COOKIE);
  if (token) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_sessions").delete().eq("token_hash", await sha256Hex(token));
  }
  deleteCookie(ADMIN_COOKIE, { path: "/" });
  return { ok: true };
});

export const adminSecurity = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const [{ data: sessions }, { data: attempts }] = await Promise.all([
      context.admin.from("admin_sessions").select("ip, created_at, expires_at").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
      context.admin.from("admin_login_attempts").select("ip, success, created_at").order("created_at", { ascending: false }).limit(30),
    ]);
    return { sessions: sessions ?? [], attempts: attempts ?? [] };
  });

export const adminRevokeAllSessions = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    await context.admin.from("admin_sessions").delete().gt("expires_at", "1970-01-01");
    deleteCookie(ADMIN_COOKIE, { path: "/" });
    return { ok: true };
  });

/* ---------------- Gateways ---------------- */
export const adminListGateways = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.admin
      .from("gateways")
      .select("id,name,slug,provider,base_url,api_key,enabled,last_status,last_latency_ms,last_model_count,last_error,last_tested_at,created_at")
      .order("created_at");
    if (error) throw new Error(error.message);
    // Never send full upstream secrets to the browser, even to admins.
    return (data ?? []).map(({ api_key, ...g }) => ({ ...g, key_hint: api_key ? `••••${api_key.slice(-4)}` : "" }));
  });

export const adminSaveGateway = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id?: string | undefined; name: string; provider: string; baseUrl: string; apiKey?: string | undefined; enabled?: boolean }) => {
    if (!d.name?.trim()) throw new Error("Name is required");
    if (!/^https:\/\//.test(d.baseUrl ?? "")) throw new Error("Base URL must start with https://");
    if (!d.id && !d.apiKey?.trim()) throw new Error("API key is required");
    return { ...d, name: d.name.trim().slice(0, 60), baseUrl: d.baseUrl.trim(), apiKey: d.apiKey?.trim() };
  })
  .handler(async ({ data, context }) => {
    const row: { name: string; slug: string; provider: string; base_url: string; api_key?: string; enabled?: boolean } = { name: data.name, slug: slugify(data.name), provider: data.provider || "custom", base_url: data.baseUrl };
    if (data.apiKey) row["api_key"] = data.apiKey;
    if (data.enabled !== undefined) row["enabled"] = data.enabled;
    const q = data.id
      ? context.admin.from("gateways").update(row).eq("id", data.id).select("id").single()
      : context.admin.from("gateways").insert(row as never).select("id").single();
    const { data: r, error } = await q;
    if (error) throw new Error(error.code === "23505" ? "A gateway with that name already exists" : error.message);
    return { id: r.id as string };
  });

export const adminToggleGateway = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.admin.from("gateways").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteGateway = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.admin.from("gateways").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminTestGateway = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: gw } = await context.admin.from("gateways").select("base_url, api_key").eq("id", data.id).single();
    if (!gw) throw new Error("Gateway not found");
    const t0 = Date.now();
    let status = "error";
    let count: number | null = null;
    let err: string | null = null;
    let models: string[] = [];
    try {
      const res = await fetch(joinUrl(gw.base_url, "models"), { headers: { Authorization: `Bearer ${gw.api_key}` } });
      if (res.ok) {
        const j = (await res.json()) as { data?: { id: string }[] } | { id: string }[];
        const arr = Array.isArray(j) ? j : (j.data ?? []);
        models = arr.map((m) => m.id).filter(Boolean).sort();
        count = models.length;
        status = "ok";
      } else err = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    const latency = Date.now() - t0;
    await context.admin.from("gateways").update({
      last_status: status, last_latency_ms: latency, last_model_count: count, last_error: err, last_tested_at: new Date().toISOString(),
    }).eq("id", data.id);
    return { status, latency, count, error: err, models };
  });

/* ---------------- Models ---------------- */
export const adminListModels = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.admin.from("models").select("*").order("slug").order("priority");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

type ModelInput = { id?: string | undefined; slug: string; displayName: string; gatewayId: string; upstreamModel: string; isFree: boolean; inputRate: number; outputRate: number; priority: number; enabled: boolean };
export const adminSaveModel = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: ModelInput) => {
    const slug = (d.slug ?? "").trim();
    if (!/^[A-Za-z0-9._:/-]{1,120}$/.test(slug)) throw new Error("Model ID may use letters, numbers, . _ : / -");
    if (!d.gatewayId || !d.upstreamModel?.trim()) throw new Error("Gateway and upstream model are required");
    const ir = Number(d.inputRate), or = Number(d.outputRate);
    if (!(ir >= 0) || !(or >= 0) || ir > 1e6 || or > 1e6) throw new Error("Rates must be between 0 and 1,000,000");
    return { ...d, slug, displayName: (d.displayName || slug).trim().slice(0, 80), upstreamModel: d.upstreamModel.trim(), inputRate: ir, outputRate: or, priority: Math.floor(Number(d.priority) || 100) };
  })
  .handler(async ({ data, context }) => {
    const row = {
      slug: data.slug, display_name: data.displayName, gateway_id: data.gatewayId, upstream_model: data.upstreamModel,
      is_free: data.isFree, input_rate: data.inputRate, output_rate: data.outputRate, priority: data.priority, enabled: data.enabled,
    };
    const { error } = data.id ? await context.admin.from("models").update(row).eq("id", data.id) : await context.admin.from("models").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteModel = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.admin.from("models").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Users ---------------- */
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { q?: string }) => ({ q: (d?.q ?? "").trim().slice(0, 60) }))
  .handler(async ({ data, context }) => {
    let q = context.admin.from("profiles").select("id,telegram_id,telegram_username,display_name,token_balance,blocked,created_at").order("created_at", { ascending: false }).limit(200);
    if (data.q) {
      const safe = data.q.replace(/[,()%*]/g, "");
      q = /^\d+$/.test(safe) ? q.eq("telegram_id", Number(safe)) : q.or(`telegram_username.ilike.%${safe}%,display_name.ilike.%${safe}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { userId: string; delta?: number; set?: number }) => {
    if (d.set !== undefined && !(d.set >= 0)) throw new Error("Balance must be 0 or more");
    if (d.delta !== undefined && !Number.isFinite(d.delta)) throw new Error("Invalid amount");
    return d;
  })
  .handler(async ({ data, context }) => {
    if (data.set !== undefined) {
      const { error } = await context.admin.from("profiles").update({ token_balance: Math.floor(data.set) }).eq("id", data.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.admin.rpc("adjust_tokens", { _uid: data.userId, _delta: Math.floor(data.delta ?? 0) });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminSetBlocked = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { userId: string; blocked: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.admin.from("profiles").update({ blocked: data.blocked }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    if (data.blocked) await context.admin.from("api_keys").update({ revoked: true }).eq("user_id", data.userId);
    return { ok: true };
  });

/* ---------------- Logs ---------------- */
export const adminListLogs = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { errorsOnly?: boolean }) => ({ errorsOnly: !!d?.errorsOnly }))
  .handler(async ({ data, context }) => {
    let q = context.admin.from("usage_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.errorsOnly) q = q.or("status.gte.400,status.eq.0");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ---------------- Redeem codes ---------------- */
export const adminListCodes = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.admin.from("redeem_codes").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminCreateCode = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { code?: string; tokens: number; maxUses: number; expiresAt?: string | null }) => {
    const tokens = Math.floor(Number(d.tokens));
    const maxUses = Math.floor(Number(d.maxUses) || 1);
    if (!(tokens > 0)) throw new Error("Tokens must be greater than 0");
    if (!(maxUses > 0 && maxUses <= 100000)) throw new Error("Max uses must be 1–100,000");
    const code = (d.code ?? "").trim().toUpperCase();
    if (code && !/^[A-Z0-9-]{4,40}$/.test(code)) throw new Error("Code: 4–40 letters, numbers or dashes");
    return { code, tokens, maxUses, expiresAt: d.expiresAt || null };
  })
  .handler(async ({ data, context }) => {
    const code = data.code || `TR-${randomToken(5).toUpperCase()}`;
    const { error } = await context.admin.from("redeem_codes").insert({ code, tokens: data.tokens, max_uses: data.maxUses, expires_at: data.expiresAt });
    if (error) throw new Error(error.code === "23505" ? "That code already exists" : error.message);
    return { code };
  });

export const adminToggleCode = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.admin.from("redeem_codes").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Top-ups ---------------- */
export const adminListTopups = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.admin.from("topup_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map((t) => t.user_id))];
    const { data: profs } = ids.length ? await context.admin.from("profiles").select("id,telegram_username,display_name").in("id", ids) : { data: [] };
    return (data ?? []).map((t) => ({ ...t, user: profs?.find((p) => p.id === t.user_id) ?? null }));
  });

export const adminReviewTopup = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { id: string; approve: boolean; tokens?: number | undefined; note?: string }) => {
    if (d.approve && !(Number(d.tokens) > 0)) throw new Error("Enter tokens to credit");
    return { ...d, tokens: Math.floor(Number(d.tokens) || 0), note: (d.note ?? "").slice(0, 300) };
  })
  .handler(async ({ data, context }) => {
    // Claim only pending rows so a request can't be credited twice.
    const { data: rows, error } = await context.admin
      .from("topup_requests")
      .update({ status: data.approve ? "approved" : "rejected", tokens_granted: data.approve ? data.tokens : null, admin_note: data.note || null, reviewed_at: new Date().toISOString() })
      .eq("id", data.id).eq("status", "pending").select("user_id");
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) throw new Error("Request was already reviewed");
    if (data.approve) await context.admin.rpc("adjust_tokens", { _uid: row.user_id, _delta: data.tokens });
    return { ok: true };
  });

/* ---------------- Settings ---------------- */
export type PaymentSettings = { bkash: string; binance_pay_id: string; wallets: { network: string; address: string }[]; instructions: string };
export type LinkSettings = { channel: string; group: string; support?: string };

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: { payments: PaymentSettings; links: LinkSettings }) => {
    const url = (u: string) => {
      const v = (u ?? "").trim();
      if (v && !/^https:\/\/(t\.me|telegram\.me)\//.test(v)) throw new Error("Links must start with https://t.me/");
      return v.slice(0, 200);
    };
    return {
      payments: {
        bkash: (d.payments.bkash ?? "").trim().slice(0, 60),
        binance_pay_id: (d.payments.binance_pay_id ?? "").trim().slice(0, 60),
        wallets: (d.payments.wallets ?? []).filter((w) => w.address?.trim()).slice(0, 10).map((w) => ({ network: w.network.trim().slice(0, 40), address: w.address.trim().slice(0, 140) })),
        instructions: (d.payments.instructions ?? "").slice(0, 1000),
      },
      links: { channel: url(d.links.channel), group: url(d.links.group), support: (d.links.support ?? "").trim().replace(/[^A-Za-z0-9_@]/g, "").slice(0, 40) },
    };
  })
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.admin.from("app_settings").upsert([
      { key: "payments", value: data.payments, updated_at: now },
      { key: "links", value: data.links, updated_at: now },
    ]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Overview & Telegram ---------------- */
export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const a = context.admin;
    const [users, pending, logs, settings] = await Promise.all([
      a.from("profiles").select("id", { count: "exact", head: true }),
      a.from("topup_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      a.from("usage_logs").select("cost_tokens, status").order("created_at", { ascending: false }).limit(5000),
      a.from("app_settings").select("key,value"),
    ]);
    const rows = logs.data ?? [];
    return {
      users: users.count ?? 0,
      pendingTopups: pending.count ?? 0,
      burned: rows.reduce((s, r) => s + Number(r.cost_tokens ?? 0), 0),
      requests: rows.length,
      errors: rows.filter((r) => !r.status || r.status >= 400).length,
      settings: JSON.stringify(Object.fromEntries((settings.data ?? []).map((r) => [r.key, r.value]))),
    };
  });

export const adminTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const t = await import("./telegram.server");
    try {
      const [me, wh] = await Promise.all([t.tg("getMe"), t.tg("getWebhookInfo")]);
      return { ok: true, mode: t.telegramMode(), expectedUrl: t.WEBHOOK_URL, bot: me.result as { username?: string; first_name?: string; id?: number }, webhook: wh.result as { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number }, error: null };
    } catch (e) {
      return { ok: false, mode: t.telegramMode(), expectedUrl: t.WEBHOOK_URL, bot: null, webhook: null, error: (e as Error).message };
    }
  });

export const adminRegisterWebhook = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const t = await import("./telegram.server");
    await t.registerWebhook();
    return { ok: true };
  });

export const adminListRedemptions = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data } = await context.admin.from("redemptions").select("id, code_id, user_id, tokens, created_at").order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });
