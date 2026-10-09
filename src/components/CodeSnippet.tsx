import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CodeSnippet({ code, label = "Terminal" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Clipboard unavailable. Select and copy the snippet manually.");
    }
  }
  return <div className="code-block my-4 min-w-0">
    <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
      <span className="label-plate">{label}</span>
      <Button variant="ghost" size="sm" aria-label={`Copy ${label}`} onClick={copy}>
        {copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}
      </Button>
    </div>
    <pre className="overflow-x-auto p-4 font-mono text-xs leading-6"><code>{code}</code></pre>
  </div>;
}