"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, CheckCircle, XCircle, Play, RefreshCw,
  AlertCircle, Zap, Clock, ChevronRight, Activity,
  ArrowUpRight, BarChart2,
} from "lucide-react";
import {
  learningApi,
  LearningCandidate,
  LearningStats,
  LearningJob,
  CandidateStatus,
} from "@/lib/admin-api";
import { isSuperAdmin } from "@/lib/admin-auth";

// ── helpers ────────────────────────────────────────────────────────────────

const STATUS_META: Record<CandidateStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:          { label: "Pending",          color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  ready_for_review: { label: "Ready for Review", color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)"  },
  approved:         { label: "Approved",         color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"  },
  promoted:         { label: "Promoted",         color: "#00d4ff", bg: "rgba(0,212,255,0.08)",   border: "rgba(0,212,255,0.2)"   },
  auto_promoted:    { label: "Auto-Promoted",    color: "#00ff87", bg: "rgba(0,255,135,0.08)",   border: "rgba(0,255,135,0.2)"   },
  rejected:         { label: "Rejected",         color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
};

const CATEGORY_COLOR: Record<string, string> = {
  docker: "#38dcff", npm: "#4ade80", python: "#fde047",
  git: "#f97316", tests: "#a78bfa", kubernetes: "#60a5fa",
  terraform: "#8b5cf6", security: "#f87171", ci: "#fb923c", other: "#94a3b8",
};

function StatusBadge({ status }: { status: CandidateStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
    >
      {m.label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "#00ff87" : pct >= 70 ? "#fbbf24" : "#f87171";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "pending",          label: "Pending" },
  { key: "ready_for_review", label: "Ready for Review" },
  { key: "approved",         label: "Approved" },
  { key: "auto_promoted",    label: "Auto-Promoted" },
  { key: "promoted",         label: "Promoted" },
  { key: "rejected",         label: "Rejected" },
];

// ── page ───────────────────────────────────────────────────────────────────

export default function LearningPage() {
  const superAdmin = isSuperAdmin();

  // views: "queue" | "jobs"
  const [view, setView] = useState<"queue" | "jobs">("queue");

  // stats
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // candidates
  const [statusFilter, setStatusFilter] = useState("pending");
  const [candidates, setCandidates] = useState<LearningCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);

  // jobs
  const [jobs, setJobs] = useState<LearningJob[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsLoading, setJobsLoading] = useState(false);

  // actions
  const [triggering, setTriggering] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── data loaders ──────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await learningApi.getStats();
      setStats(s);
    } catch { /* silent */ }
    finally { setStatsLoading(false); }
  }, []);

  const loadCandidates = useCallback(async (status: string, p: number) => {
    setListLoading(true);
    setError(null);
    try {
      const data = await learningApi.listCandidates(status, p);
      setCandidates(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load candidates");
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadJobs = useCallback(async (p: number) => {
    setJobsLoading(true);
    try {
      const data = await learningApi.listJobs(undefined, p, 30);
      setJobs(data.items);
      setJobsTotal(data.total);
    } catch { /* silent */ }
    finally { setJobsLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (view === "queue") loadCandidates(statusFilter, page);
  }, [view, statusFilter, page, loadCandidates]);

  useEffect(() => {
    if (view === "jobs") loadJobs(jobsPage);
  }, [view, jobsPage, loadJobs]);

  // ── actions ───────────────────────────────────────────────────────────────

  async function handleTrigger(name: string, fn: () => Promise<unknown>) {
    setTriggering(name);
    setError(null);
    try {
      await fn();
      showToast(`${name} job started`);
      loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trigger failed");
    } finally {
      setTriggering(null);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject" | "promote") {
    setActionBusy(id + action);
    setError(null);
    try {
      if (action === "approve")  await learningApi.approve(id);
      if (action === "reject")   await learningApi.reject(id);
      if (action === "promote")  await learningApi.promote(id);
      showToast(`Candidate ${action}d`);
      loadCandidates(statusFilter, page);
      loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionBusy(null);
    }
  }

  // ── stats cards ───────────────────────────────────────────────────────────

  const STAT_CARDS = [
    {
      key: "pending",
      label: "Pending",
      icon: Clock,
      color: "#94a3b8",
      desc: "Awaiting threshold",
    },
    {
      key: "ready_for_review",
      label: "Ready for Review",
      icon: AlertCircle,
      color: "#fbbf24",
      desc: "Generated, needs approval",
    },
    {
      key: "auto_promoted",
      label: "Auto-Promoted",
      icon: Zap,
      color: "#00ff87",
      desc: "Live in pattern library",
    },
    {
      key: "promoted",
      label: "Promoted",
      icon: CheckCircle,
      color: "#00d4ff",
      desc: "Admin-approved & live",
    },
  ];

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Auto-Learning
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            AI pattern generation pipeline — unknown errors → live regex library
          </p>
        </div>
        {superAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => handleTrigger("auto-promote", learningApi.triggerAutoPromote)}
              disabled={triggering !== null}
              className="btn-primary btn-sm gap-1.5"
            >
              {triggering === "auto-promote" ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
              ) : <Zap className="w-3.5 h-3.5" />}
              Trigger Auto-Promote
            </button>
            <button
              onClick={() => handleTrigger("rerank", learningApi.triggerRerank)}
              disabled={triggering !== null}
              className="btn-outline btn-sm gap-1.5"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Rerank
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#fca5a5" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl"
          style={{ background: "rgba(0,255,135,0.12)", border: "1px solid rgba(0,255,135,0.3)", color: "#00ff87" }}>
          <CheckCircle className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          const st = stats?.by_status[card.key];
          return (
            <button
              key={card.key}
              onClick={() => { setView("queue"); setStatusFilter(card.key); setPage(1); }}
              className="panel p-4 text-left hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4" style={{ color: card.color }} />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-30" style={{ color: card.color }} />
              </div>
              {statsLoading ? (
                <div className="skeleton h-6 w-12 rounded mb-1" />
              ) : (
                <div className="text-2xl font-bold font-mono" style={{ color: card.color }}>
                  {st?.count ?? 0}
                </div>
              )}
              <div className="text-xs font-medium mt-0.5" style={{ color: "var(--text-2)" }}>
                {card.label}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>
                {card.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Top pending */}
      {stats?.top_pending_by_frequency && stats.top_pending_by_frequency.length > 0 && (
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" style={{ color: "#fbbf24" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Top Pending by Frequency
            </span>
          </div>
          <div className="space-y-1.5">
            {stats.top_pending_by_frequency.slice(0, 5).map(c => (
              <Link
                key={c.id}
                href={`/learning/${c.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <span className="font-mono text-xs font-semibold truncate flex-1" style={{ color: "var(--text-1)" }}>
                  {c.llm_pattern_id}
                </span>
                {c.llm_category && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
                    style={{
                      background: `${CATEGORY_COLOR[c.llm_category] ?? "#94a3b8"}18`,
                      color: CATEGORY_COLOR[c.llm_category] ?? "#94a3b8",
                    }}
                  >
                    {c.llm_category}
                  </span>
                )}
                <span className="text-xs font-mono shrink-0" style={{ color: "#fbbf24" }}>
                  ×{c.unmatched_count}
                </span>
                <ConfidenceBar value={c.llm_confidence ?? 0} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { key: "queue", label: "Candidate Queue", icon: Activity },
          { key: "jobs",  label: "Job History",     icon: Clock },
        ].map(t => {
          const Icon = t.icon;
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key as "queue" | "jobs")}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
              style={{
                borderBottomColor: active ? "var(--cyan)" : "transparent",
                color: active ? "var(--text-1)" : "var(--text-3)",
              }}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Queue view ── */}
      {view === "queue" && (
        <div className="space-y-4">
          {/* Status filter tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_TABS.map(t => {
              const count = stats?.by_status[t.key]?.count;
              const active = statusFilter === t.key;
              const m = STATUS_META[t.key as CandidateStatus] ?? STATUS_META.pending;
              return (
                <button
                  key={t.key}
                  onClick={() => { setStatusFilter(t.key); setPage(1); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: active ? m.bg : "transparent",
                    color: active ? m.color : "var(--text-3)",
                    border: `1px solid ${active ? m.border : "transparent"}`,
                  }}
                >
                  {t.label}
                  {count !== undefined && (
                    <span className="ml-1.5 opacity-60">{count}</span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => { loadCandidates(statusFilter, page); loadStats(); }}
              disabled={listLoading}
              className="ml-auto btn-ghost btn-sm gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${listLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Candidates table */}
          {listLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : candidates.length === 0 ? (
            <div className="panel p-12 text-center space-y-2">
              <TrendingUp className="w-8 h-8 mx-auto" style={{ color: "var(--text-3)" }} />
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                No candidates with status &ldquo;{STATUS_META[statusFilter as CandidateStatus]?.label}&rdquo;
              </p>
            </div>
          ) : (
            <div className="panel overflow-hidden">
              {/* Table header */}
              <div
                className="grid gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  gridTemplateColumns: "1fr 80px 70px 110px 90px 120px",
                  color: "var(--text-3)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span>Pattern ID</span>
                <span>Category</span>
                <span className="text-right">Sightings</span>
                <span>Confidence</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Rows */}
              {candidates.map(c => {
                const catColor = CATEGORY_COLOR[c.llm_category ?? "other"] ?? "#94a3b8";
                const busy = actionBusy?.startsWith(c.id);
                return (
                  <div
                    key={c.id}
                    className="grid gap-3 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors"
                    style={{
                      gridTemplateColumns: "1fr 80px 70px 110px 90px 120px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {/* Pattern ID → link to detail */}
                    <Link
                      href={`/learning/${c.id}`}
                      className="flex items-center gap-1.5 group min-w-0"
                    >
                      <span className="font-mono text-xs font-semibold truncate group-hover:text-cyan-300 transition-colors"
                        style={{ color: "var(--text-1)" }}>
                        {c.llm_pattern_id ?? c.id}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 shrink-0 transition-opacity"
                        style={{ color: "var(--cyan)" }} />
                    </Link>

                    {/* Category */}
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-center"
                      style={{ background: `${catColor}18`, color: catColor }}
                    >
                      {c.llm_category ?? "—"}
                    </span>

                    {/* Sightings */}
                    <span className="text-xs font-mono text-right" style={{ color: "#fbbf24" }}>
                      ×{c.unmatched_count}
                    </span>

                    {/* Confidence */}
                    <ConfidenceBar value={c.llm_confidence ?? 0} />

                    {/* Status */}
                    <StatusBadge status={c.status} />

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5">
                      {superAdmin && c.status === "ready_for_review" && (
                        <>
                          <button
                            onClick={() => handleAction(c.id, "approve")}
                            disabled={!!busy}
                            title="Approve"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background: "rgba(74,222,128,0.10)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAction(c.id, "promote")}
                            disabled={!!busy}
                            title="Promote live"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background: "rgba(0,212,255,0.10)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.25)" }}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {superAdmin && c.status === "approved" && (
                        <button
                          onClick={() => handleAction(c.id, "promote")}
                          disabled={!!busy}
                          title="Promote live"
                          className="btn-primary btn-sm gap-1"
                          style={{ fontSize: 11 }}
                        >
                          <Zap className="w-3 h-3" /> Promote
                        </button>
                      )}
                      {superAdmin && ["pending", "ready_for_review", "approved"].includes(c.status) && (
                        <button
                          onClick={() => handleAction(c.id, "reject")}
                          disabled={!!busy}
                          title="Reject"
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                          style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Detail link always visible */}
                      <Link
                        href={`/learning/${c.id}`}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: "var(--surface-2)", color: "var(--text-3)", border: "1px solid var(--border)" }}
                        title="View detail"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-3)" }}>
              <span>{total} candidates total</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-ghost btn-sm"
                >
                  Previous
                </button>
                <span className="px-3 py-1 rounded-lg"
                  style={{ background: "var(--surface-2)", color: "var(--text-1)" }}>
                  {page}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 50 >= total}
                  className="btn-ghost btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Jobs view ── */}
      {view === "jobs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => loadJobs(jobsPage)}
              disabled={jobsLoading}
              className="btn-ghost btn-sm gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${jobsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {jobsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="panel p-12 text-center">
              <p className="text-sm" style={{ color: "var(--text-3)" }}>No job records yet</p>
            </div>
          ) : (
            <div className="panel overflow-hidden">
              {jobs.map((job, i) => {
                const isScheduled = job.type === "scheduled_run";
                const isManual    = job.type === "manual_auto_promote";
                const typeColor   = isScheduled ? "#60a5fa" : isManual ? "#00ff87" : "#fbbf24";
                const statusColor = job.status === "completed" ? "#4ade80"
                  : job.status === "failed" ? "#f87171"
                  : job.status === "running" ? "#fbbf24"
                  : "#94a3b8";

                return (
                  <div
                    key={i}
                    className="flex items-start gap-4 px-4 py-3"
                    style={{ borderBottom: i < jobs.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: typeColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold font-mono" style={{ color: "var(--text-1)" }}>
                          {job.type}
                        </span>
                        {job.status && (
                          <span className="text-[10px] font-semibold" style={{ color: statusColor }}>
                            {job.status}
                          </span>
                        )}
                        {job.outcome && (
                          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                            → {job.outcome}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>
                        {job.triggered_by && <span>by {job.triggered_by}</span>}
                        {job.triggered_at && (
                          <span>{new Date(job.triggered_at).toLocaleString()}</span>
                        )}
                        {job.updated_at && !job.triggered_at && (
                          <span>{new Date(job.updated_at).toLocaleString()}</span>
                        )}
                        {job.candidate_id && (
                          <Link
                            href={`/learning/${job.candidate_id}`}
                            className="underline hover:opacity-80"
                            style={{ color: "var(--cyan)" }}
                          >
                            candidate {job.candidate_id.slice(0, 8)}
                          </Link>
                        )}
                      </div>

                      {/* Summary row */}
                      {job.summary && (
                        <div className="flex gap-3 mt-1.5 text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
                          {Object.entries(job.summary).map(([k, v]) => (
                            <span key={k}>
                              <span style={{ color: "var(--text-2)" }}>{k.replace(/_/g, " ")}: </span>
                              <span style={{ color: "#fbbf24" }}>{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {job.error && (
                        <div className="mt-1 text-[11px]" style={{ color: "#f87171" }}>
                          Error: {job.error}
                        </div>
                      )}
                    </div>

                    {job.completed_at && (
                      <span className="text-[10px] shrink-0" style={{ color: "var(--text-3)" }}>
                        {new Date(job.completed_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Jobs pagination */}
          {jobsTotal > 30 && (
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-3)" }}>
              <span>{jobsTotal} job records total</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setJobsPage(p => Math.max(1, p - 1))}
                  disabled={jobsPage === 1}
                  className="btn-ghost btn-sm"
                >
                  Previous
                </button>
                <span className="px-3 py-1 rounded-lg"
                  style={{ background: "var(--surface-2)", color: "var(--text-1)" }}>
                  {jobsPage}
                </span>
                <button
                  onClick={() => setJobsPage(p => p + 1)}
                  disabled={jobsPage * 30 >= jobsTotal}
                  className="btn-ghost btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
