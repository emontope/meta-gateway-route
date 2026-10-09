import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Playground } from "@/components/ConsoleViews";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/playground")({
  head: () => pageMeta("Playground", "Send a live request through your connected gateways."),
  component: Page,
});
function Page() {
  return <ConsoleShell title="Playground" description="Send a live request through your connected gateways."><Playground /></ConsoleShell>;
}
