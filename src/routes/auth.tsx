import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Toperouter" },
      { name: "description", content: "Sign in to the Toperouter console." },
      { property: "og:title", content: "Sign in — Toperouter" },
      { property: "og:description", content: "Sign in to manage gateways and API keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function google() {
    setBusy(true);
    setErr(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) {
      setErr(r.error.message ?? "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-md p-8">
        <Logo />
        <h1 className="mt-8 font-display text-2xl font-bold">Console access</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to manage gateways, keys and routing.</p>
        <button onClick={google} disabled={busy} className="btn btn-primary mt-6 w-full py-3">
          {busy ? "Connecting…" : "Continue with Google"}
        </button>
        {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
      </div>
    </main>
  );
}
