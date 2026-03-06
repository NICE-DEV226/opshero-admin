"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { llmApi, type LLMCosts, type LLMConfig } from "@/lib/admin-api";
import {
  BrainCog, DollarSign, Clock, AlertTriangle,
  Settings, Save, KeyRound, CheckCircle, Eye, EyeOff,
  ToggleLeft, ToggleRight,
} from "lucide-react";

type Tab = "costs" | "config";

const MOCK_TREND = Array.from({ length: 30 }, (_, i) => ({
  date: `Day ${i + 1}`,
  cost: parseFloat((Math.random() * 5 + 1).toFixed(2)),
}));

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

export default function LLMPage() {
  const [tab, setTab] = useState<Tab>("costs");

  // ── Costs tab state ────────────────────────────────────────────────
  const [costs, setCosts] = useState<LLMCosts | null>(null);
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("30d");

  // ── Config tab state ───────────────────────────────────────────────
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [form, setForm] = useState<Partial<LLMConfig>>({});
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  // ── Load costs ─────────────────────────────────────────────────────
  useEffect(() => {
    llmApi.getCosts(period)
      .then(setCosts)
      .catch(() => setCosts(null));
  }, [period]);

  // ── Load config ────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "config") return;
    setConfigLoading(true);
    llmApi.getConfig()
      .then(c => { setConfig(c); setForm(c); })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, [tab]);

  function setField<K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function saveConfig() {
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const payload: Partial<Omit<LLMConfig, "groq_api_key_set">> = { ...form };
      delete (payload as Record<string, unknown>).groq_api_key_set;
      const res = await llmApi.updateConfig(payload);
      setSaveMsg(res.message);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveApiKey() {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    setKeyMsg(null);
    setKeyError(null);
    try {
      const res = await llmApi.updateApiKey(apiKeyInput.trim());
      setKeyMsg(res.message);
      setApiKeyInput("");
      // Refresh config to update groq_api_key_set flag
      const fresh = await llmApi.getConfig();
      setConfig(fresh);
      setForm(fresh);
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "Failed to update API key");
    } finally {
      setSavingKey(false);
    }
  }

  const trend = costs?.cost_trend?.length ? costs.cost_trend : MOCK_TREND;
  const daily_pct = costs?.daily_used_pct ?? 42;
  const monthly_pct = costs?.monthly_used_pct ?? 63;

  function BudgetBar({ label, used_pct, budget_usd, current_usd }: {
    label: string; used_pct: number; budget_usd: number; current_usd: number;
  }) {
    const color = used_pct >= 90 ? "#fca5a5" : used_pct >= 80 ? "#fde047" : "#4ade80";
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span style={{ color: "var(--text-2)" }}>{label}</span>
          <span style={{ color }}>
            ${current_usd.toFixed(2)} / ${budget_usd.toFixed(2)} ({used_pct.toFixed(0)}%)
          </span>
        </div>
        <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, used_pct)}%`, background: color }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            AI Engine
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            LLM usage, cost tracking, and runtime configuration
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-2)" }}>
          {([
            { id: "costs", label: "Costs", Icon: DollarSign },
            { id: "config", label: "Configuration", Icon: Settings },
          ] as { id: Tab; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={{
                background: tab === id ? "var(--surface)" : "transparent",
                color: tab === id ? "var(--text-1)" : "var(--text-3)",
                border: tab === id ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ COSTS TAB ══════════════════════════════════════════════════════ */}
      {tab === "costs" && (
        <>
          {/* Period picker */}
          <div className="flex justify-end">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-2)" }}>
              {(["today", "7d", "30d"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  style={{
                    background: period === p ? "var(--surface)" : "transparent",
                    color: period === p ? "var(--text-1)" : "var(--text-3)",
                    border: period === p ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Total Cost", value: `$${(costs?.total_cost_usd ?? 127.42).toFixed(2)}`, icon: DollarSign, color: "#fde047" },
              { label: "LLM Calls", value: (costs?.calls_total ?? 98_442).toLocaleString(), icon: BrainCog, color: "var(--accent)" },
              { label: "Avg Latency", value: `${(costs?.avg_latency_ms ?? 847).toFixed(0)}ms`, icon: Clock, color: "#38dcff" },
              {
                label: "Daily Budget",
                value: `${daily_pct.toFixed(0)}%`,
                icon: AlertTriangle,
                color: daily_pct >= 80 ? "#fca5a5" : "#4ade80",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card">
                <div
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3"
                  style={{ background: `${color}18`, border: `1px solid ${color}28` }}
                >
                  <Icon className="w-4 h-4" style={{ color, width: 16, height: 16 }} />
                </div>
                <div className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
                  {value}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Cost trend */}
          <div className="panel p-5">
            <h2 className="section-label mb-4">Cost Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fde047" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fde047" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    color: "var(--text-1)",
                    fontSize: 12,
                  }}
                  cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Cost"]}
                />
                <Area type="monotone" dataKey="cost" stroke="#fde047" fill="url(#costGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Budget + By model */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="panel p-5 space-y-4">
              <h2 className="section-label">Budget Status</h2>
              <BudgetBar
                label="Daily budget"
                used_pct={daily_pct}
                budget_usd={costs?.daily_budget_usd ?? 10}
                current_usd={costs ? (costs.total_cost_usd * daily_pct / 100) : 4.25}
              />
              <BudgetBar
                label="Monthly budget"
                used_pct={monthly_pct}
                budget_usd={costs?.monthly_budget_usd ?? 200}
                current_usd={costs?.total_cost_usd ?? 127.42}
              />
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                Alert at 80% · Hard limit at 100% (regex-only fallback)
              </p>
            </div>

            <div className="panel p-5">
              <h2 className="section-label mb-3">By Model</h2>
              {costs?.by_model ? (
                <div className="space-y-2">
                  {Object.entries(costs.by_model).map(([model, stats]) => (
                    <div key={model} className="flex justify-between text-xs">
                      <span className="font-mono" style={{ color: "var(--text-2)" }}>{model}</span>
                      <div className="text-right">
                        <span style={{ color: "#fde047" }}>${stats.cost.toFixed(2)}</span>
                        <span className="ml-2" style={{ color: "var(--text-3)" }}>{stats.calls.toLocaleString()} calls</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { model: "llama-3.3-70b-versatile", cost: 89.12, calls: 68_000, pct: 70 },
                    { model: "llama-3.1-8b-instant", cost: 23.84, calls: 24_000, pct: 19 },
                    { model: "mixtral-8x7b-32768", cost: 14.46, calls: 6_442, pct: 11 },
                  ].map(({ model, cost, calls, pct }) => (
                    <div key={model}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-mono truncate" style={{ color: "var(--text-2)", maxWidth: "60%" }}>{model}</span>
                        <span style={{ color: "#fde047" }}>${cost.toFixed(2)} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "rgba(250,204,21,0.6)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══ CONFIG TAB ══════════════════════════════════════════════════════ */}
      {tab === "config" && (
        <div className="space-y-5">
          {configLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="panel p-5"><div className="skeleton h-6 w-1/2 rounded" /></div>
              ))}
            </div>
          ) : config ? (
            <>
              {/* Feedback */}
              {saveMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                  style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
                  <CheckCircle className="w-4 h-4 shrink-0" /> {saveMsg}
                </div>
              )}
              {saveError && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {saveError}
                </div>
              )}

              {/* ── LLM toggle ── */}
              <div className="panel p-5">
                <h2 className="section-label mb-4">Engine Status</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>AI Engine enabled</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                      When disabled, the system uses regex-only matching for all users.
                    </p>
                  </div>
                  <button
                    onClick={() => setField("llm_enabled", !form.llm_enabled)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-semibold"
                    style={{
                      background: form.llm_enabled ? "rgba(74,222,128,0.10)" : "rgba(239,68,68,0.08)",
                      color: form.llm_enabled ? "#4ade80" : "#fca5a5",
                      border: `1px solid ${form.llm_enabled ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.2)"}`,
                    }}
                  >
                    {form.llm_enabled
                      ? <><ToggleRight className="w-4 h-4" /> Enabled</>
                      : <><ToggleLeft className="w-4 h-4" /> Disabled</>
                    }
                  </button>
                </div>

                <div className="mt-4 pt-4 grid grid-cols-3 gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                  {([
                    { key: "llm_enabled_for_free", label: "Free tier" },
                    { key: "llm_enabled_for_pro", label: "Pro tier" },
                    { key: "llm_enabled_for_team", label: "Team tier" },
                  ] as { key: keyof LLMConfig; label: string }[]).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form[key]}
                        onChange={e => setField(key, e.target.checked as LLMConfig[typeof key])}
                        className="w-4 h-4 rounded accent-cyan-400"
                      />
                      <span className="text-xs" style={{ color: "var(--text-2)" }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Models ── */}
              <div className="panel p-5 space-y-4">
                <h2 className="section-label">Model Selection</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {([
                    { key: "llm_primary_model", label: "Primary model", hint: "Standard logs" },
                    { key: "llm_fast_model", label: "Fast model", hint: `Short logs < ${config.llm_calls_per_day_pro ?? 500} chars` },
                    { key: "llm_long_context_model", label: "Long-context model", hint: "Long logs > 4 000 chars" },
                  ] as { key: keyof LLMConfig; label: string; hint: string }[]).map(({ key, label, hint }) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>{label}</label>
                      <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{hint}</p>
                      <select
                        value={String(form[key] ?? "")}
                        onChange={e => setField(key, e.target.value as LLMConfig[typeof key])}
                        className="input w-full text-xs font-mono"
                      >
                        {GROQ_MODELS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Thresholds & budgets ── */}
              <div className="panel p-5 space-y-4">
                <h2 className="section-label">Thresholds & Budgets</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                      Confidence threshold
                    </label>
                    <p className="text-[11px]" style={{ color: "var(--text-3)" }}>Trigger LLM fallback below</p>
                    <input
                      type="number" min={0} max={1} step={0.05}
                      value={form.llm_confidence_threshold ?? ""}
                      onChange={e => setField("llm_confidence_threshold", parseFloat(e.target.value))}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>Daily budget (USD)</label>
                    <p className="text-[11px]" style={{ color: "var(--text-3)" }}>Hard cutoff per day</p>
                    <input
                      type="number" min={0} step={1}
                      value={form.llm_daily_budget_usd ?? ""}
                      onChange={e => setField("llm_daily_budget_usd", parseFloat(e.target.value))}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>Monthly budget (USD)</label>
                    <p className="text-[11px]" style={{ color: "var(--text-3)" }}>Hard cutoff per month</p>
                    <input
                      type="number" min={0} step={10}
                      value={form.llm_monthly_budget_usd ?? ""}
                      onChange={e => setField("llm_monthly_budget_usd", parseFloat(e.target.value))}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>Pro calls / day</label>
                    <p className="text-[11px]" style={{ color: "var(--text-3)" }}>Max LLM calls per user</p>
                    <input
                      type="number" min={0} step={10}
                      value={form.llm_calls_per_day_pro ?? ""}
                      onChange={e => setField("llm_calls_per_day_pro", parseInt(e.target.value))}
                      className="input w-full text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Save config button */}
              <div className="flex justify-end">
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="btn-primary gap-2"
                >
                  {saving
                    ? <span className="w-4 h-4 rounded-full border-2 animate-spin"
                        style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                    : <Save className="w-4 h-4" />
                  }
                  {saving ? "Saving…" : "Save configuration"}
                </button>
              </div>

              {/* ── API Key ── */}
              <div className="panel p-5 space-y-4" style={{ border: "1px solid rgba(99,102,241,0.2)" }}>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" style={{ color: "#a5b4fc" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                    Groq API Key
                  </h2>
                  <span
                    className="ml-auto px-2 py-0.5 rounded-md text-xs font-semibold"
                    style={{
                      background: config.groq_api_key_set ? "rgba(74,222,128,0.10)" : "rgba(239,68,68,0.08)",
                      color: config.groq_api_key_set ? "#4ade80" : "#fca5a5",
                      border: `1px solid ${config.groq_api_key_set ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.15)"}`,
                    }}
                  >
                    {config.groq_api_key_set ? "Custom key set" : "Using .env key"}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  Override the API key stored in <code className="font-mono">.env</code>.
                  The new key is stored in the database and takes effect on next server restart.
                  <strong style={{ color: "var(--text-2)" }}> super_admin only.</strong>
                </p>

                {keyMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                    style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
                    <CheckCircle className="w-4 h-4 shrink-0" /> {keyMsg}
                  </div>
                )}
                {keyError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {keyError}
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder="gsk_..."
                      className="input w-full text-sm font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--text-3)" }}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={saveApiKey}
                    disabled={!apiKeyInput.trim() || savingKey}
                    className="btn-primary gap-2 whitespace-nowrap"
                  >
                    {savingKey
                      ? <span className="w-4 h-4 rounded-full border-2 animate-spin"
                          style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                      : <KeyRound className="w-4 h-4" />
                    }
                    {savingKey ? "Updating…" : "Update key"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="panel p-6 text-center">
              <p className="text-sm" style={{ color: "var(--text-3)" }}>Failed to load configuration.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
