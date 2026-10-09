import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
export function GuideContent({ name, status, intro, children, source }: { name: string; status: string; intro: string; children: ReactNode; source: string }) {
  return <><div className="label-plate">Setup guide / {status}</div><h1 className="mt-3 font-display text-3xl font-bold">{name}</h1><p className="mt-4 leading-7 text-muted-foreground">{intro}</p><div className="mt-8 space-y-7">{children}</div><a className="mt-9 inline-flex items-center gap-2 text-sm text-primary underline" href={source} target="_blank" rel="noreferrer">Official documentation<ExternalLink size={14} /></a></>;
}
