import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/ConsoleShell";
import { Billing } from "@/components/ConsoleViews";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => pageMeta("Balance & top-up", "Check your token balance, redeem codes, and request top-ups."),
  component: () => <ConsoleShell title="Balance & top-up" description="Token balance, redeem codes, and payment requests."><Billing /></ConsoleShell>,
});
