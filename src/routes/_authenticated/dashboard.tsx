import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cable, KeyRound, Terminal, ArrowUpRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsoleShell } from "@/components/ConsoleShell";
import { useGateways } from "@/components/ConsoleViews";
import { Button } from "@/components/ui/button";
import { ProviderMatrix } from "@/components/ProviderMatrix";
import { ListSkeleton } from "@/components/ConsoleSkeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
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
  return <ConsoleShell title="Dashboard" description="A live view of your connected gateways, active credentials, and latest requests.">
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      {[
        { label: "Connected gateways", loading: gatewaysLoading, value: gatewaysError ? "Unavailable" : gatewaysLoading ? "…" : gateways.length, detail: `${gateways.filter(g => g.enabled).length} enabled`, icon: Cable },
        { label: "Active API keys", loading: keysLoading, value: keysError ? "Unavailable" : keysLoading ? "…" : keys.filter(k => !k.revoked).length, detail: "Toperouter keys", icon: KeyRound },
        { label: "Latest requests", loading: logsLoading, value: logsError ? "Unavailable" : logsLoading ? "…" : logs.length, detail: "Most recent 5", icon: Terminal },
      ].map(({ label, value, detail, loading, icon: Icon }) => <Card className="p-5" key={label}><div className="flex items-center justify-between gap-2"><span className="label-plate">{label}</span><Icon className="text-primary" size={20} /></div><div className="mt-5 min-h-9 text-3xl font-semibold">{loading ? <Skeleton className="h-9 w-20" /> : value}</div><div className="mt-2 text-xs text-muted-foreground">{loading ? <Skeleton className="h-3 w-24" /> : detail}</div></Card>)}
    </div>
    <div className="grid gap-8 lg:grid-cols-2">
      <section><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Gateway health</h2><Button asChild variant="ghost" size="sm"><Link to="/gateways">Manage<ArrowUpRight /></Link></Button></div>
        {gatewaysError ? <div className="well p-6 text-sm">Gateway health is unavailable.</div> : gatewaysLoading ? <ListSkeleton /> : !gateways.length ? <div className="well p-6"><Cable className="mb-3 text-muted-foreground" /><h3 className="font-semibold">No gateways connected</h3><Button asChild className="mt-4"><Link to="/gateways">Connect gateway</Link></Button></div> : <div className="content-reveal space-y-3">{gateways.map(g => <div key={g.id} className="well flex items-center justify-between gap-3 p-4"><span className="font-medium">{g.name}</span><span className="text-xs text-muted-foreground">{!g.enabled ? "Disabled" : g.last_status === "ok" ? `${g.last_latency_ms ?? "—"} ms` : g.last_status === "error" ? "Connection error" : "Not tested"}</span></div>)}</div>}
      </section>
      <section><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Button asChild variant="ghost" size="sm"><Link to="/usage">All logs<ArrowUpRight /></Link></Button></div>
        {logsError ? <div className="well p-6 text-sm">Recent activity is unavailable.</div> : logsLoading ? <ListSkeleton /> : !logs.length ? <div className="well p-6"><Terminal className="mb-3 text-muted-foreground" /><h3 className="font-semibold">No requests yet</h3><Button asChild variant="outline" className="mt-4"><Link to="/playground">Open playground</Link></Button></div> : <div className="content-reveal space-y-3">{logs.map(l => <div className="well flex items-center justify-between gap-3 p-4" key={l.id}><span className="min-w-0 break-all font-mono text-xs">{l.model}</span><span className="shrink-0 text-xs">HTTP {l.status ?? "—"}</span></div>)}</div>}
      </section>
    </div>
    <section className="mt-9 border-t py-7"><div className="label-plate">Workspace essentials</div><h2 className="mt-3 text-lg font-semibold">From credentials to a working request</h2><div className="mt-5 grid gap-6 sm:grid-cols-3">{([
      {title: "Connect & test", text: "Add an upstream gateway with your own key. Run its live connection test to check model discovery and measured latency.", to: "/gateways"},
      {title: "Create a client key", text: "Generate a Toperouter key for your app. The full value is shown once; revoke it here if access should end.", to: "/api-keys"},
      {title: "Trace a request", text: "Send a real prompt in the Playground, then inspect the selected gateway, response status, latency, and tokens in Usage logs.", to: "/playground"},
    ] as const).map(({title,text,to}) => <div className="route-step" key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p><Button variant="ghost" asChild className="mt-3 px-0"><Link to={to}>{title}<ArrowUpRight /></Link></Button></div>)}</div></section>
    <ProviderMatrix />
    <section className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t pt-6"><div><h2 className="font-semibold">Connect your coding tools</h2><p className="mt-1 text-sm text-muted-foreground">OpenCode, Claude Code, Hermes Agent, and Codex CLI.</p></div><Button asChild variant="outline"><Link to="/docs"><BookOpen />Setup guides</Link></Button></section>
  </ConsoleShell>;
}
