import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Boxes, Terminal, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsoleShell } from "@/components/ConsoleShell";
import { fmt, useProfile, usePublicModels, useSettings } from "@/components/ConsoleViews";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ConsoleSkeletons";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageMeta("Dashboard", "Your Toperouter token balance, models, and recent requests."),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile, isLoading: pl } = useProfile();
  const { data: models = [], isLoading: ml } = usePublicModels();
  const { data: settings } = useSettings();
  const { data: logs = [], isLoading: ll } = useQuery({
    queryKey: ["overview-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usage_logs").select("id,model,status,cost_tokens,created_at").order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });
  const links = settings?.links ?? {};
  return <ConsoleShell title={`Welcome${profile?.display_name ? `, ${profile.display_name}` : ""}`} description="Your balance, available models, and latest requests.">
    <div className="mb-8 grid gap-4 sm:grid-cols-3">
      {[
        { label: "Token balance", loading: pl, value: fmt(profile?.token_balance), icon: Coins },
        { label: "Models available", loading: ml, value: models.length, icon: Boxes },
        { label: "Latest requests", loading: ll, value: logs.length, icon: Terminal },
      ].map(({ label, value, loading, icon: Icon }) => <Card className="p-5" key={label}><div className="flex items-center justify-between"><span className="label-plate">{label}</span><Icon className="text-primary" size={20} /></div><div className="mt-5 min-h-9 text-3xl font-semibold">{loading ? <Skeleton className="h-9 w-24" /> : value}</div></Card>)}
    </div>
    {!pl && (profile?.token_balance ?? 0) <= 0 && <div className="well mb-6 p-4 text-sm text-destructive">Your balance is 0, so requests are blocked. <Link to="/billing" className="underline">Top up or redeem a code</Link>.</div>}
    <section><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Button asChild variant="ghost" size="sm"><Link to="/usage">All logs<ArrowUpRight /></Link></Button></div>
      {ll ? <ListSkeleton /> : !logs.length ? <div className="well p-6 text-sm">No requests yet. <Link to="/api-keys" className="text-primary underline">Get your key</Link> and try the <Link to="/playground" className="text-primary underline">Playground</Link>.</div> : <div className="space-y-3">{logs.map(l => <div className="well flex items-center justify-between gap-3 p-4" key={l.id}><span className="break-all font-mono text-xs">{l.model}</span><span className="text-xs">HTTP {l.status ?? "—"} · {fmt(Number(l.cost_tokens))} tokens</span></div>)}</div>}
    </section>
    {(links.channel || links.group) && <section className="mt-8 flex flex-wrap gap-3 border-t pt-6">
      {links.channel && <Button asChild variant="outline"><a href={links.channel} target="_blank" rel="noreferrer">Official channel</a></Button>}
      {links.group && <Button asChild variant="outline"><a href={links.group} target="_blank" rel="noreferrer">Community group</a></Button>}
    </section>}
  </ConsoleShell>;
}
