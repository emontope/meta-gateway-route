import { createFileRoute } from "@tanstack/react-router";
import { GuideContent } from "@/components/GuideContent";
import { CodeSnippet } from "@/components/CodeSnippet";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/docs/opencode")({ head: () => pageMeta("OpenCode setup", "Configure an OpenAI-compatible Toperouter provider in OpenCode with a unified API key and gateway model."), component: OpenCode });
const config = JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  provider: { toperouter: { npm: "@ai-sdk/openai-compatible", name: "Toperouter", options: { baseURL: "https://meta-gateway-route.lovable.app/api/public/v1", apiKey: "{env:TOPEROUTER_API_KEY}" }, models: { "openrouter/openai/gpt-4o-mini": { name: "GPT-4o mini via OpenRouter" } } } },
  model: "toperouter/openrouter/openai/gpt-4o-mini",
}, null, 2);
function OpenCode() { return <GuideContent name="OpenCode" status="Direct connection" intro="OpenCode supports a custom OpenAI-compatible provider. Keep your key in an environment variable and register the models you want to use." source="https://opencode.ai/docs/providers/#custom-provider">
  <section><h2 className="text-lg font-semibold">1. Set your key</h2><CodeSnippet label="Terminal" code={'export TOPEROUTER_API_KEY="tr-REPLACE_WITH_YOUR_KEY"'} /></section>
  <section><h2 className="text-lg font-semibold">2. Add your provider</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Merge this into your project’s <code>opencode.json</code> or your global <code>~/.config/opencode/opencode.json</code>. Replace the example model ID in both places with a model returned by Toperouter’s models endpoint. Select a tool-capable model for coding agents.</p><CodeSnippet label="opencode.json" code={config} /></section>
  <section><h2 className="text-lg font-semibold">3. Launch OpenCode</h2><CodeSnippet label="Launch" code="opencode" /><p className="text-sm leading-7 text-muted-foreground">The first part of the configured model is the OpenCode provider ID, <code>toperouter</code>; the remainder is your Toperouter <code>gateway/model</code> ID. Alternatively, use OpenCode’s <code>/connect</code> flow with provider ID <code>toperouter</code> to store your key instead of the environment-variable option.</p></section>
  </GuideContent>; }
