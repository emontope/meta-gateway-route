const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
export const WEBHOOK_URL = "https://meta-gateway-route.lovable.app/api/public/telegram/webhook";

/** Direct bot token (AuthTGBOT preferred), else null → connector gateway fallback. */
function botToken() {
  return process.env["AuthTGBOT"]?.trim() || process.env["TELEGRAM_BOT_TOKEN"]?.trim() || null;
}

export function telegramMode() {
  return botToken() ? "direct" : "connector";
}

export async function tg(method: string, body: Record<string, unknown> = {}) {
  const token = botToken();
  let res: Response;
  if (token) {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } else {
    const lov = process.env["LOVABLE_API_KEY"];
    const key = process.env["TELEGRAM_API_KEY"];
    if (!lov || !key) throw new Error("Telegram bot is not configured");
    res = await fetch(`${GATEWAY_URL}/${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  const text = await res.text();
  if (!res.ok) {
    console.error(`Telegram ${method} failed [${res.status}]: ${text}`);
    let desc = text;
    try { desc = (JSON.parse(text) as { description?: string }).description ?? text; } catch { /* raw */ }
    throw new Error(`Telegram ${method} failed [${res.status}]: ${desc.slice(0, 200)}`);
  }
  return JSON.parse(text) as { ok: boolean; result: Record<string, unknown> };
}

/** Webhook secret derived from the active bot credential (base64url SHA-256). */
export async function telegramWebhookSecret() {
  const key = botToken() ?? process.env["TELEGRAM_API_KEY"] ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram-webhook:${key}`));
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedUsername: { key: string; name: string } | null = null;
/** Bot username auto-detected via getMe (cached per credential). */
export async function botUsername() {
  const key = botToken() ?? "connector";
  if (cachedUsername?.key === key) return cachedUsername.name;
  const r = await tg("getMe");
  const name = String(r.result["username"] ?? "");
  if (!name) throw new Error("Could not detect bot username");
  cachedUsername = { key, name };
  return name;
}

export async function registerWebhook() {
  return tg("setWebhook", {
    url: WEBHOOK_URL,
    secret_token: await telegramWebhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}

export function telegramEmail(telegramId: number | string) {
  return `tg${telegramId}@telegram.toperouter.app`;
}
