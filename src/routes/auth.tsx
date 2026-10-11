import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pollTelegramLogin, startTelegramLogin } from "@/lib/auth.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in with Telegram — Toperouter" },
      { name: "description", content: "Sign in to Toperouter through our Telegram bot." },
      { property: "og:title", content: "Sign in with Telegram — Toperouter" },
      { property: "og:description", content: "One tap in Telegram opens your Toperouter dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const start = useServerFn(startTelegramLogin);
  const poll = useServerFn(pollTelegramLogin);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<{ code: string; url: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard", replace: true }); });
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [navigate]);

  async function begin() {
    setErr(null);
    try {
      const l = await start();
      setLink(l);
      window.open(l.url, "_blank", "noopener");
      if (timer.current) clearInterval(timer.current);
      let busy = false;
      timer.current = setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
          const r = await poll({ data: { code: l.code } });
          if (r.status === "expired") { clearInterval(timer.current!); setLink(null); setErr("Sign-in link expired. Please try again."); }
          if (r.status === "confirmed") {
            clearInterval(timer.current!);
            const { error } = await supabase.auth.verifyOtp({ token_hash: r.tokenHash, type: "magiclink" });
            if (error) { setErr(error.message); return; }
            navigate({ to: "/dashboard", replace: true });
          }
        } catch { /* keep polling */ } finally { busy = false; }
      }, 2000);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="panel w-full max-w-md p-8">
        <Logo />
        <h1 className="mt-8 font-display text-2xl font-bold">Sign in with Telegram</h1>
        <p className="mt-2 text-sm text-muted-foreground">Open our bot, press Start, and this page opens your dashboard automatically. New accounts get 1,000,000 free tokens.</p>
        {!link ? (
          <Button onClick={begin} className="mt-6 w-full py-3">Continue with Telegram</Button>
        ) : (
          <div className="mt-6 space-y-3">
            <div className="well flex items-center gap-3 p-4 text-sm"><span className="led led-ok" />Waiting for you to press Start in Telegram…</div>
            <Button asChild variant="outline" className="w-full"><a href={link.url} target="_blank" rel="noreferrer">Open Telegram again</a></Button>
          </div>
        )}
        <p className="mt-5 text-xs text-muted-foreground">By continuing, you agree to the <Link to="/terms" className="text-primary underline">Terms of Service</Link>.</p>
        {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
      </div>
    </main>
  );
}
