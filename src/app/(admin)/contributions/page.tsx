"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { contributionsApi, type Contribution, type ContributionListResponse } from "@/lib/admin-api";
import { GitPullRequest, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  pending_ci:        { label: "CI Running",       color: "#fde047", bg: "rgba(250,204,21,0.10)", border: "rgba(250,204,21,0.25)", icon: Clock },
  pending_review:    { label: "Needs Review",     color: "#a5b4fc", bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.25)", icon: GitPullRequest },
  approved:          { label: "Approved",          color: "#4ade80", bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.25)", icon: CheckCircle },
  rejected:          { label: "Rejected",          color: "#fca5a5", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)",  icon: XCircle },
  changes_requested: { label: "Changes Req.",     color: "#fdba74", bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.25)", icon: Clock },
};

const FILTERS = ["all", "pending_review", "pending_ci", "approved", "rejected", "changes_requested"];

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await contributionsApi.list(filter === "all" ? undefined : filter);
      setContributions(res.items ?? []);
    } catch {
      setContributions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = contributions.filter(c => c.status === "pending_review").length;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Contributions
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            Community pattern pull requests
            {pendingCount > 0 && (
              <span
                className="ml-2 px-2 py-0.5 rounded-md text-xs font-semibold"
                style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.25)" }}
              >
                {pendingCount} pending review
              </span>
            )}
          </p>
        </div>
        <button onClick={load} className="btn-ghost btn-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
            style={{
              background: filter === f ? "rgba(99,102,241,0.15)" : "var(--surface)",
              color: filter === f ? "var(--accent)" : "var(--text-3)",
              border: filter === f ? "1px solid rgba(99,102,241,0.30)" : "1px solid var(--border)",
            }}
          >
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Contribution cards */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="panel p-4">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-5 w-16 rounded" />
                  <div className="skeleton h-5 flex-1 rounded" />
                  <div className="skeleton h-5 w-24 rounded" />
                </div>
              </div>
            ))
          : contributions.length === 0
          ? (
            <div className="panel py-16 text-center" style={{ color: "var(--text-3)" }}>
              <GitPullRequest className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No contributions for this filter.</p>
            </div>
          )
          : contributions.map(c => {
              const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending_ci;
              const StatusIcon = cfg.icon;
              const age = Math.round(
                (Date.now() - new Date(c.updated_at).getTime()) / 3_600_000,
              );

              return (
                <div key={c.pr_number} className="panel p-4">
                  <div className="flex items-center gap-4">
                    {/* Status badge */}
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </span>

                    {/* PR info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-xs flex-shrink-0"
                          style={{ color: "var(--text-3)" }}
                        >
                          #{c.pr_number}
                        </span>
                        <span
                          className="font-medium text-sm truncate"
                          style={{ color: "var(--text-1)" }}
                        >
                          {c.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "var(--text-3)" }}>
                        <span>@{c.author_github}</span>
                        {c.author_previous_accepted > 0 && (
                          <span style={{ color: "#fde047" }}>
                            ⭐ {c.author_previous_accepted} accepted
                          </span>
                        )}
                        <span>{age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`}</span>
                        {c.ci_passed && (
                          <span style={{ color: "#4ade80" }}>✓ CI passed</span>
                        )}
                        {c.quality_score !== undefined && (
                          <span>Score: {c.quality_score}/100</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.pr_url && (
                        <a
                          href={c.pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost btn-sm text-xs"
                        >
                          GitHub ↗
                        </a>
                      )}
                      <Link href={`/contributions/${c.id ?? c.pr_number}`} className="btn-primary btn-sm">
                        Review
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
