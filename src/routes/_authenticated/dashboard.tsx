import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cable, KeyRound, Terminal, ArrowUpRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useGateways } from "@/components/ConsoleViews";
import { Button } from "@/components/ui/button";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageMeta("Dashboard", "Live gateway health, API keys, and recent request activity in your Toperouter workspace."),
  component: Dashboard,
});

function Dashboard() {
  const { data: gateways = [], isLoading: gatewaysLoading, error: gatewaysError } = useGateways();
  const { data: keys = [], isLoading: keysLoading, error: keysError } = useQuery({
    queryKey: ["overview-keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("id,revoked");
      if (error) throw error;
      return data;
    },
  });
  const { data: logs = [], isLoading: logsLoading, error: logsError } = useQuery({
    queryKey: ["overview-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usage_logs").select("id,model,status,gateway_name,created_at").order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });
  return <ConsoleShell title="Dashboard" description="Your gateways. One unified connection.">
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      {[
        { label: "Connected gateways", value: gatewaysError ? "Unavailable" : gatewaysLoading ? "…" : gateways.length, detail: `${gateways.filter(g => g.enabled).length} enabled`, icon: Cable },
        { label: "Active API keys", value: keysError ? "Unavailable" : keysLoading ? "…" : keys.filter(k => !k.revoked).length, detail: "Toperouter keys", icon: KeyRound },
        { label: "Latest requests", value: logsError ? "Unavailable" : logsLoading ? "…" : logs.length, detail: "Most recent 5", icon: Terminal },
      ].map(({ label, value, detail, icon: Icon }) => <div className="panel p-5" key={label}><div className="flex items-center justify-between gap-2"><span className="label-plate">{label}</span><Icon className="text-primary" size={20} /></div><div className="mt-5 text-3xl font-semibold">{value}</div><div className="mt-2 text-xs text-muted-foreground">{detail}</div></div>)}
    </div>
    <div className="grid gap-8 lg:grid-cols-2">
      <section><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Gateway health</h2><Button asChild variant="ghost" size="sm"><Link to="/gateways">Manage<ArrowUpRight /></Link></Button></div>
        {gatewaysError ? <div className="well p-6 text-sm">Gateway health is unavailable.</div> : gatewaysLoading ? <div className="well p-6">Loading…</div> : !gateways.length ? <div className="well p-6"><Cable className="mb-3 text-muted-foreground" /><h3 className="font-semibold">No gateways connected</h3><Button asChild className="mt-4"><Link to="/gateways">Connect gateway</Link></Button></div> : <div className="space-y-3">{gateways.map(g => <div key={g.id} className="well flex items-center justify-between gap-3 p-4"><span className="font-medium">{g.name}</span><span className="text-xs text-muted-foreground">{!g.enabled ? "Disabled" : g.last_status === "ok" ? `${g.last_latency_ms ?? "—"} ms` : g.last_status === "error" ? "Connection error" : "Not tested"}</span></div>)}</div>}
      </section>
      <section><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Button asChild variant="ghost" size="sm"><Link to="/usage">All logs<ArrowUpRight /></Link></Button></div>
        {logsError ? <div className="well p-6 text-sm">Recent activity is unavailable.</div> : logsLoading ? <div className="well p-6">Loading…</div> : !logs.length ? <div className="well p-6"><Terminal className="mb-3 text-muted-foreground" /><h3 className="font-semibold">No requests yet</h3><Button asChild variant="outline" className="mt-4"><Link to="/playground">Open playground</Link></Button></div> : <div className="space-y-3">{logs.map(l => <div className="well flex items-center justify-between gap-3 p-4" key={l.id}><span className="min-w-0 break-all font-mono text-xs">{l.model}</span><span className="shrink-0 text-xs">HTTP {l.status ?? "—"}</span></div>)}</div>}
      </section>
    </div>
    <section className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t pt-6"><div><h2 className="font-semibold">Connect your coding tools</h2><p className="mt-1 text-sm text-muted-foreground">OpenCode, Claude Code, Hermes Agent, and Codex CLI.</p></div><Button asChild variant="outline"><Link to="/docs"><BookOpen />Setup guides</Link></Button></section>
  </ConsoleShell>;
}
