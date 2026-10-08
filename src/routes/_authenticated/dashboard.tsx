import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { GATEWAY_PRESETS } from "@/lib/gateway-presets";
import { createApiKey, createGateway, listGatewayModels, testGateway } from "@/lib/toperouter.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Console — Toperouter" },
      { name: "description", content: "Manage upstream gateways, API keys, routing and usage." },
      { property: "og:title", content: "Console — Toperouter" },
      { property: "og:description", content: "Toperouter control console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const TABS = ["Gateways", "API Keys", "Routing", "Playground", "Usage"] as const;
type Tab = (typeof TABS)[number];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("Gateways");
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="label-plate hidden sm:inline">{user.email}</span>
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <nav className="well mt-5 flex flex-wrap gap-1 p-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("btn flex-1 min-w-28", tab === t && "btn-primary")}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="mt-5">
          {tab === "Gateways" && <Gateways />}
          {tab === "API Keys" && <Keys />}
          {tab === "Routing" && <Routing />}
          {tab === "Playground" && <Playground />}
          {tab === "Usage" && <Usage />}
        </div>
      </div>
    </main>
  );
}

function useGateways() {
  return useQuery({
    queryKey: ["gateways"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gateways")
        .select("id,name,slug,provider,base_url,enabled,last_status,last_latency_ms,last_model_count,last_error,last_tested_at,created_at")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="well p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="panel p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ---------------- Gateways ---------------- */
function Gateways() {
  const qc = useQueryClient();
  const { data: gws = [], isLoading } = useGateways();
  const create = useServerFn(createGateway);
  const test = useServerFn(testGateway);
  const [preset, setPreset] = useState(GATEWAY_PRESETS[0]!);
  const [name, setName] = useState(GATEWAY_PRESETS[0]!.name);
  const [baseUrl, setBaseUrl] = useState(GATEWAY_PRESETS[0]!.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => create({ data: { name, provider: preset.provider, baseUrl, apiKey } }),
    onSuccess: async ({ id }) => {
      setApiKey("");
      toast.success("Gateway added — running connection test");
      await qc.invalidateQueries({ queryKey: ["gateways"] });
      runTest(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runTest(id: string) {
    setTesting(id);
    try {
      const r = await test({ data: { id } });
      r.status === "ok"
        ? toast.success(`Connected in ${r.latency} ms · ${r.count} models`)
        : toast.error(r.error ?? "Connection failed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(null);
      qc.invalidateQueries({ queryKey: ["gateways"] });
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await supabase.from("gateways").update({ enabled }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["gateways"] });
  }
  async function remove(id: string) {
    if (!confirm("Remove this gateway and its routing rules?")) return;
    await supabase.from("gateways").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["gateways"] });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Section title="Connect gateway">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <label className="block">
            <span className="label-plate">Provider</span>
            <select
              className="field mt-1"
              value={preset.provider}
              onChange={(e) => {
                const p = GATEWAY_PRESETS.find((x) => x.provider === e.target.value)!;
                setPreset(p);
                setName(p.provider === "custom" ? "" : p.name);
                setBaseUrl(p.baseUrl);
              }}
            >
              {GATEWAY_PRESETS.map((p) => (
                <option key={p.provider} value={p.provider}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-plate">Name</span>
            <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">
            <span className="label-plate">Base URL</span>
            <input className="field mt-1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" required />
          </label>
          <label className="block">
            <span className="label-plate">API key</span>
            <input className="field mt-1" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={preset.docs ? `from ${preset.docs}` : "sk-…"} required />
          </label>
          <button className="btn btn-primary w-full" disabled={add.isPending}>
            {add.isPending ? "Saving…" : "Add & test"}
          </button>
          <p className="text-xs text-muted-foreground">Keys are stored server-side and never returned to the browser.</p>
        </form>
      </Section>

      <Section title="Upstream gateways">
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : !gws.length ? (
          <Empty>No gateways yet. Connect your first one on the left.</Empty>
        ) : (
          <ul className="space-y-3">
            {gws.map((g) => (
              <li key={g.id} className="well p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("led", g.last_status === "ok" && "led-ok", g.last_status === "error" && "led-bad")} />
                    <div>
                      <div className="font-semibold">{g.name} <span className="font-mono text-xs text-muted-foreground">/{g.slug}</span></div>
                      <div className="font-mono text-xs text-muted-foreground">{g.base_url}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn" onClick={() => runTest(g.id)} disabled={testing === g.id}>
                      {testing === g.id ? "Testing…" : "Test"}
                    </button>
                    <button className="btn" onClick={() => toggle(g.id, !g.enabled)}>{g.enabled ? "Disable" : "Enable"}</button>
                    <button className="btn btn-danger" onClick={() => remove(g.id)}>Remove</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                  <Stat k="Latency" v={g.last_latency_ms != null ? `${g.last_latency_ms} ms` : "—"} />
                  <Stat k="Models" v={g.last_model_count ?? "—"} />
                  <Stat k="Tested" v={g.last_tested_at ? new Date(g.last_tested_at).toLocaleTimeString() : "never"} />
                </div>
                {g.last_error && <p className="mt-2 break-all font-mono text-xs text-destructive">{g.last_error}</p>}
                {!g.enabled && <p className="mt-2 label-plate">disabled — skipped by router</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="panel px-3 py-2">
      <div className="label-plate">{k}</div>
      <div className="mt-0.5 font-semibold">{v}</div>
    </div>
  );
}

/* ---------------- Keys ---------------- */
function Keys() {
  const qc = useQueryClient();
  const make = useServerFn(createApiKey);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const { data: keys = [] } = useQuery({
    queryKey: ["keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("id,name,key_prefix,revoked,last_used_at,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: () => make({ data: { name } }),
    onSuccess: ({ key }) => {
      setFresh(key);
      setName("");
      qc.invalidateQueries({ queryKey: ["keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  async function revoke(id: string) {
    await supabase.from("api_keys").update({ revoked: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["keys"] });
  }

  return (
    <Section title="Toperouter API keys">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <input className="field max-w-xs" placeholder="Key name (e.g. production)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={add.isPending}>Generate key</button>
      </form>
      {fresh && (
        <div className="well mt-4 p-4">
          <div className="label-plate">Copy now — shown only once</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="field flex-1 break-all">{fresh}</code>
            <button className="btn" onClick={() => { navigator.clipboard.writeText(fresh); toast.success("Copied"); }}>Copy</button>
          </div>
        </div>
      )}
      <div className="mt-5 space-y-2">
        {!keys.length && <Empty>No keys yet.</Empty>}
        {keys.map((k) => (
          <div key={k.id} className="well flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-3">
              <span className={cn("led", k.revoked ? "led-bad" : "led-ok")} />
              <div>
                <div className="font-semibold">{k.name}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {k.key_prefix}… · last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                </div>
              </div>
            </div>
            {!k.revoked ? <button className="btn btn-danger" onClick={() => revoke(k.id)}>Revoke</button> : <span className="label-plate">revoked</span>}
          </div>
        ))}
      </div>
      <div className="well mt-6 p-4 font-mono text-xs">
        <div className="label-plate mb-2">Endpoint</div>
        <div>POST {typeof window !== "undefined" ? window.location.origin : ""}/api/public/v1/chat/completions</div>
        <div>GET&nbsp; {typeof window !== "undefined" ? window.location.origin : ""}/api/public/v1/models</div>
      </div>
    </Section>
  );
}

/* ---------------- Routing ---------------- */
function Routing() {
  const qc = useQueryClient();
  const { data: gws = [] } = useGateways();
  const [pattern, setPattern] = useState("");
  const [gatewayId, setGatewayId] = useState("");
  const [upstream, setUpstream] = useState("");
  const [priority, setPriority] = useState(100);
  const listModels = useServerFn(listGatewayModels);
  const [models, setModels] = useState<string[]>([]);

  const { data: rules = [] } = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routing_rules").select("*").order("priority");
      if (error) throw error;
      return data;
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("routing_rules").insert({
      user_id: u.user!.id, model_pattern: pattern.trim(), gateway_id: gatewayId, upstream_model: upstream.trim() || null, priority,
    });
    if (error) { toast.error(error.message); return; }
    setPattern(""); setUpstream("");
    qc.invalidateQueries({ queryKey: ["rules"] });
  }
  async function del(id: string) {
    await supabase.from("routing_rules").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["rules"] });
  }
  async function loadModels(id: string) {
    setGatewayId(id);
    setModels([]);
    if (!id) return;
    try { setModels(await listModels({ data: { id } })); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Section title="New rule">
        {!gws.length ? <Empty>Add a gateway first.</Empty> : (
          <form className="space-y-3" onSubmit={add}>
            <label className="block"><span className="label-plate">Model pattern (glob)</span>
              <input className="field mt-1" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="deepseek-* or gpt-4o" required /></label>
            <label className="block"><span className="label-plate">Gateway</span>
              <select className="field mt-1" value={gatewayId} onChange={(e) => loadModels(e.target.value)} required>
                <option value="">Select…</option>
                {gws.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select></label>
            <label className="block"><span className="label-plate">Upstream model (optional rewrite)</span>
              <input className="field mt-1" list="upstream-models" value={upstream} onChange={(e) => setUpstream(e.target.value)} placeholder="deepseek/deepseek-chat" />
              <datalist id="upstream-models">{models.map((m) => <option key={m} value={m} />)}</datalist></label>
            <label className="block"><span className="label-plate">Priority (lower first)</span>
              <input className="field mt-1" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></label>
            <button className="btn btn-primary w-full">Add rule</button>
          </form>
        )}
      </Section>
      <Section title="Routing table">
        <div className="well mb-4 p-3 text-xs text-muted-foreground">
          Resolution order: <b>1.</b> <code>slug/model</code> targets a gateway directly · <b>2.</b> matching rules by priority, failing over on 429/5xx · <b>3.</b> otherwise all enabled gateways, fastest first.
        </div>
        {!rules.length ? <Empty>No rules — requests use automatic latency-ordered routing.</Empty> : (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="well flex flex-wrap items-center justify-between gap-3 p-3 font-mono text-xs">
                <span className="panel px-2 py-1">#{r.priority}</span>
                <span className="flex-1 font-semibold">{r.model_pattern}</span>
                <span>→ {gws.find((g) => g.id === r.gateway_id)?.name ?? "?"}{r.upstream_model ? ` : ${r.upstream_model}` : ""}</span>
                <button className="btn btn-danger" onClick={() => del(r.id)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ---------------- Playground ---------------- */
function Playground() {
  const qc = useQueryClient();
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
      setMeta(`HTTP ${res.status} · ${Math.round(performance.now() - t0)} ms · via ${res.headers.get("x-toperouter-gateway") ?? "—"}`);
      setOut(res.ok ? (j.choices?.[0]?.message?.content ?? JSON.stringify(j, null, 2)) : JSON.stringify(j, null, 2));
    } catch (err) {
      setOut((err as Error).message);
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["usage"] });
    }
  }

  return (
    <Section title="Playground">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={run}>
        <label><span className="label-plate">Toperouter key</span>
          <input className="field mt-1" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="tr-…" required /></label>
        <label><span className="label-plate">Model</span>
          <input className="field mt-1" value={model} onChange={(e) => setModel(e.target.value)} placeholder="openrouter/openai/gpt-4o-mini" required /></label>
        <label className="md:col-span-2"><span className="label-plate">Prompt</span>
          <textarea className="field mt-1 min-h-24" value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
        <div className="md:col-span-2"><button className="btn btn-primary" disabled={busy}>{busy ? "Routing…" : "Send request"}</button></div>
      </form>
      {(out || meta) && (
        <div className="well mt-5 p-4">
          <div className="label-plate">{meta}</div>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-sm">{out}</pre>
        </div>
      )}
    </Section>
  );
}

/* ---------------- Usage ---------------- */
function Usage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usage_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const ok = logs.filter((l) => l.status && l.status < 400);
  const avg = ok.length ? Math.round(ok.reduce((s, l) => s + (l.latency_ms ?? 0), 0) / ok.length) : null;
  const tokens = logs.reduce((s, l) => s + (l.prompt_tokens ?? 0) + (l.completion_tokens ?? 0), 0);

  return (
    <Section title="Usage log">
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 font-mono text-xs">
        <Stat k="Requests" v={logs.length} />
        <Stat k="Success" v={logs.length ? `${Math.round((ok.length / logs.length) * 100)}%` : "—"} />
        <Stat k="Avg latency" v={avg != null ? `${avg} ms` : "—"} />
        <Stat k="Tokens" v={tokens.toLocaleString()} />
      </div>
      {isLoading ? <Empty>Loading…</Empty> : !logs.length ? <Empty>No requests yet. Try the Playground.</Empty> : (
        <div className="well overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead><tr className="text-left">
              {["Time", "Model", "Gateway", "Status", "Latency", "Tokens"].map((h) => <th key={h} className="label-plate px-3 py-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t" title={l.error ?? ""}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{l.model}{l.upstream_model && l.upstream_model !== l.model ? ` → ${l.upstream_model}` : ""}</td>
                  <td className="px-3 py-2">{l.gateway_name}</td>
                  <td className="px-3 py-2"><span className={cn("led mr-2 align-middle", l.status && l.status < 400 ? "led-ok" : "led-bad")} />{l.status || "net"}</td>
                  <td className="px-3 py-2">{l.latency_ms} ms</td>
                  <td className="px-3 py-2">{l.stream ? "stream" : (l.prompt_tokens ?? 0) + (l.completion_tokens ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
