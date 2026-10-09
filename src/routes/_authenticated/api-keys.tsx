import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Keys } from "@/components/ConsoleViews";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/api-keys")({
  head: () => pageMeta("API keys", "Create, copy, and revoke your unified Toperouter keys."),
  component: Page,
});
function Page() {
  return <ConsoleShell title="API keys" description="Create, copy, and revoke your unified Toperouter keys."><Keys /></ConsoleShell>;
}
