const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export async function tg(method: string, body: Record<string, unknown>) {
  const lov = process.env["LOVABLE_API_KEY"];
  const key = process.env["TELEGRAM_API_KEY"];
  if (!lov || !key) throw new Error("Telegram is not configured");
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Telegram ${method} failed [${res.status}]: ${t}`);
    throw new Error(`Telegram ${method} failed [${res.status}]`);
  }
  return res.json();
}

/** Webhook secret derived from the connection key (base64url SHA-256). */
export async function telegramWebhookSecret() {
  const key = process.env["TELEGRAM_API_KEY"] ?? "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram-webhook:${key}`));
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function botUsername() {
  return process.env["TELEGRAM_BOT_USERNAME"] ?? "Cyber_Xarvis_Support_Bot";
}

export function telegramEmail(telegramId: number | string) {
  return `tg${telegramId}@telegram.toperouter.app`;
}
