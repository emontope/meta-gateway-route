import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Toperouter — One key for every AI gateway" },
      { name: "description", content: "Aggregate OpenRouter, ZenMux, DeepInfra, Together and more behind one OpenAI-compatible API key." },
      { property: "og:title", content: "Toperouter — AI Meta-Gateway" },
      { property: "og:description", content: "Bring your gateway keys, get one unified OpenAI-compatible endpoint with failover and latency tests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const layers = [
  { t: "Toperouter", d: "One key. One endpoint. OpenAI-compatible /v1/chat/completions." },
  { t: "Upstream gateways", d: "OpenRouter, ZenMux, DeepInfra, Together, Groq, Fireworks or any compatible URL — your keys." },
  { t: "Models", d: "OpenAI, Anthropic, DeepSeek, Qwen, Llama — whatever your gateways serve." },
];

function Index() {
  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <section className="panel p-8 md:p-14">
          <Logo size="xl" />
          <p className="mt-10 max-w-2xl text-lg text-muted-foreground">
            A meta-gateway that sits on top of the AI gateways you already pay for. Add their keys, test their latency,
            and route every request through one Toperouter key with automatic failover.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="btn btn-primary px-6 py-3 text-base">Open console</Link>
            <a href="#how" className="btn px-6 py-3 text-base">How it works</a>
          </div>
        </section>

        <section id="how" className="mt-8 grid gap-4 md:grid-cols-3">
          {layers.map((l, i) => (
            <div key={l.t} className="panel p-6">
              <div className="label-plate">Layer 0{i + 1}</div>
              <h2 className="mt-2 font-display text-xl font-bold">{l.t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{l.d}</p>
            </div>
          ))}
        </section>

        <section className="panel mt-8 p-6">
          <div className="label-plate mb-3">Drop-in usage</div>
          <pre className="well overflow-x-auto p-4 font-mono text-xs leading-relaxed">{`curl https://<your-app>/api/public/v1/chat/completions \\
  -H "Authorization: Bearer tr-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openrouter/deepseek/deepseek-chat","messages":[{"role":"user","content":"hi"}]}'`}</pre>
        </section>
      </div>
    </main>
  );
}
