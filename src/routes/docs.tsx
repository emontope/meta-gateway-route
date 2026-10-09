import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsLayout } from "@/components/DocsLayout";
export const Route = createFileRoute("/docs")({ component: Docs });
function Docs() { return <DocsLayout><Outlet /></DocsLayout>; }
