import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Terminal, Cable, KeyRound } from "lucide-react";
import { CodeSnippet } from "@/components/CodeSnippet";
import { pageMeta } from "@/lib/page-meta";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/docs/")({
  head: () => pageMeta("Documentation & setup", "Connect OpenCode, Hermes Agent, Claude Code, and Codex CLI to Toperouter with clear compatibility notes and copyable configuration."),
  component: QuickStart,
});
const base = "https://meta-gateway-route.lovable.app/api/public/v1";
function QuickStart() {
  return <>
    <div className="label-plate">Get connected / 01</div><h1 className="mt-3 font-display text-3xl font-bold">One endpoint. Your tools.</h1>
    <p className="mt-4 text-muted-foreground leading-7">Bring your upstream gateway keys to Toperouter, then connect OpenAI-compatible clients with a single unified key.</p>
    <section className="mt-9 border-t pt-6"><h2 className="flex items-center gap-3 text-lg font-semibold"><Cable size={20} className="text-primary" />1. Connect a gateway</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Add your provider’s base URL and API key, then run the connection test. Use a connected gateway’s slug and an actual model ID, for example <code>openrouter/openai/gpt-4o-mini</code> if that model is available on your account.</p><Button asChild variant="outline" className="mt-3"><Link to="/gateways">Connect gateway<ArrowUpRight /></Link></Button></section>
    <section className="mt-8 border-t pt-6"><h2 className="flex items-center gap-3 text-lg font-semibold"><KeyRound size={20} className="text-primary" />2. Generate your Toperouter key</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Create a key on the API keys page. Copy the <code>tr-</code> value immediately; it is shown only once. Never use an upstream provider key as your Toperouter key.</p><Button asChild variant="outline" className="mt-3"><Link to="/api-keys">Manage API keys<ArrowUpRight /></Link></Button></section>
    <section className="mt-8 border-t pt-6"><h2 className="flex items-center gap-3 text-lg font-semibold"><Terminal size={20} className="text-primary" />3. Send a request</h2><p className="mt-3 text-sm text-muted-foreground">Examples use your published endpoint. Replace the sample key and model with your own values; do not commit keys.</p>
      <CodeSnippet label="Environment" code={`export TOPEROUTER_API_KEY="tr-REPLACE_WITH_YOUR_KEY"\nexport TOPEROUTER_MODEL="openrouter/openai/gpt-4o-mini"`} />
      <CodeSnippet label="Chat completions" code={`curl '${base}/chat/completions' \\\n  -H "Authorization: Bearer $TOPEROUTER_API_KEY" \\\n  -H 'Content-Type: application/json' \\\n  -d '{"model":"openrouter/openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'`} />
    </section>
    <section className="mt-9 border-t pt-6"><h2 className="text-lg font-semibold">Tool setup guides</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{([
      { to: "/docs/opencode", title: "OpenCode", subtitle: "Direct OpenAI-compatible provider" },
      { to: "/docs/hermes-agent", title: "Hermes Agent", subtitle: "Custom endpoint and model" },
      { to: "/docs/claude-code", title: "Claude Code", subtitle: "Anthropic protocol adapter required" },
      { to: "/docs/codex-cli", title: "Codex CLI", subtitle: "Responses API compatibility notes" },
    ] as const).map(({ to, title, subtitle }) => <Button asChild variant="outline" className="h-auto justify-between p-4 text-left" key={to}><Link to={to}><span><span className="block">{title}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{subtitle}</span></span><ArrowUpRight /></Link></Button>)}</div></section>
    <section className="mt-9 border-t pt-6"><h2 className="text-lg font-semibold">API reference</h2><dl className="mt-4 space-y-5 text-sm"><div><dt className="font-mono font-semibold">POST /api/public/v1/chat/completions</dt><dd className="mt-2 leading-6 text-muted-foreground">OpenAI-compatible chat requests, including streaming. Send a Bearer Toperouter key. Direct <code>slug/model</code> routing comes first, then matching routing rules by priority, otherwise enabled gateways by measured latency. Retryable upstream failures (429 and 5xx) trigger failover where alternative candidates exist.</dd></div><div><dt className="font-mono font-semibold">GET /api/public/v1/models</dt><dd className="mt-2 leading-6 text-muted-foreground">Lists available models from connected gateways. Requires your Toperouter key.</dd></div></dl><CodeSnippet label="List models" code={`curl '${base}/models' \\\n  -H "Authorization: Bearer $TOPEROUTER_API_KEY"`} /></section>
    <section className="mt-9 border-t pt-6"><h2 className="text-lg font-semibold">Troubleshooting</h2><ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground"><li><strong className="text-foreground">401:</strong> Check your Toperouter key is correct and has not been revoked.</li><li><strong className="text-foreground">No gateway / model error:</strong> Enable the gateway, rerun its connection test, and check the exact upstream model ID.</li><li><strong className="text-foreground">429 or 5xx:</strong> Check upstream rate limits, balance, and availability. Inspect usage logs for the selected gateway.</li><li><strong className="text-foreground">404 for /messages or /responses:</strong> Toperouter currently exposes Chat Completions, not those protocols. See the relevant tool’s compatibility guide.</li></ul></section>
  </>;
}
