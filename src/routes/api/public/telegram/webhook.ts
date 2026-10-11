import { createFileRoute } from "@tanstack/react-router";

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean };

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tg, telegramWebhookSecret, telegramEmail } = await import("@/lib/telegram.server");
        const expected = await telegramWebhookSecret();
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        const update = (await request.json().catch(() => null)) as { message?: { chat: { id: number; type: string }; from?: TgUser; text?: string } } | null;
        const msg = update?.message;
        if (!msg?.from || msg.from.is_bot || msg.chat.type !== "private" || !msg.text?.startsWith("/start")) {
          return Response.json({ ok: true });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: linkRow } = await supabaseAdmin.from("app_settings").select("value").eq("key", "links").maybeSingle();
        const links = (linkRow?.value ?? {}) as { channel?: string; group?: string };
        const buttons = [
          ...(links.channel ? [[{ text: "Official channel", url: links.channel }]] : []),
          ...(links.group ? [[{ text: "Community group", url: links.group }]] : []),
        ];
        const code = msg.text.split(/\s+/)[1]?.trim() ?? "";
        const from = msg.from;

        try {
          if (!/^[a-f0-9]{32}$/.test(code)) {
            await tg("sendMessage", {
              chat_id: msg.chat.id,
              text: "Welcome to Toperouter. To sign in, open the website and press “Sign in with Telegram”.",
              ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
            });
            return Response.json({ ok: true });
          }
          const { data: sess } = await supabaseAdmin.from("login_sessions").select("code,status,expires_at").eq("code", code).maybeSingle();
          if (!sess || sess.status !== "pending" || new Date(sess.expires_at) < new Date()) {
            await tg("sendMessage", { chat_id: msg.chat.id, text: "This sign-in link has expired. Please start again on the website." });
            return Response.json({ ok: true });
          }

          // Find or create the account for this Telegram user.
          const display = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || `User ${from.id}`;
          const { data: prof } = await supabaseAdmin.from("profiles").select("id, blocked").eq("telegram_id", from.id).maybeSingle();
          let userId = prof?.id;
          if (prof?.blocked) {
            await tg("sendMessage", { chat_id: msg.chat.id, text: "This account has been suspended. Contact support." });
            return Response.json({ ok: true });
          }
          if (!userId) {
            const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
              email: telegramEmail(from.id),
              email_confirm: true,
              user_metadata: { telegram_id: String(from.id), telegram_username: from.username ?? null, display_name: display },
            });
            if (error || !created.user) throw new Error(error?.message ?? "Could not create account");
            userId = created.user.id;
          } else {
            await supabaseAdmin.from("profiles").update({ telegram_username: from.username ?? null, display_name: display }).eq("id", userId);
          }
          await supabaseAdmin.from("login_sessions").update({ status: "confirmed", user_id: userId, telegram_id: from.id }).eq("code", code).eq("status", "pending");

          await tg("sendMessage", {
            chat_id: msg.chat.id,
            text: `✅ Signed in as ${display}. Return to your browser — your dashboard is opening now.${prof ? "" : "\n\n🎁 1,000,000 free starter tokens have been added to your balance."}`,
            ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
          });
        } catch (e) {
          console.error("telegram webhook", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
