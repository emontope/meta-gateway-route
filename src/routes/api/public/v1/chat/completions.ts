import { createFileRoute } from "@tanstack/react-router";

// OpenAI-compatible endpoint. Auth = Toperouter API key (verified inside handler).
export const Route = createFileRoute("/api/public/v1/chat/completions")({
  server: {
    handlers: {
      OPTIONS: async () => (await import("@/lib/proxy.server")).corsPreflight(),
      POST: async ({ request }) => (await import("@/lib/proxy.server")).handleChat(request),
    },
  },
});
