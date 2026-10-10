import { Card } from "@/components/ui/card";
import claude from "@/assets/providers/claude-color.svg.asset.json";
import openai from "@/assets/providers/openai.svg.asset.json";
import zai from "@/assets/providers/zai.svg.asset.json";
import deepseek from "@/assets/providers/deepseek-color.svg.asset.json";
import qwen from "@/assets/providers/qwen-color.svg.asset.json";
import grok from "@/assets/providers/grok.svg.asset.json";
import gemini from "@/assets/providers/gemini-color.svg.asset.json";
import minimax from "@/assets/providers/minimax-color.svg.asset.json";
import mimo from "@/assets/providers/xiaomimimo.svg.asset.json";

const providers = [
  { name: "Claude", company: "Anthropic", family: "Claude", logo: claude },
  { name: "OpenAI", company: "OpenAI", family: "GPT · o-series", logo: openai },
  { name: "Z.ai", company: "Zhipu AI", family: "GLM", logo: zai },
  { name: "DeepSeek", company: "DeepSeek", family: "DeepSeek", logo: deepseek },
  { name: "Qwen", company: "Alibaba", family: "Qwen", logo: qwen },
  { name: "Grok", company: "xAI", family: "Grok", logo: grok },
  { name: "Gemini", company: "Google", family: "Gemini", logo: gemini },
  { name: "MiniMax", company: "MiniMax", family: "MiniMax", logo: minimax },
  { name: "MiMo", company: "Xiaomi", family: "MiMo", logo: mimo },
];

export function ProviderMatrix() {
  return <section aria-label="Model provider matrix" className="border-t py-9">
    <div className="label-plate">Model ecosystem / upstream providers</div>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
      <h2 className="font-display text-2xl font-bold">Many model families.<br />One point of connection.</h2>
      <p className="max-w-lg text-sm leading-6 text-muted-foreground">Route these model families through your connected gateways. Availability, pricing, and capabilities depend on your upstream provider and account.</p>
    </div>
    <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {providers.map(p => <Card className="provider-card min-w-0 p-4" key={p.name}>
        <div className="flex items-center gap-3"><div className="brand-plate flex size-11 shrink-0 items-center justify-center rounded-lg"><img src={p.logo.url} alt={`${p.name} logo`} width="28" height="28" className="size-7 object-contain" loading="lazy" /></div><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{p.name}</h3><p className="mt-1 text-xs text-muted-foreground">{p.company}</p></div></div>
        <div className="mt-4 border-t pt-3 font-mono text-[10px] text-muted-foreground">{p.family}</div>
      </Card>)}
    </div>
    <p className="mt-5 text-xs leading-5 text-muted-foreground">Provider marks identify their respective model families, not a partnership or a live connection. Logo assets: LobeHub Icons. MiniMax and Xiaomi MiMo are separate providers.</p>
  </section>;
}