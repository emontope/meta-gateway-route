import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Activity, Bot, Boxes, Cable, Coins, Gift, LayoutDashboard, Link2, LogOut, ShieldCheck, Users, Wallet } from "lucide-react";
import * as A from "@/lib/admin.functions";
import { GATEWAY_PRESETS } from "@/lib/gateway-presets";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ConsoleSkeletons";
import { Empty, Section, Stat, fmt } from "@/components/ConsoleViews";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Toperouter" },
      { name: "description", content: "Toperouter operator console." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin — Toperouter" },
      { property: "og:description", content: "Toperouter operator console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "gateways", label: "Gateways & vault", icon: Cable },
  { id: "models", label: "Models & pricing", icon: Boxes },
  { id: "users", label: "Users & balances", icon: Users },
  { id: "topups", label: "Top-ups", icon: Wallet },
  { id: "codes", label: "Redeem codes", icon: Gift },
  { id: "logs", label: "Request logs", icon: Activity },
  { id: "settings", label: "Payments & links", icon: Link2 },
  { id: "telegram", label: "Telegram & webhook", icon: Bot },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const;
type Tab = (typeof TABS)[number]["id"];

const onErr = (e: Error) => toast.error(e.message);

function AdminPage() {
  const status = useServerFn(A.adminStatus);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-status"], queryFn: () => status() });
  if (isLoading) return <main className="mx-auto max-w-md px-4 py-16"><ListSkeleton rows={1} /></main>;
  if (!data?.authed) return <PinGate onDone={() => refetch()} />;
  return <AdminConsole onLogout={() => refetch()} />;
}

function PinGate({ onDone }: { onDone: () => void }) {
  const login = useServerFn(A.adminLogin);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => login({ data: { pin } }),
    onSuccess: () => { setPin(""); onDone(); },
    onError: (e: Error) => { setPin(""); setErr(e.message); },
  });
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <form className="panel w-full max-w-sm p-8" onSubmit={(e) => { e.preventDefault(); setErr(null); m.mutate(); }}>
        <ShieldCheck className="text-primary" size={28} />
        <h1 className="mt-5 font-display text-2xl font-bold">Operator access</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the admin PIN. 5 wrong attempts lock access for 15 minutes.</p>
        <input className="field mt-6 text-center font-mono text-2xl tracking-[0.5em]" type="password" inputMode="numeric" autoComplete="off" maxLength={12} value={pin} onChange={(e) => setPin(e.target.value)} autoFocus required />
        <Button className="mt-4 w-full" disabled={m.isPending || !pin}>{m.isPending ? "Checking…" : "Unlock"}</Button>
        {err && <p className={cn("mt-4 text-sm", "text-destructive")}>{err}</p>}
      </form>
    </main>
  );
}

function AdminConsole({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const logout = useServerFn(A.adminLogout);
  const qc = useQueryClient();
  async function out() {
    await logout();
    qc.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("a-") });
    onLogout();
  }
  const T = TABS.find((t) => t.id === tab)!;
  return (
    <main className="mx-auto grid max-w-7xl gap-7 px-5 py-8 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="console-sidebar">
        <div className="label-plate mb-4 px-3">Admin / Control room</div>
        <nav className="flex flex-wrap gap-2 md:flex-col">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={cn("console-link text-left", tab === id && "console-link-active")}><Icon size={17} />{label}</button>
          ))}
        </nav>
        <div className="mt-6 border-t pt-4"><Button variant="ghost" onClick={out} className="justify-start"><LogOut />Lock admin</Button></div>
      </aside>
      <div className="content-reveal min-w-0">
        <div className="mb-7"><div className="label-plate mb-2">Toperouter admin</div><h1 className="font-display text-2xl font-bold sm:text-3xl">{T.label}</h1></div>
        {tab === "overview" && <Overview />}
        {tab === "gateways" && <Gateways />}
        {tab === "models" && <Models />}
        {tab === "users" && <UsersTab />}
        {tab === "topups" && <Topups />}
        {tab === "codes" && <Codes />}
        {tab === "logs" && <Logs />}
        {tab === "settings" && <SettingsTab />}
        {tab === "telegram" && <TelegramTab />}
        {tab === "security" && <Security onLogout={onLogout} />}
      </div>
    </main>
  );
}

/* ---------- Overview ---------- */
function Overview() {
  const ov = useServerFn(A.adminOverview);
  const tgs = useServerFn(A.adminTelegramStatus);
  const { data, isLoading } = useQuery({ queryKey: ["a-overview"], queryFn: () => ov() });
  const { data: t } = useQuery({ queryKey: ["a-tg"], queryFn: () => tgs() });
  if (isLoading || !data) return <ListSkeleton />;
  const botOk = t?.ok && t.webhook?.url === t.expectedUrl;
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-xs md:grid-cols-3">
      <Stat k="Registered users" v={fmt(data.users)} />
      <Stat k="Tokens burned (last 5k req.)" v={fmt(data.burned)} />
      <Stat k="Pending top-ups" v={fmt(data.pendingTopups)} />
      <Stat k="Recent requests" v={fmt(data.requests)} />
      <Stat k="Recent errors" v={fmt(data.errors)} />
      <Stat k="Bot status" v={!t ? "…" : botOk ? <span className="text-primary">@{t.bot?.username} · live</span> : <span className="text-destructive">{t.ok ? "Webhook not set" : "Offline"}</span>} />
    </div>
  );
}

/* ---------- Gateways ---------- */
type GwRow = Awaited<ReturnType<typeof A.adminListGateways>>[number];
function Gateways() {
  const qc = useQueryClient();
  const list = useServerFn(A.adminListGateways);
  const save = useServerFn(A.adminSaveGateway);
  const toggle = useServerFn(A.adminToggleGateway);
  const del = useServerFn(A.adminDeleteGateway);
  const test = useServerFn(A.adminTestGateway);
  const { data: gws = [], isLoading } = useQuery({ queryKey: ["a-gw"], queryFn: () => list() });
  const blank = { id: "", provider: GATEWAY_PRESETS[0]!.provider, name: GATEWAY_PRESETS[0]!.name, baseUrl: GATEWAY_PRESETS[0]!.baseUrl, apiKey: "" };
  const [f, setF] = useState(blank);
  const [testing, setTesting] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["a-gw"] });

  const m = useMutation({
    mutationFn: () => save({ data: { id: f.id || undefined, name: f.name, provider: f.provider, baseUrl: f.baseUrl, apiKey: f.apiKey || undefined } }),
    onSuccess: ({ id }) => { toast.success("Gateway saved"); setF(blank); refresh(); runTest(id); },
    onError: onErr,
  });
  async function runTest(id: string) {
    setTesting(id);
    try {
      const r = await test({ data: { id } });
      r.status === "ok" ? toast.success(`Connected · ${r.latency} ms · ${r.count} models`) : toast.error(r.error ?? "Failed");
    } catch (e) { onErr(e as Error); } finally { setTesting(null); refresh(); }
  }
  function edit(g: GwRow) { setF({ id: g.id, provider: g.provider, name: g.name, baseUrl: g.base_url, apiKey: "" }); }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Section title={f.id ? "Edit gateway" : "Add gateway"}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <label className="block"><span className="label-plate">Preset</span>
            <select className="field mt-1" value={f.provider} onChange={(e) => { const p = GATEWAY_PRESETS.find((x) => x.provider === e.target.value)!; setF({ ...f, provider: p.provider, name: f.id ? f.name : p.provider === "custom" ? "" : p.name, baseUrl: p.baseUrl || f.baseUrl }); }}>
              {GATEWAY_PRESETS.map((p) => <option key={p.provider} value={p.provider}>{p.name}</option>)}
            </select></label>
          <label className="block"><span className="label-plate">Name</span><input className="field mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
          <label className="block"><span className="label-plate">Base URL</span><input className="field mt-1" value={f.baseUrl} onChange={(e) => setF({ ...f, baseUrl: e.target.value })} placeholder="https://…/v1" required /></label>
          <label className="block"><span className="label-plate">API key {f.id && "(leave blank to keep)"}</span><input className="field mt-1" type="password" autoComplete="off" value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} required={!f.id} /></label>
          <div className="flex gap-2"><Button className="flex-1" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save & test"}</Button>{f.id && <Button type="button" variant="outline" onClick={() => setF(blank)}>Cancel</Button>}</div>
          <p className="text-xs text-muted-foreground">Keys are stored server-side and never sent back to the browser.</p>
        </form>
      </Section>
      <Section title="Upstream gateways">
        {isLoading ? <ListSkeleton /> : !gws.length ? <Empty>No gateways yet.</Empty> : (
          <ul className="space-y-3">{gws.map((g) => (
            <li key={g.id} className="well p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3"><span className={cn("led", g.last_status === "ok" && "led-ok", g.last_status === "error" && "led-bad")} />
                  <div><div className="font-semibold">{g.name} <span className="font-mono text-xs text-muted-foreground">/{g.slug}</span></div>
                    <div className="break-all font-mono text-xs text-muted-foreground">{g.base_url} · key {g.key_hint}</div></div></div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => runTest(g.id)} disabled={testing === g.id}>{testing === g.id ? "Testing…" : "Test"}</Button>
                  <Button variant="outline" size="sm" onClick={() => edit(g)}>Edit</Button>
                  <Button variant="outline" size="sm" onClick={async () => { try { await toggle({ data: { id: g.id, enabled: !g.enabled } }); refresh(); } catch (e) { onErr(e as Error); } }}>{g.enabled ? "Disable" : "Enable"}</Button>
                  <Button variant="outline" size="sm" className="btn-danger" onClick={async () => { if (!confirm("Delete gateway and its models?")) return; try { await del({ data: { id: g.id } }); refresh(); } catch (e) { onErr(e as Error); } }}>Delete</Button>
                </div>
              </div>
              <div className="mt-2 font-mono text-xs text-muted-foreground">{g.last_latency_ms != null ? `${g.last_latency_ms} ms` : "untested"} · {g.last_model_count ?? "—"} models{!g.enabled && " · disabled"}</div>
              {g.last_error && <p className="mt-1 break-all font-mono text-xs text-destructive">{g.last_error}</p>}
            </li>
          ))}</ul>
        )}
      </Section>
    </div>
  );
}

/* ---------- Models ---------- */
function Models() {
  const qc = useQueryClient();
  const list = useServerFn(A.adminListModels);
  const gwl = useServerFn(A.adminListGateways);
  const save = useServerFn(A.adminSaveModel);
  const del = useServerFn(A.adminDeleteModel);
  const test = useServerFn(A.adminTestGateway);
  const { data: models = [], isLoading } = useQuery({ queryKey: ["a-models"], queryFn: () => list() });
  const { data: gws = [] } = useQuery({ queryKey: ["a-gw"], queryFn: () => gwl() });
  const blank = { id: "", slug: "", displayName: "", gatewayId: "", upstreamModel: "", isFree: false, inputRate: 1, outputRate: 1, priority: 100, enabled: true };
  const [f, setF] = useState(blank);
  const [upstream, setUpstream] = useState<string[]>([]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["a-models"] });
  const m = useMutation({
    mutationFn: () => save({ data: { ...f, id: f.id || undefined } }),
    onSuccess: () => { toast.success("Model saved"); setF(blank); refresh(); },
    onError: onErr,
  });
  async function pickGw(id: string) {
    setF({ ...f, gatewayId: id }); setUpstream([]);
    if (id) try { setUpstream((await test({ data: { id } })).models); } catch { /* optional */ }
  }
  type M = (typeof models)[number];
  const edit = (x: M) => setF({ id: x.id, slug: x.slug, displayName: x.display_name, gatewayId: x.gateway_id, upstreamModel: x.upstream_model, isFree: x.is_free, inputRate: Number(x.input_rate), outputRate: Number(x.output_rate), priority: x.priority, enabled: x.enabled });

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Section title={f.id ? "Edit model" : "Add model"}>
        {!gws.length ? <Empty>Add a gateway first.</Empty> : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
            <label className="block"><span className="label-plate">Public model ID</span><input className="field mt-1" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="deepseek-chat" required /></label>
            <label className="block"><span className="label-plate">Display name</span><input className="field mt-1" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></label>
            <label className="block"><span className="label-plate">Gateway</span>
              <select className="field mt-1" value={f.gatewayId} onChange={(e) => pickGw(e.target.value)} required><option value="">Select…</option>{gws.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label className="block"><span className="label-plate">Upstream model name</span><input className="field mt-1" list="a-up" value={f.upstreamModel} onChange={(e) => setF({ ...f, upstreamModel: e.target.value })} required /><datalist id="a-up">{upstream.map((u) => <option key={u} value={u} />)}</datalist></label>
            <div className="grid grid-cols-3 gap-2">
              <label><span className="label-plate">Input ×</span><input className="field mt-1" type="number" step="any" min={0} value={f.inputRate} onChange={(e) => setF({ ...f, inputRate: Number(e.target.value) })} disabled={f.isFree} /></label>
              <label><span className="label-plate">Output ×</span><input className="field mt-1" type="number" step="any" min={0} value={f.outputRate} onChange={(e) => setF({ ...f, outputRate: Number(e.target.value) })} disabled={f.isFree} /></label>
              <label><span className="label-plate">Priority</span><input className="field mt-1" type="number" value={f.priority} onChange={(e) => setF({ ...f, priority: Number(e.target.value) })} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isFree} onChange={(e) => setF({ ...f, isFree: e.target.checked })} />Free model</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Enabled</label>
            <div className="flex gap-2"><Button className="flex-1" disabled={m.isPending}>Save model</Button>{f.id && <Button type="button" variant="outline" onClick={() => setF(blank)}>Cancel</Button>}</div>
            <p className="text-xs text-muted-foreground">Rates = balance tokens charged per model token. Same model ID on several gateways = failover by priority.</p>
          </form>
        )}
      </Section>
      <Section title="Catalog">
        {isLoading ? <ListSkeleton /> : !models.length ? <Empty>No models yet.</Empty> : (
          <div className="well overflow-x-auto"><table className="w-full font-mono text-xs">
            <thead><tr className="text-left">{["Model", "Gateway → upstream", "Plan", "In/Out", "Pri", ""].map((h) => <th key={h} className="label-plate px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>{models.map((x) => (
              <tr key={x.id} className={cn("border-t", !x.enabled && "opacity-50")}>
                <td className="px-3 py-2 font-semibold">{x.slug}<div className="font-normal text-muted-foreground">{x.display_name}</div></td>
                <td className="px-3 py-2">{gws.find((g) => g.id === x.gateway_id)?.name ?? "?"} → {x.upstream_model}</td>
                <td className="px-3 py-2">{x.is_free ? "Free" : "PAYG"}</td>
                <td className="px-3 py-2">{x.is_free ? "0/0" : `${Number(x.input_rate)}/${Number(x.output_rate)}`}</td>
                <td className="px-3 py-2">{x.priority}</td>
                <td className="whitespace-nowrap px-3 py-2"><Button size="sm" variant="ghost" onClick={() => edit(x)}>Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (!confirm("Delete model?")) return; try { await del({ data: { id: x.id } }); refresh(); } catch (e) { onErr(e as Error); } }}>Delete</Button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Section>
    </div>
  );
}

/* ---------- Users ---------- */
function UsersTab() {
  const qc = useQueryClient();
  const list = useServerFn(A.adminListUsers);
  const adjust = useServerFn(A.adminAdjustBalance);
  const block = useServerFn(A.adminSetBlocked);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data: users = [], isLoading } = useQuery({ queryKey: ["a-users", search], queryFn: () => list({ data: { q: search } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["a-users"] });
  async function change(id: string, sign: 1 | -1) {
    const v = prompt(sign > 0 ? "Tokens to grant:" : "Tokens to deduct:");
    const n = Math.floor(Number(v));
    if (!v || !(n > 0)) return;
    try { await adjust({ data: { userId: id, delta: sign * n } }); toast.success("Balance updated"); refresh(); } catch (e) { onErr(e as Error); }
  }
  return (
    <Section title="Users">
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
        <input className="field max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Telegram ID, username or name" />
        <Button>Search</Button>
      </form>
      {isLoading ? <ListSkeleton /> : !users.length ? <Empty>No users found.</Empty> : (
        <div className="space-y-2">{users.map((u) => (
          <div key={u.id} className="well flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3"><span className={cn("led", u.blocked ? "led-bad" : "led-ok")} />
              <div><div className="font-semibold">{u.display_name ?? "—"} {u.telegram_username && <span className="text-xs text-muted-foreground">@{u.telegram_username}</span>}</div>
                <div className="font-mono text-xs text-muted-foreground">TG {u.telegram_id ?? "—"} · joined {new Date(u.created_at).toLocaleDateString()}</div></div></div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{fmt(u.token_balance)}</span>
              <Button size="sm" variant="outline" onClick={() => change(u.id, 1)}>Grant</Button>
              <Button size="sm" variant="outline" onClick={() => change(u.id, -1)}>Deduct</Button>
              <Button size="sm" variant="outline" className={u.blocked ? "" : "btn-danger"} onClick={async () => { if (!u.blocked && !confirm("Ban user? Their API key is revoked.")) return; try { await block({ data: { userId: u.id, blocked: !u.blocked } }); refresh(); } catch (e) { onErr(e as Error); } }}>{u.blocked ? "Unban" : "Ban"}</Button>
            </div>
          </div>
        ))}</div>
      )}
    </Section>
  );
}

/* ---------- Top-ups ---------- */
function Topups() {
  const qc = useQueryClient();
  const list = useServerFn(A.adminListTopups);
  const review = useServerFn(A.adminReviewTopup);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["a-topups"], queryFn: () => list() });
  async function act(r: (typeof rows)[number], approve: boolean) {
    let tokens: number | undefined;
    if (approve) {
      const v = prompt("Tokens to credit:", r.tokens_requested ? String(r.tokens_requested) : "");
      tokens = Math.floor(Number(v));
      if (!v || !(tokens > 0)) return;
    }
    const note = prompt("Admin note (optional):") ?? "";
    try { await review({ data: { id: r.id, approve, tokens, note } }); toast.success(approve ? "Approved & credited" : "Rejected"); qc.invalidateQueries({ queryKey: ["a-topups"] }); } catch (e) { onErr(e as Error); }
  }
  return (
    <Section title="Deposit requests">
      {isLoading ? <ListSkeleton /> : !rows.length ? <Empty>No requests yet.</Empty> : (
        <div className="space-y-2">{rows.map((r) => (
          <div key={r.id} className="well flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div><div className="font-semibold">{r.user?.display_name ?? "User"} {r.user?.telegram_username && <span className="text-xs text-muted-foreground">@{r.user.telegram_username}</span>}</div>
              <div className="font-mono text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.method} · {r.amount} · ref <span className="break-all">{r.tx_ref}</span>{r.tokens_requested ? ` · wants ${fmt(r.tokens_requested)}` : ""}</div>
              {r.admin_note && <div className="text-xs text-muted-foreground">Note: {r.admin_note}</div>}</div>
            {r.status === "pending" ? <div className="flex gap-2"><Button size="sm" onClick={() => act(r, true)}>Approve</Button><Button size="sm" variant="outline" className="btn-danger" onClick={() => act(r, false)}>Reject</Button></div>
              : <span className={cn("label-plate", r.status === "approved" ? "text-primary" : "text-destructive")}>{r.status}{r.tokens_granted ? ` +${fmt(r.tokens_granted)}` : ""}</span>}
          </div>
        ))}</div>
      )}
    </Section>
  );
}

/* ---------- Codes ---------- */
function Codes() {
  const qc = useQueryClient();
  const list = useServerFn(A.adminListCodes);
  const reds = useServerFn(A.adminListRedemptions);
  const create = useServerFn(A.adminCreateCode);
  const toggle = useServerFn(A.adminToggleCode);
  const { data: codes = [], isLoading } = useQuery({ queryKey: ["a-codes"], queryFn: () => list() });
  const { data: redemptions = [] } = useQuery({ queryKey: ["a-reds"], queryFn: () => reds() });
  const [f, setF] = useState({ code: "", tokens: 100000, maxUses: 1, expiresAt: "" });
  const m = useMutation({
    mutationFn: () => create({ data: { ...f, expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null } }),
    onSuccess: ({ code }) => { toast.success(`Created ${code}`); setF({ ...f, code: "" }); qc.invalidateQueries({ queryKey: ["a-codes"] }); },
    onError: onErr,
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Section title="New code">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <label className="block"><span className="label-plate">Code (blank = random)</span><input className="field mt-1 uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
          <label className="block"><span className="label-plate">Tokens</span><input className="field mt-1" type="number" min={1} value={f.tokens} onChange={(e) => setF({ ...f, tokens: Number(e.target.value) })} required /></label>
          <label className="block"><span className="label-plate">Max uses</span><input className="field mt-1" type="number" min={1} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: Number(e.target.value) })} required /></label>
          <label className="block"><span className="label-plate">Expires (optional)</span><input className="field mt-1" type="datetime-local" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></label>
          <Button className="w-full" disabled={m.isPending}>Create code</Button>
        </form>
      </Section>
      <div className="space-y-6">
        <Section title="Codes">
          {isLoading ? <ListSkeleton /> : !codes.length ? <Empty>No codes yet.</Empty> : <div className="space-y-2">{codes.map((c) => (
            <div key={c.id} className={cn("well flex flex-wrap items-center justify-between gap-3 p-3", !c.active && "opacity-50")}>
              <span className="font-mono font-semibold">{c.code}</span>
              <span className="font-mono text-xs">{fmt(c.tokens)} tokens · {c.uses}/{c.max_uses} used{c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}</span>
              <Button size="sm" variant="outline" onClick={async () => { await toggle({ data: { id: c.id, active: !c.active } }); qc.invalidateQueries({ queryKey: ["a-codes"] }); }}>{c.active ? "Disable" : "Enable"}</Button>
            </div>
          ))}</div>}
        </Section>
        <Section title="Recent redemptions">
          {!redemptions.length ? <Empty>None yet.</Empty> : <div className="well divide-y font-mono text-xs">{redemptions.map((r) => (
            <div key={r.id} className="flex justify-between gap-3 p-3"><span>{codes.find((c) => c.id === r.code_id)?.code ?? "?"}</span><span>+{fmt(r.tokens)}</span><span>{new Date(r.created_at).toLocaleString()}</span></div>
          ))}</div>}
        </Section>
      </div>
    </div>
  );
}

/* ---------- Logs ---------- */
function Logs() {
  const list = useServerFn(A.adminListLogs);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["a-logs", errorsOnly], queryFn: () => list({ data: { errorsOnly } }) });
  return (
    <Section title="Requests" aside={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />Errors only</label>}>
      {isLoading ? <ListSkeleton /> : !logs.length ? <Empty>No requests.</Empty> : (
        <div className="well overflow-x-auto"><table className="w-full font-mono text-xs">
          <thead><tr className="text-left">{["Time", "Model → upstream", "Gateway", "Status", "Latency", "In/Out", "Cost"].map((h) => <th key={h} className="label-plate px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>{logs.map((l) => (<Fragment key={l.id}>
            <tr key={l.id} className={cn("border-t", l.error && "cursor-pointer")} onClick={() => l.error && setOpen(open === l.id ? null : l.id)}>
              <td className="whitespace-nowrap px-3 py-2">{new Date(l.created_at).toLocaleString()}</td>
              <td className="px-3 py-2">{l.model} → {l.upstream_model}</td>
              <td className="px-3 py-2">{l.gateway_name}</td>
              <td className="px-3 py-2"><span className={cn("led mr-2 align-middle", l.status && l.status < 400 ? "led-ok" : "led-bad")} />{l.status || "net"}</td>
              <td className="px-3 py-2">{l.latency_ms} ms</td>
              <td className="px-3 py-2">{fmt(l.prompt_tokens)}/{fmt(l.completion_tokens)}</td>
              <td className="px-3 py-2">{fmt(Number(l.cost_tokens))}</td>
            </tr>
            {open === l.id && <tr key={l.id + "e"}><td colSpan={7} className="break-all px-3 pb-3 text-destructive">{l.error}</td></tr>}
          </Fragment>))}</tbody>
        </table></div>
      )}
    </Section>
  );
}

/* ---------- Settings ---------- */
function SettingsTab() {
  const ov = useServerFn(A.adminOverview);
  const save = useServerFn(A.adminSaveSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["a-overview"], queryFn: () => ov() });
  if (isLoading || !data) return <ListSkeleton />;
  const p = (data.settings["payments"] ?? {}) as A.PaymentSettings;
  const l = (data.settings["links"] ?? {}) as A.LinkSettings;
  return <SettingsForm initial={{ payments: { bkash: p.bkash ?? "", binance_pay_id: p.binance_pay_id ?? "", wallets: p.wallets ?? [], instructions: p.instructions ?? "" }, links: { channel: l.channel ?? "", group: l.group ?? "", support: l.support ?? "" } }}
    onSave={async (v) => { try { await save({ data: v }); toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["a-overview"] }); } catch (e) { onErr(e as Error); } }} />;
}

function SettingsForm({ initial, onSave }: { initial: { payments: A.PaymentSettings; links: A.LinkSettings }; onSave: (v: { payments: A.PaymentSettings; links: A.LinkSettings }) => void }) {
  const [v, setV] = useState(initial);
  const P = v.payments, L = v.links;
  const setP = (x: Partial<A.PaymentSettings>) => setV({ ...v, payments: { ...P, ...x } });
  const setL = (x: Partial<A.LinkSettings>) => setV({ ...v, links: { ...L, ...x } });
  return (
    <form className="grid gap-6 lg:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave(v); }}>
      <Section title="Payment details">
        <div className="space-y-3">
          <label className="block"><span className="label-plate">bKash number</span><input className="field mt-1" value={P.bkash} onChange={(e) => setP({ bkash: e.target.value })} /></label>
          <label className="block"><span className="label-plate">Binance Pay ID</span><input className="field mt-1" value={P.binance_pay_id} onChange={(e) => setP({ binance_pay_id: e.target.value })} /></label>
          <div><span className="label-plate">Crypto wallets</span>
            {P.wallets.map((w, i) => (
              <div key={i} className="mt-2 flex gap-2">
                <input className="field w-32" placeholder="USDT TRC20" value={w.network} onChange={(e) => setP({ wallets: P.wallets.map((x, j) => (j === i ? { ...x, network: e.target.value } : x)) })} />
                <input className="field" placeholder="Address" value={w.address} onChange={(e) => setP({ wallets: P.wallets.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)) })} />
                <Button type="button" variant="ghost" onClick={() => setP({ wallets: P.wallets.filter((_, j) => j !== i) })}>✕</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setP({ wallets: [...P.wallets, { network: "", address: "" }] })}>Add wallet</Button>
          </div>
          <label className="block"><span className="label-plate">Instructions for users</span><textarea className="field mt-1 min-h-24" value={P.instructions} onChange={(e) => setP({ instructions: e.target.value })} /></label>
        </div>
      </Section>
      <Section title="Community links">
        <div className="space-y-3">
          <label className="block"><span className="label-plate">Official channel</span><input className="field mt-1" value={L.channel} onChange={(e) => setL({ channel: e.target.value })} placeholder="https://t.me/yourchannel" /></label>
          <label className="block"><span className="label-plate">Community group</span><input className="field mt-1" value={L.group} onChange={(e) => setL({ group: e.target.value })} placeholder="https://t.me/yourgroup" /></label>
          <label className="block"><span className="label-plate">Support handle</span><input className="field mt-1" value={L.support ?? ""} onChange={(e) => setL({ support: e.target.value })} placeholder="@support" /></label>
          <p className="text-xs text-muted-foreground">Links are sent by the bot after every sign-in and shown on user dashboards.</p>
          <Button className="w-full">Save all settings</Button>
        </div>
      </Section>
    </form>
  );
}

/* ---------- Telegram ---------- */
function TelegramTab() {
  const st = useServerFn(A.adminTelegramStatus);
  const reg = useServerFn(A.adminRegisterWebhook);
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["a-tg"], queryFn: () => st() });
  const m = useMutation({ mutationFn: () => reg(), onSuccess: () => { toast.success("Webhook registered"); refetch(); }, onError: onErr });
  if (isLoading || !data) return <ListSkeleton />;
  const matches = data.webhook?.url === data.expectedUrl;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 font-mono text-xs md:grid-cols-3">
        <Stat k="Bot" v={data.bot ? `@${data.bot.username}` : <span className="text-destructive">Unavailable</span>} />
        <Stat k="Connection" v={data.mode === "direct" ? "Bot token (AuthTGBOT)" : "Connector"} />
        <Stat k="Pending updates" v={data.webhook?.pending_update_count ?? "—"} />
      </div>
      {data.error && <div className="well p-4 text-sm text-destructive">{data.error}</div>}
      <div className="well space-y-2 p-4 font-mono text-xs">
        <div><span className="label-plate">Expected webhook</span><div className="break-all">{data.expectedUrl}</div></div>
        <div><span className="label-plate">Registered webhook</span><div className={cn("break-all", !matches && "text-destructive")}>{data.webhook?.url || "none"}</div></div>
        {data.webhook?.last_error_message && <div className="text-destructive">Last error: {data.webhook.last_error_message}{data.webhook.last_error_date ? ` (${new Date(data.webhook.last_error_date * 1000).toLocaleString()})` : ""}</div>}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => m.mutate()} disabled={m.isPending}>{matches ? "Re-register webhook" : "Register webhook"}</Button>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
      </div>
    </div>
  );
}

/* ---------- Security ---------- */
function Security({ onLogout }: { onLogout: () => void }) {
  const sec = useServerFn(A.adminSecurity);
  const revoke = useServerFn(A.adminRevokeAllSessions);
  const { data, isLoading } = useQuery({ queryKey: ["a-sec"], queryFn: () => sec() });
  if (isLoading || !data) return <ListSkeleton />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Active admin sessions" aside={<Button size="sm" variant="outline" className="btn-danger" onClick={async () => { if (!confirm("Sign out every admin session?")) return; await revoke(); onLogout(); }}>Revoke all</Button>}>
        <div className="space-y-2">{data.sessions.map((s, i) => <div key={i} className="well p-3 font-mono text-xs">{s.ip ?? "?"} · since {new Date(s.created_at).toLocaleString()} · until {new Date(s.expires_at).toLocaleTimeString()}</div>)}</div>
      </Section>
      <Section title="Recent PIN attempts">
        <div className="space-y-2">{data.attempts.map((a, i) => <div key={i} className="well flex justify-between p-3 font-mono text-xs"><span><span className={cn("led mr-2 align-middle", a.success ? "led-ok" : "led-bad")} />{a.ip}</span><span>{new Date(a.created_at).toLocaleString()}</span></div>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">Lockout: 5 failures per device or 30 overall within 15 minutes. Sessions last 8 hours.</p>
      </Section>
    </div>
  );
}
