import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/terms")({
  head: () => pageMeta("Terms of Service", "Conditions for using Toperouter, connecting upstream gateways, and managing API credentials."),
  component: Terms,
});

const sections = [
  ["1. Using Toperouter", "Toperouter provides a unified interface to third-party AI gateways. By using the service, you agree to these terms. If you do not agree, do not use the service. You must be legally able to enter into this agreement."],
  ["2. Your account and credentials", "You are responsible for activity on your account, your upstream gateway credentials, and your Toperouter API keys. Keep credentials confidential, revoke compromised keys promptly, and connect only gateways you are authorized to use."],
  ["3. Third-party services and costs", "Upstream gateways and model providers operate independently of Toperouter. Their terms, usage policies, pricing, and limits apply. You remain responsible for charges incurred with those providers. Model availability, outputs, and performance can change without notice."],
  ["4. Acceptable use", "Do not use the service for unlawful activity, abuse, unauthorized access, credential theft, or attempts to disrupt or bypass service security or provider limits. Do not submit content you have no right to process. Access may be restricted or suspended for abuse or security risks."],
  ["5. Requests and data", "Requests are transmitted to the upstream gateways selected by your configuration and routing. Their data-handling policies apply to submitted content. Toperouter stores gateway configuration, API key records, and request metadata such as model, status, latency, and token counts. Avoid sending sensitive information unless you have confirmed the applicable safeguards."],
  ["6. Availability and AI outputs", "The service is provided as available, without a guarantee of uninterrupted operation or error-free responses. AI outputs may be inaccurate or unsuitable. Independently review outputs before relying on them, especially for consequential decisions. Failover depends on available and functioning upstream gateways."],
  ["7. Liability", "To the extent permitted by applicable law, Toperouter is not responsible for indirect or consequential losses, third-party outages, inaccurate AI outputs, or charges arising from your use of upstream services. Nothing in these terms excludes rights or liabilities that cannot legally be excluded."],
  ["8. Ending use and changes", "You may stop using the service at any time and revoke your API keys. Access may be suspended to protect the service or address violations. These terms may be updated; material changes should be communicated before taking effect. Applicable mandatory consumer protections remain unaffected."],
] as const;

function Terms() {
  return <main className="mx-auto max-w-3xl px-5 py-12">
    <div className="label-plate">Legal / Updated October 9, 2026</div>
    <h1 className="mt-4 font-display text-3xl font-bold">Terms of Service</h1>
    <div className="well my-7 p-4 text-sm text-muted-foreground"><strong className="text-foreground">Draft for legal review.</strong> Operator identity, legal contact, and jurisdiction must be confirmed before these terms are adopted as final.</div>
    <div className="space-y-8">{sections.map(([title, text]) => <section key={title} className="border-t pt-5"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></section>)}</div>
  </main>;
}