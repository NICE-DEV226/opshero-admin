"use client";

import { useEffect, useState } from "react";
import {
  feedbackHubApi,
  type AdminFeedback,
  type FeedbackStats,
  AdminApiError,
} from "@/lib/admin-api";
import {
  Lightbulb, Bug, TrendingUp, HelpCircle,
  MessageSquare, CheckCircle, AlertTriangle,
  Clock, Send, Trash2, Filter, Bell,
} from "lucide-react";

// ── Config ───────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  feature_request: { label: "Feature",     color: "var(--acid)",  bg: "rgba(0,255,135,0.08)",   icon: Lightbulb },
  bug_report:      { label: "Bug",         color: "#fca5a5",      bg: "rgba(239,68,68,0.08)",   icon: Bug },
  improvement:     { label: "Improvement", color: "var(--cyan)",  bg: "rgba(0,212,255,0.07)",   icon: TrendingUp },
  other:           { label: "Other",       color: "#a5b4fc",      bg: "rgba(99,102,241,0.08)",  icon: HelpCircle },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  open:      { label: "Open",       color: "#94a3b8",      bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", icon: Clock },
  in_review: { label: "In review",  color: "var(--cyan)",  bg: "rgba(0,212,255,0.08)",  border: "rgba(0,212,255,0.2)",   icon: Clock },
  planned:   { label: "Planned",    color: "var(--acid)",  bg: "rgba(0,255,135,0.08)",  border: "rgba(0,255,135,0.2)",   icon: CheckCircle },
  done:      { label: "Shipped",    color: "#4ade80",      bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.2)",  icon: CheckCircle },
  declined:  { label: "Declined",   color: "#fca5a5",      bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",   icon: AlertTriangle },
};

const ALL_STATUSES = ["open", "in_review", "planned", "done", "declined"] as const;
const ALL_TYPES = ["feature_request", "bug_report", "improvement", "other"] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFeedbackPage() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [items, setItems] = useState<AdminFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminFeedback | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");

  // Edit state
  const [editStatus, setEditStatus] = useState("");
  const [editReply, setEditReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function loadList() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      if (search.trim()) params.search = search.trim();
      const res = await feedbackHubApi.list(params);
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    feedbackHubApi.getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    loadList();
  }, [filterStatus, filterType]);

  function openItem(item: AdminFeedback) {
    setSelected(item);
    setEditStatus(item.status);
    setEditReply(item.admin_reply ?? "");
    setSaveMsg(null);
    setSaveError(null);
  }

  async function saveItem() {
    if (!selected) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      await feedbackHubApi.update(selected.id, {
        status: editStatus,
        admin_reply: editReply,
      });
      setSaveMsg("Saved");
      // Update in list
      setItems(prev => prev.map(i =>
        i.id === selected.id
          ? { ...i, status: editStatus as AdminFeedback["status"], admin_reply: editReply || null }
          : i,
      ));
      setSelected(s => s ? { ...s, status: editStatus as AdminFeedback["status"], admin_reply: editReply || null } : s);
      feedbackHubApi.getStats().then(setStats).catch(() => {});
    } catch (e) {
      setSaveError(e instanceof AdminApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this feedback submission?")) return;
    try {
      await feedbackHubApi.delete(id);
      setItems(prev => prev.filter(i => i.id !== id));
      if (selected?.id === id) setSelected(null);
      if (stats) setStats({ ...stats, total: stats.total - 1 });
    } catch { /* ignore */ }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadList();
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
          User Feedback
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
          Feature requests, bug reports, and improvement ideas from users
        </p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="stat-card col-span-1">
            <div className="text-xs mb-1" style={{ color: "var(--text-3)" }}>Total</div>
            <div className="text-2xl font-bold font-display" style={{ color: "var(--text-1)" }}>
              {stats.total}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-xs mb-1" style={{ color: "var(--text-3)" }}>Open</div>
            <div className="text-2xl font-bold font-display" style={{ color: "#fca5a5" }}>
              {stats.open}
            </div>
          </div>
          {Object.entries(stats.by_type).map(([type, count]) => {
            const cfg = TYPE_CFG[type];
            if (!cfg) return null;
            return (
              <div key={type} className="stat-card">
                <div className="text-xs mb-1" style={{ color: "var(--text-3)" }}>{cfg.label}</div>
                <div className="text-2xl font-bold font-display" style={{ color: cfg.color }}>
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
        {/* ── LEFT: list ── */}
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search title, description, user…"
                className="input text-sm flex-1"
                style={{ minWidth: 180 }}
              />
              <button type="submit" className="btn-outline btn-sm">
                <Filter className="w-3.5 h-3.5" /> Search
              </button>
            </form>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="input text-sm"
              style={{ width: "auto", minWidth: 140 }}
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CFG[s].label}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="input text-sm"
              style={{ width: "auto", minWidth: 140 }}
            >
              <option value="">All types</option>
              {ALL_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_CFG[t].label}</option>
              ))}
            </select>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="panel p-4">
                  <div className="skeleton h-4 w-2/3 rounded mb-2" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="panel py-16 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: "var(--text-3)" }} />
              <p className="text-sm" style={{ color: "var(--text-3)" }}>No feedback found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => {
                const typeCfg = TYPE_CFG[item.type] ?? TYPE_CFG.other;
                const statusCfg = STATUS_CFG[item.status] ?? STATUS_CFG.open;
                const TypeIcon = typeCfg.icon;
                const StatusIcon = statusCfg.icon;
                const isActive = selected?.id === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => openItem(item)}
                    className="panel p-4 w-full text-left transition-all hover:border-cyan-500/30"
                    style={{
                      border: isActive ? "1px solid rgba(0,212,255,0.3)" : undefined,
                      background: isActive ? "rgba(0,212,255,0.04)" : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: typeCfg.bg }}
                      >
                        <TypeIcon className="w-3.5 h-3.5" style={{ color: typeCfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                            style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}
                          >
                            <StatusIcon className="w-2.5 h-2.5" />
                            {statusCfg.label}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                            {item.priority && `${item.priority} priority ·`} @{item.author_github} · {item.author_tier}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-1)" }}>
                          {item.title}
                        </p>
                        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-3)" }}>
                          {item.description}
                        </p>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: "var(--text-3)" }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: detail + reply panel ── */}
        {selected ? (
          <div className="panel p-5 space-y-4 h-fit sticky top-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {(() => {
                  const cfg = TYPE_CFG[selected.type] ?? TYPE_CFG.other;
                  const Icon = cfg.icon;
                  return (
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.color }} />
                      <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                  );
                })()}
                <h2 className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                  {selected.title}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  @{selected.author_github} · {selected.author_tier} · {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => deleteItem(selected.id)}
                className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                style={{ color: "#fca5a5" }}
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                Full Description
              </label>
              <div
                className="p-4 rounded-xl text-sm whitespace-pre-wrap max-h-64 overflow-y-auto"
                style={{ 
                  background: "var(--surface-2)", 
                  color: "var(--text-2)", 
                  border: "1px solid var(--border)",
                  lineHeight: "1.5"
                }}
              >
                {selected.description}
              </div>
            </div>

            {selected.url_or_page && (
              <div className="text-xs" style={{ color: "var(--text-3)" }}>
                <span className="font-semibold">Page: </span>
                <span style={{ color: "var(--text-2)" }}>{selected.url_or_page}</span>
              </div>
            )}

            {/* Show existing admin reply if any */}
            {selected.admin_reply && (
              <div className="space-y-2">
                <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                  Previous Admin Reply
                  {selected.admin_replied_by && (
                    <span className="font-normal ml-1" style={{ color: "var(--text-3)" }}>
                      by {selected.admin_replied_by}
                    </span>
                  )}
                </label>
                <div
                  className="p-3 rounded-xl text-sm whitespace-pre-wrap"
                  style={{ 
                    background: "rgba(0,255,135,0.05)", 
                    color: "var(--text-2)", 
                    border: "1px solid rgba(0,255,135,0.2)" 
                  }}
                >
                  {selected.admin_reply}
                </div>
              </div>
            )}

            {/* Change status */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>Status</label>
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                className="input w-full text-sm"
              >
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                ))}
              </select>
            </div>

            {/* Admin reply */}
            <div className="space-y-2">
              <label className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                Reply to @{selected.author_github}
                <span className="font-normal ml-1" style={{ color: "var(--text-3)" }}>
                  (User will be notified)
                </span>
              </label>
              <textarea
                value={editReply}
                onChange={e => setEditReply(e.target.value)}
                placeholder={`Write a response to @${selected.author_github}. They will receive a notification with your reply.`}
                rows={5}
                className="input w-full text-sm resize-none"
                style={{ minHeight: "120px" }}
              />
              {editReply.trim() && (
                <div className="text-xs" style={{ color: "var(--text-3)" }}>
                  <span className="font-semibold">Preview:</span> User will see this reply in their feedback submissions.
                </div>
              )}
            </div>

            {/* Feedback */}
            {saveMsg && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "#4ade80" }}>
                <CheckCircle className="w-4 h-4" /> {saveMsg}
                <span className="text-xs" style={{ color: "var(--text-3)" }}>
                  • User has been notified
                </span>
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "#fca5a5" }}>
                <AlertTriangle className="w-4 h-4" /> {saveError}
              </div>
            )}

            {/* Notification info */}
            <div 
              className="p-3 rounded-lg text-xs"
              style={{ 
                background: "rgba(0,212,255,0.05)", 
                border: "1px solid rgba(0,212,255,0.1)",
                color: "var(--text-3)"
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-3 h-3" style={{ color: "var(--cyan)" }} />
                <span className="font-semibold" style={{ color: "var(--text-2)" }}>Notification System</span>
              </div>
              <ul className="space-y-1 ml-5">
                <li>• User receives notification when you reply or change status to "Planned" or "Done"</li>
                <li>• Admins are notified when new feedback is submitted</li>
                <li>• All notifications appear in the user's dashboard</li>
              </ul>
            </div>

            <button
              onClick={saveItem}
              disabled={saving}
              className="btn-primary w-full gap-2"
            >
              {saving
                ? <span className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                : <Send className="w-4 h-4" />
              }
              {saving 
                ? "Saving & Notifying User..." 
                : editReply.trim() 
                  ? "Save & Send Reply" 
                  : "Save Status Change"
              }
            </button>
          </div>
        ) : (
          <div className="panel p-8 text-center h-fit">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" style={{ color: "var(--text-3)" }} />
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              Select a submission to review and reply.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
