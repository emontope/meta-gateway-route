import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/ConsoleShell";
import { ModelsList } from "@/components/ConsoleViews";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/models")({
  head: () => pageMeta("Models & pricing", "Available Toperouter models with free and pay-as-you-go token pricing."),
  component: () => <ConsoleShell title="Models & pricing" description="Every model you can call with your single key."><ModelsList /></ConsoleShell>,
});
