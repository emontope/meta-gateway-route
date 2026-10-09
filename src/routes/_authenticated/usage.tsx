import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Usage } from "@/components/ConsoleViews";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => pageMeta("Usage logs", "Inspect the latest 200 requests, latency, status, and token usage."),
  component: Page,
});
function Page() {
  return <ConsoleShell title="Usage logs" description="Inspect the latest 200 requests, latency, status, and token usage."><Usage /></ConsoleShell>;
}
