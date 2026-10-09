import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Gateways } from "@/components/ConsoleViews";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/gateways")({
  head: () => pageMeta("Gateways", "Connect and test your upstream AI gateways."),
  component: Page,
});
function Page() {
  return <ConsoleShell title="Gateways" description="Connect and test your upstream AI gateways."><Gateways /></ConsoleShell>;
}
