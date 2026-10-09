import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Routing } from "@/components/ConsoleViews";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/routing")({
  head: () => pageMeta("Routing", "Control model routing and upstream rewrites."),
  component: Page,
});
function Page() {
  return <ConsoleShell title="Routing" description="Control model routing and upstream rewrites."><Routing /></ConsoleShell>;
}
