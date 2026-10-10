import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Cable, KeyRound, ArrowLeftRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/CodeSnippet";
import { pageMeta } from "@/lib/page-meta";
import { ProviderMatrix } from "@/components/ProviderMatrix";
export const Route = createFileRoute("/")({
  head: () => pageMeta("One key for every AI gateway", "Bring your OpenRouter, ZenMux, DeepInfra, and other gateway keys into one OpenAI-compatible API with routing, live connection tests, and usage logs."),
  component: Index,
});
function Index() {
  return <main className="mx-auto max-w-7xl px-5 pt-12 sm:pt-16">
    <section className="border-b pb-12">
      <div className="label-plate mb-7">Independent gateways. Unified access.</div>
      <h1><Logo size="xl" /></h1>
      <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">Your gateway above the gateways. Connect your existing accounts, choose where each model runs, and give every tool one consistent API.</p>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Toperouter brings your own upstream keys together—not a new model subscription. Your providers handle inference and billing; you control routing, credentials, and request visibility here.</p>
      <div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/dashboard">Open console<ArrowUpRight /></Link></Button><Button asChild variant="outline" size="lg"><Link to="/docs"><BookOpen />Read the docs</Link></Button></div>
      <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs text-muted-foreground"><span>OPENROUTER</span><span>ZENMUX</span><span>DEEPINFRA</span><span>TOGETHER</span><span>GROQ</span><span>FIREWORKS</span></div>
    </section>
    <ProviderMatrix />
    <section className="border-t py-9">
      <div className="label-plate">The request path</div><h2 className="mt-3 font-display text-2xl font-bold">You choose the route. We connect the layers.</h2>
      <div className="mt-7 grid gap-7 md:grid-cols-3">{[
        ["01 / Your client", "One Toperouter key", "Your app or compatible coding tool sends a Chat Completions request using a tr- key. Upstream credentials stay server-side."],
        ["02 / Your gateway", "Predictable routing", "A gateway/model prefix targets a gateway directly. Otherwise rules run by priority, then enabled gateways are ordered by measured latency."],
        ["03 / Your model", "Real request visibility", "The selected provider runs inference. Retryable 429 and 5xx errors can fail over when alternatives exist; usage logs record status, latency, and tokens."],
      ].map(([number, title, text]) => <div className="route-step" key={number}><div className="label-plate">{number}</div><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{text}</p></div>)}</div>
    </section>
    <section className="grid gap-8 border-b py-9 sm:grid-cols-3">
      {[
        { title: "Bring your gateways", desc: "Connect your upstream keys and measure real connection latency.", icon: Cable },
        { title: "Keep one API key", desc: "One OpenAI-compatible endpoint for your connected models.", icon: KeyRound },
        { title: "Choose your route", desc: "Direct gateway targeting, model rules, and retryable-error failover.", icon: ArrowLeftRight },
      ].map(({ title, desc, icon: Icon }, i) => <div key={title}><div className="mb-4 flex items-center justify-between"><Icon className="text-primary" size={22} /><span className="label-plate">0{i + 1}</span></div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p></div>)}
    </section>
    <section className="grid gap-8 py-9 lg:grid-cols-[1fr_1.25fr]"><div><div className="label-plate">Your next connection</div><h2 className="mt-3 font-display text-2xl font-bold">From console to terminal.</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Copyable setup guides for OpenCode, Hermes Agent, Claude Code, and Codex CLI—with clear notes about protocol compatibility.</p><Button asChild variant="outline" className="mt-5"><Link to="/docs">Explore setup guides<ArrowUpRight /></Link></Button></div><CodeSnippet label="OpenAI-compatible base URL" code="https://meta-gateway-route.lovable.app/api/public/v1" /></section>
  </main>;
}
