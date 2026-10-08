export type GatewayPreset = { provider: string; name: string; baseUrl: string; docs: string };

export const GATEWAY_PRESETS: GatewayPreset[] = [
  { provider: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", docs: "openrouter.ai/keys" },
  { provider: "zenmux", name: "ZenMux", baseUrl: "https://zenmux.ai/api/v1", docs: "zenmux.ai" },
  { provider: "deepinfra", name: "DeepInfra", baseUrl: "https://api.deepinfra.com/v1/openai", docs: "deepinfra.com/dash/api_keys" },
  { provider: "together", name: "Together AI", baseUrl: "https://api.together.xyz/v1", docs: "api.together.ai/settings/api-keys" },
  { provider: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", docs: "console.groq.com/keys" },
  { provider: "fireworks", name: "Fireworks", baseUrl: "https://api.fireworks.ai/inference/v1", docs: "fireworks.ai/account/api-keys" },
  { provider: "custom", name: "Custom (OpenAI-compatible)", baseUrl: "", docs: "" },
];

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "gw";
}
