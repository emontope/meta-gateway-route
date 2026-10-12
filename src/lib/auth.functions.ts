import { createServerFn } from "@tanstack/react-start";
import { randomToken } from "./server-helpers";

export const startTelegramLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { botUsername } = await import("./telegram.server");
  const code = randomToken(16);
  const { error } = await supabaseAdmin.from("login_sessions").insert({ code });
  if (error) throw new Error("Could not start sign-in");
  return { code, url: `https://t.me/${await botUsername()}?start=${code}` };
});

export const pollTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => {
    if (!/^[a-f0-9]{32}$/.test(d?.code ?? "")) throw new Error("Invalid code");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("login_sessions").select("status,user_id,expires_at").eq("code", data.code).maybeSingle();
    if (!s || new Date(s.expires_at) < new Date()) return { status: "expired" as const };
    if (s.status !== "confirmed" || !s.user_id) return { status: s.status === "used" ? ("expired" as const) : ("pending" as const) };
    // One-time use: claim the session before issuing a token.
    const { data: claimed } = await supabaseAdmin.from("login_sessions").update({ status: "used" }).eq("code", data.code).eq("status", "confirmed").select("code");
    if (!claimed?.length) return { status: "expired" as const };
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(s.user_id);
    if (!u.user?.email) return { status: "expired" as const };
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
    if (error || !link.properties?.hashed_token) throw new Error("Could not complete sign-in");
    return { status: "confirmed" as const, tokenHash: link.properties.hashed_token };
  });
