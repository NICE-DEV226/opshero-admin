"use client";

import { useEffect, useState } from "react";
import { configApi, type ConfigEntry } from "@/lib/admin-api";
import { Settings, Save, RefreshCw, Check, AlertTriangle } from "lucide-react";

const CAT_ORDER = ["LLM", "FEATURES", "LIMITS", "SYNC", "SECURITY"];

export default function ConfigPage() {
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await configApi.getAll();
      setEntries(Array.isArray(res) ? res : []);
    } catch {
      // Show demo data
      setEntries(DEMO_ENTRIES);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(key: string, value: string) {
    setSaving(s => ({ ...s, [key]: true }));
    setError(null);
    try {
      const parsed = tryParseValue(value);
      await configApi.set(key, parsed);
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
      setEdits(e => { const n = { ...e }; delete n[key]; return n; });
      // Update local state
      setEntries(prev =>
        prev.map(e => e.key === key ? { ...e, value: parsed } : e),
      );
    } catch {
      setError(`Failed to save ${key}`);
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }

  function tryParseValue(v: string): unknown {
    if (v === "true") return true;
    if (v === "false") return false;
    const n = Number(v);
    if (!isNaN(n) && v.trim() !== "") return n;
    return v;
  }

  async function handleReload() {
    try {
      await configApi.reload();
    } catch { /* ignore */ }
    await load();
  }

  // Group by category
  const grouped: Record<string, ConfigEntry[]> = {};
  for (const e of entries) {
    const cat = e.category?.toUpperCase() ?? "OTHER";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(e);
  }

  const sortedCats = [
    ...CAT_ORDER.filter(c => c in grouped),
    ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c)),
  ];

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Platform Config
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            Live configuration — changes take effect immediately via Redis pub/sub
          </p>
        </div>
        <button onClick={handleReload} className="btn-outline btn-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Reload Config
        </button>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl"
          style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel p-5">
              <div className="skeleton h-4 w-24 rounded mb-4" />
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="skeleton h-10 rounded mb-3" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCats.map(cat => (
            <div key={cat} className="panel p-5">
              <h2 className="section-label mb-4">{cat}</h2>
              <div className="space-y-3">
                {(grouped[cat] ?? []).map(entry => {
                  const rawVal = String(entry.value ?? "");
                  const editVal = edits[entry.key] ?? rawVal;
                  const isDirty = editVal !== rawVal;

                  return (
                    <div key={entry.key} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs mb-1" style={{ color: "var(--accent)" }}>
                          {entry.key}
                        </div>
                        {entry.description && (
                          <div className="text-xs" style={{ color: "var(--text-3)" }}>
                            {entry.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" style={{ width: 260 }}>
                        {typeof entry.value === "boolean" ? (
                          <button
                            onClick={() => handleSave(entry.key, String(!entry.value))}
                            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all"
                            style={{
                              background: entry.value ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.08)",
                              color: entry.value ? "#4ade80" : "#fca5a5",
                              border: `1px solid ${entry.value ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.20)"}`,
                            }}
                          >
                            {entry.value ? "Enabled" : "Disabled"}
                          </button>
                        ) : (
                          <input
                            type="text"
                            value={editVal}
                            onChange={e =>
                              setEdits(prev => ({ ...prev, [entry.key]: e.target.value }))
                            }
                            className="input text-xs py-1.5 font-mono"
                          />
                        )}
                        {isDirty && (
                          <button
                            onClick={() => handleSave(entry.key, editVal)}
                            disabled={saving[entry.key]}
                            className="btn-primary btn-sm py-1.5 px-2"
                          >
                            {saving[entry.key] ? (
                              <span
                                className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                                style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                              />
                            ) : saved[entry.key] ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Demo data shown before backend is connected
const DEMO_ENTRIES: ConfigEntry[] = [
  { key: "llm.enabled",                   value: true,              category: "LLM",      description: "Enable AI engine fallback" },
  { key: "llm.confidence_threshold",       value: 0.65,              category: "LLM",      description: "Below this → trigger LLM" },
  { key: "llm.primary_model",             value: "llama-3.3-70b-versatile", category: "LLM", description: "Primary LLM model" },
  { key: "llm.daily_budget_usd",          value: 10.00,             category: "LLM",      description: "Daily spend limit" },
  { key: "llm.enabled_for_free",          value: false,             category: "LLM",      description: "Free tier gets LLM" },
  { key: "features.community_contributions", value: true,           category: "FEATURES", description: "Enable community PR submissions" },
  { key: "features.mobile_money",         value: true,              category: "FEATURES", description: "Enable mobile money payments" },
  { key: "features.analytics",            value: true,              category: "FEATURES", description: "Enable usage analytics" },
  { key: "limits.free_analyses_per_day",  value: 10,               category: "LIMITS",   description: "Free tier daily limit" },
  { key: "limits.pro_analyses_per_day",   value: 500,              category: "LIMITS",   description: "Pro tier daily limit" },
  { key: "limits.log_max_size_bytes",     value: 1048576,          category: "LIMITS",   description: "Max log size (1MB)" },
  { key: "sync.retention_days",           value: 90,               category: "SYNC",     description: "Days to retain analysis data" },
  { key: "security.rate_limit_per_min",   value: 60,               category: "SECURITY", description: "API rate limit per minute" },
  { key: "security.require_2fa_admins",   value: true,             category: "SECURITY", description: "Mandatory TOTP for admins" },
];
