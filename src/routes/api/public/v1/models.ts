import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/models")({
  server: {
    handlers: {
      OPTIONS: async () => (await import("@/lib/proxy.server")).corsPreflight(),
      GET: async ({ request }) => (await import("@/lib/proxy.server")).handleModels(request),
    },
  },
});
