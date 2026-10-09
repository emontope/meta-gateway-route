import { Link } from "@tanstack/react-router";
import { BookOpen, Terminal, KeyRound, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

const guides = [
  { to: "/docs", title: "Quick start", icon: BookOpen },
  { to: "/docs/opencode", title: "OpenCode", icon: Terminal },
  { to: "/docs/claude-code", title: "Claude Code", icon: Terminal },
  { to: "/docs/hermes-agent", title: "Hermes Agent", icon: Terminal },
  { to: "/docs/codex-cli", title: "Codex CLI", icon: Terminal },
] as const;
export function DocsLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[210px_minmax(0,1fr)]">
    <aside><div className="label-plate mb-4 px-3">Documentation</div><nav aria-label="Documentation navigation" className="flex flex-wrap gap-1 md:flex-col">
      {guides.map(({ to, title, icon: Icon }) => <Link to={to} key={to} activeOptions={{ exact: true }} className="guide-link" activeProps={{ className: "guide-link-active" }}><Icon size={16} />{title}</Link>)}
    </nav><div className="mt-6 border-t pt-4"><Link className="guide-link" to="/api-keys"><KeyRound size={16} />API keys<ExternalLink size={12} /></Link></div></aside>
    <article className="min-w-0 max-w-3xl">{children}</article>
  </main>;
}
