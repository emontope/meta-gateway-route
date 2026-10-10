import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeftRight, BookOpen, Cable, KeyRound, LayoutDashboard, LogOut, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const items = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/gateways", label: "Gateways", icon: Cable },
  { to: "/api-keys", label: "API keys", icon: KeyRound },
  { to: "/routing", label: "Routing", icon: ArrowLeftRight },
  { to: "/playground", label: "Playground", icon: Terminal },
  { to: "/usage", label: "Usage logs", icon: Activity },
] as const;

export function ConsoleShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }
  return <main className="mx-auto grid max-w-7xl gap-7 px-5 py-8 md:grid-cols-[200px_minmax(0,1fr)]">
    <aside className="console-sidebar">
      <div className="label-plate mb-4 px-3">Workspace / Console</div>
      <nav aria-label="Console navigation" className="flex flex-wrap gap-2 md:flex-col">
        {items.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className="console-link" activeProps={{ className: "console-link-active" }}><Icon size={17} />{label}</Link>)}
      </nav>
      <div className="mt-6 flex gap-2 border-t pt-4 md:flex-col">
        <Link to="/docs" className="console-link"><BookOpen size={17} />Setup guides</Link>
        <Button variant="ghost" onClick={signOut} className="justify-start"><LogOut />Sign out</Button>
      </div>
    </aside>
    <div className="content-reveal min-w-0">
      <div className="mb-7"><div className="label-plate mb-2">Toperouter control room</div><h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>
      {children}
    </div>
  </main>;
}