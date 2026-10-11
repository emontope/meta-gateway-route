import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { redeemCode, regenerateApiKey, submitTopup } from "@/lib/toperouter.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/CodeSnippet";
import { ListSkeleton, UsageSkeleton } from "@/components/ConsoleSkeletons";
import { Skeleton } from "@/components/ui/skeleton";

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("profiles").select("id,telegram_username,display_name,token_balance,blocked,created_at").eq("id", u.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePublicModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const { data, error } = await supabase.from("models").select("id,slug,display_name,is_free,input_rate,output_rate").order("slug");
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).filter((m) => (seen.has(m.slug) ? false : (seen.add(m.slug), true)));
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key,value");
      if (error) throw error;
      const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value as Record<string, unknown> | undefined;
      return {
        payments: (get("payments") ?? {}) as { bkash?: string; binance_pay_id?: string; wallets?: { network: string; address: string }[]; instructions?: string },
        links: (get("links") ?? {}) as { channel?: string; group?: string },
      };
    },
  });
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="well p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="stat-readout px-3 py-4">
      <div className="label-plate">{k}</div>
      <div className="mt-0.5 font-semibold">{v}</div>
    </div>
  );
}

/* ---------------- Single API key ---------------- */
export function Keys() {
  const qc = useQueryClient();
  const regen = useServerFn(regenerateApiKey);
  const [fresh, setFresh] = useState<string | null>(null);
  const { data: key, isLoading, error } = useQuery({
    queryKey: ["keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("id,key_prefix,last_used_at,created_at").eq("revoked", false).order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const make = useMutation({
    mutationFn: () => regen(),
    onSuccess: ({ key }) => { setFresh(key); qc.invalidateQueries({ queryKey: ["keys"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Section title="Your API key">
      <p className="mb-4 text-sm text-muted-foreground">One key reaches every model on Toperouter. Generating a new key immediately disables the old one.</p>
      {error ? <Empty>Unable to load your key. Please try again.</Empty> : isLoading ? <ListSkeleton rows={1} /> : key ? (
        <div className="well content-reveal flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3"><span className="led led-ok" /><div>
            <div className="font-mono font-semibold">{key.key_prefix}…</div>
            <div className="text-xs text-muted-foreground">Created {new Date(key.created_at).toLocaleDateString()} · last used {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "never"}</div>
          </div></div>
          <Button variant="outline" className="btn" disabled={make.isPending} onClick={() => confirm("Replace your key? Apps using the old key will stop working.") && make.mutate()}>Regenerate</Button>
        </div>
      ) : (
        <Empty>You don't have a key yet.<div className="mt-4"><Button onClick={() => make.mutate()} disabled={make.isPending}>Generate my key</Button></div></Empty>
      )}
      {fresh && <div className="mt-5"><div className="label-plate">Copy now — shown only once</div><CodeSnippet code={fresh} label="Your API key" /><Button variant="outline" onClick={() => setFresh(null)}>I've saved it</Button></div>}
      <div className="well mt-6 break-all p-4 font-mono text-xs">
        <div className="label-plate mb-2">OpenAI-compatible base URL</div>
        <div>{origin}/api/public/v1</div>
      </div>
    </Section>
  );
}

/* ---------------- Models & pricing ---------------- */
export function ModelsList() {
  const { data: models = [], isLoading, error } = usePublicModels();
  return (
    <Section title="Models & pricing">
      <p className="mb-4 text-sm text-muted-foreground">Prices are in Toperouter tokens charged per model token. A rate of 1 means one balance token per model token. Free models cost nothing but still require a positive balance.</p>
      {error ? <Empty>Unable to load models.</Empty> : isLoading ? <ListSkeleton /> : !models.length ? <Empty>No models have been published yet.</Empty> : (
        <div className="well content-reveal overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead><tr className="text-left">{["Model ID", "Name", "Plan", "Input ×", "Output ×"].map((h) => <th key={h} className="label-plate px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>{models.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 font-semibold">{m.slug}</td>
                <td className="px-3 py-2">{m.display_name}</td>
                <td className="px-3 py-2">{m.is_free ? <span className="text-primary">Free</span> : "Pay as you go"}</td>
                <td className="px-3 py-2">{m.is_free ? "0" : Number(m.input_rate)}</td>
                <td className="px-3 py-2">{m.is_free ? "0" : Number(m.output_rate)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ---------------- Billing ---------------- */
export function Billing() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useProfile();
  const { data: settings } = useSettings();
  const redeem = useServerFn(redeemCode);
  const topup = useServerFn(submitTopup);
  const [code, setCode] = useState("");
  const [method, setMethod] = useState("bkash");
  const [amount, setAmount] = useState("");
  const [txRef, setTxRef] = useState("");
  const [tokens, setTokens] = useState("");
  const { data: requests = [] } = useQuery({
    queryKey: ["topups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("topup_requests").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });
  const doRedeem = useMutation({
    mutationFn: () => redeem({ data: { code } }),
    onSuccess: ({ tokens }) => { toast.success(`${fmt(tokens)} tokens added`); setCode(""); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const doTopup = useMutation({
    mutationFn: () => topup({ data: { method, amount, txRef, tokens: tokens ? Number(tokens) : null } }),
    onSuccess: () => { toast.success("Request sent for review"); setAmount(""); setTxRef(""); setTokens(""); qc.invalidateQueries({ queryKey: ["topups"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const p = settings?.payments ?? {};

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel p-6">
          <div className="label-plate">Token balance</div>
          <div className="mt-3 font-display text-4xl font-bold">{isLoading ? <Skeleton className="h-10 w-40" /> : fmt(profile?.token_balance)}</div>
          {!isLoading && (profile?.token_balance ?? 0) <= 0 && <p className="mt-2 text-sm text-destructive">Balance is 0 — requests are blocked until you top up or redeem a code.</p>}
        </div>
        <form className="panel p-6" onSubmit={(e) => { e.preventDefault(); doRedeem.mutate(); }}>
          <div className="label-plate">Redeem code</div>
          <div className="mt-3 flex gap-2">
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="TR-XXXXXXXXXX" required />
            <Button disabled={doRedeem.isPending}>Redeem</Button>
          </div>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="How to pay">
          <div className="space-y-3 text-sm">
            {p.bkash && <div className="well p-4"><div className="label-plate">bKash</div><div className="mt-1 font-mono">{p.bkash}</div></div>}
            {p.binance_pay_id && <div className="well p-4"><div className="label-plate">Binance Pay ID</div><div className="mt-1 font-mono">{p.binance_pay_id}</div></div>}
            {(p.wallets ?? []).map((w) => <div key={w.address} className="well p-4"><div className="label-plate">{w.network}</div><div className="mt-1 break-all font-mono">{w.address}</div></div>)}
            {p.instructions && <p className="whitespace-pre-wrap text-muted-foreground">{p.instructions}</p>}
            {!p.bkash && !p.binance_pay_id && !(p.wallets ?? []).length && <Empty>Payment details haven't been published yet.</Empty>}
          </div>
        </Section>
        <Section title="Request a top-up">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); doTopup.mutate(); }}>
            <label className="block"><span className="label-plate">Method</span>
              <select className="field mt-1" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="bkash">bKash</option><option value="binance">Binance Pay</option><option value="crypto">Crypto wallet</option>
              </select></label>
            <label className="block"><span className="label-plate">Amount paid</span><input className="field mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500 BDT or 5 USDT" required /></label>
            <label className="block"><span className="label-plate">Transaction ID / reference</span><input className="field mt-1" value={txRef} onChange={(e) => setTxRef(e.target.value)} required /></label>
            <label className="block"><span className="label-plate">Tokens requested (optional)</span><input className="field mt-1" type="number" min={1} value={tokens} onChange={(e) => setTokens(e.target.value)} /></label>
            <Button className="w-full" disabled={doTopup.isPending}>Submit for review</Button>
            <p className="text-xs text-muted-foreground">An admin checks each payment and credits your balance by hand.</p>
          </form>
        </Section>
      </div>

      <Section title="Your top-up requests">
        {!requests.length ? <Empty>No requests yet.</Empty> : <div className="space-y-2">{requests.map((r) => (
          <div key={r.id} className="well flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <span className="font-mono text-xs">{new Date(r.created_at).toLocaleString()}</span>
            <span>{r.method} · {r.amount}</span>
            <span className={cn("label-plate", r.status === "approved" && "text-primary", r.status === "rejected" && "text-destructive")}>{r.status}{r.tokens_granted ? ` · +${fmt(r.tokens_granted)}` : ""}</span>
          </div>
        ))}</div>}
      </Section>
    </div>
  );
}

/* ---------------- Playground ---------------- */
export function Playground() {
  const qc = useQueryClient();
  const { data: models = [] } = usePublicModels();
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("Say hello in five words.");
  const [out, setOut] = useState("");
  const [meta, setMeta] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setOut(""); setMeta("");
    const t0 = performance.now();
    try {
      const res = await fetch("/api/public/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.trim()}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
      });
      const j = await res.json();
      const bal = res.headers.get("x-toperouter-balance");
      setMeta(`HTTP ${res.status} · ${Math.round(performance.now() - t0)} ms${bal ? ` · balance ${fmt(Number(bal))}` : ""}`);
      setOut(res.ok ? (j.choices?.[0]?.message?.content ?? JSON.stringify(j, null, 2)) : JSON.stringify(j, null, 2));
    } catch (err) {
      setOut((err as Error).message);
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["usage"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  }

  return (
    <Section title="Playground">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={run}>
        <label><span className="label-plate">Your API key</span>
          <input className="field mt-1" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="tr-…" required /></label>
        <label><span className="label-plate">Model</span>
          <select className="field mt-1" value={model} onChange={(e) => setModel(e.target.value)} required>
            <option value="">{models.length ? "Select a model…" : "No models published yet"}</option>
            {models.map((m) => <option key={m.id} value={m.slug}>{m.display_name} ({m.slug}){m.is_free ? " · free" : ""}</option>)}
          </select></label>
        <label className="md:col-span-2"><span className="label-plate">Prompt</span>
          <textarea className="field mt-1 min-h-24" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
        <div className="md:col-span-2"><Button variant="outline" className="btn btn-primary" disabled={busy}>{busy ? "Routing…" : "Send request"}</Button></div>
      </form>
      {(out || meta) && (
        <div className="well mt-5 p-4">
          <div className="label-plate">{meta}</div>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm">{out}</pre>
        </div>
      )}
    </Section>
  );
}

/* ---------------- Usage ---------------- */
export function Usage() {
  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usage_logs").select("id,created_at,model,status,latency_ms,prompt_tokens,completion_tokens,cost_tokens,stream").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const ok = logs.filter((l) => l.status && l.status < 400);
  const avg = ok.length ? Math.round(ok.reduce((s, l) => s + (l.latency_ms ?? 0), 0) / ok.length) : null;
  const spent = logs.reduce((s, l) => s + Number(l.cost_tokens ?? 0), 0);
  const sk = <Skeleton className="mt-2 h-4 w-16" />;

  return (
    <Section title="Usage log">
      <div className="mb-4 grid grid-cols-2 gap-2 font-mono text-xs md:grid-cols-4">
        <Stat k="Requests" v={isLoading ? sk : logs.length} />
        <Stat k="Success" v={isLoading ? sk : logs.length ? `${Math.round((ok.length / logs.length) * 100)}%` : "—"} />
        <Stat k="Avg latency" v={isLoading ? sk : avg != null ? `${avg} ms` : "—"} />
        <Stat k="Tokens spent" v={isLoading ? sk : fmt(spent)} />
      </div>
      {error ? <Empty>Unable to load usage logs. Please try again.</Empty> : isLoading ? <UsageSkeleton /> : !logs.length ? <Empty>No requests yet. Try the Playground.</Empty> : (
        <div className="well content-reveal overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead><tr className="text-left">{["Time", "Model", "Status", "Latency", "In / Out", "Cost"].map((h) => <th key={h} className="label-plate px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>{logs.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="whitespace-nowrap px-3 py-2">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{l.model}</td>
                <td className="px-3 py-2"><span className={cn("led mr-2 align-middle", l.status && l.status < 400 ? "led-ok" : "led-bad")} />{l.status || "net"}</td>
                <td className="px-3 py-2">{l.latency_ms} ms</td>
                <td className="px-3 py-2">{fmt(l.prompt_tokens)} / {fmt(l.completion_tokens)}</td>
                <td className="px-3 py-2">{fmt(Number(l.cost_tokens))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
