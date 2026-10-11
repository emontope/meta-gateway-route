import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { sha256Hex } from "./server-helpers";

export const ADMIN_COOKIE = "tr_admin";

/** Verifies the httpOnly admin session cookie against admin_sessions. */
export const requireAdmin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getCookie(ADMIN_COOKIE);
  if (!token) throw new Error("Admin session required");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_sessions")
    .select("expires_at")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) throw new Error("Admin session required");
  return next({ context: { admin: supabaseAdmin } });
});
