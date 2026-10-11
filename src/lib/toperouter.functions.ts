import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomToken, sha256Hex } from "./server-helpers";

/** Single API key per user: revokes any existing key and issues a fresh one. */
export const regenerateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = `tr-${randomToken(24)}`;
    const { error: e1 } = await context.supabase.from("api_keys").update({ revoked: true }).eq("user_id", context.userId).eq("revoked", false);
    if (e1) throw new Error(e1.message);
    const { error } = await context.supabase.from("api_keys").insert({
      user_id: context.userId,
      name: "primary",
      key_hash: await sha256Hex(key),
      key_prefix: key.slice(0, 10),
    });
    if (error) throw new Error(error.message);
    return { key };
  });

export const redeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => {
    const code = (d?.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,40}$/.test(code)) throw new Error("Enter a valid code");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokens, error } = await supabaseAdmin.rpc("redeem_code", { _uid: context.userId, _code: data.code });
    if (error) throw new Error(error.message.replace(/^.*?:\s*/, "") || "Could not redeem code");
    return { tokens: Number(tokens) };
  });

const METHODS = ["bkash", "binance", "crypto"] as const;
export const submitTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { method: string; amount: string; txRef: string; tokens?: number | null }) => {
    if (!METHODS.includes(d.method as (typeof METHODS)[number])) throw new Error("Choose a payment method");
    const amount = (d.amount ?? "").trim().slice(0, 40);
    const txRef = (d.txRef ?? "").trim().slice(0, 200);
    if (!amount || !txRef) throw new Error("Amount and transaction reference are required");
    const tokens = d.tokens && d.tokens > 0 ? Math.min(Math.floor(d.tokens), 1e12) : null;
    return { method: d.method, amount, txRef, tokens };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("topup_requests").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("status", "pending");
    if ((count ?? 0) >= 3) throw new Error("You already have 3 pending requests. Please wait for review.");
    const { error } = await supabaseAdmin.from("topup_requests").insert({
      user_id: context.userId, method: data.method, amount: data.amount, tx_ref: data.txRef, tokens_requested: data.tokens,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
