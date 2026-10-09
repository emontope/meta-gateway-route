import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return <header className="site-header">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
      <Link to="/" aria-label="Toperouter home"><Logo /></Link>
      <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-4">
        <Button asChild variant="ghost" size="sm"><Link to="/docs"><BookOpen />Docs</Link></Button>
        <Button asChild size="sm"><Link to="/dashboard">Console<ArrowUpRight /></Link></Button>
      </nav>
    </div>
  </header>;
}

export function SiteFooter() {
  return <footer className="mt-12 border-t">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-xs text-muted-foreground">
      <span className="font-mono">TOPEROUTER / AI META-GATEWAY</span>
      <div className="flex gap-5"><Link to="/docs">Documentation</Link><Link to="/terms">Terms of Service</Link></div>
    </div>
  </footer>;
}