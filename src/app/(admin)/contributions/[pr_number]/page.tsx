"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { contributionsApi, type Contribution, AdminApiError } from "@/lib/admin-api";
import {
  ArrowLeft, GitPullRequest, CheckCircle, XCircle, Clock,
  ExternalLink, AlertTriangle,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending_ci:        { label: "CI Running",      color: "#fde047", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.25)"  },
  pending_review:    { label: "Needs Review",    color: "#a5b4fc", bg: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.25)"  },
  approved:          { label: "Approved",         color: "#4ade80", bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.25)"  },
  rejected:          { label: "Rejected",         color: "#fca5a5", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)"   },
  changes_requested: { label: "Changes Req.",    color: "#fdba74", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.25)"  },
};

export default function ContributionReviewPage() {
  const { pr_number } = useParams<{ pr_number: string }>();
  const router = useRouter();
  // pr_number param now holds the string UUID id (for form submissions) or legacy int (GitHub PRs)
  const prId = pr_number;

  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);

  const [rejectReason, setRejectReason] = useState("");
  const [changeMessage, setChangeMessage] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showChangesForm, setShowChangesForm] = useState(false);

  useEffect(() => {
    contributionsApi.get(prId)
      .then(setContribution)
      .catch(() => setError("Contribution not found."))
      .finally(() => setLoading(false));
  }, [prId]);

  async function handleApprove() {
    setActionLoading("approve");
    try {
      await contributionsApi.approve(prId, approveNotes || undefined);
      setActionDone("approved");
      setContribution(prev => prev ? { ...prev, status: "approved" } : prev);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setActionLoading("reject");
    try {
      await contributionsApi.reject(prId, rejectReason);
      setActionDone("rejected");
      setContribution(prev => prev ? { ...prev, status: "rejected" } : prev);
      setShowRejectForm(false);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestChanges() {
    if (!changeMessage.trim()) return;
    setActionLoading("changes");
    try {
      await contributionsApi.requestChanges(prId, changeMessage);
      setActionDone("changes_requested");
      setContribution(prev => prev ? { ...prev, status: "changes_requested" } : prev);
      setShowChangesForm(false);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-40 rounded" />
        <div className="skeleton h-32 rounded" />
      </div>
    );
  }

  if (error || !contribution) {
    return (
      <div className="p-6">
        <button onClick={() => router.push("/contributions")} className="btn-ghost btn-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error ?? "Contribution not found."}
        </div>
      </div>
    );
  }

  const sc = STATUS_CONFIG[contribution.status] ?? STATUS_CONFIG.pending_review;
  const canReview = ["pending_review", "pending_ci"].includes(contribution.status);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/contributions")} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
            >
              {sc.label}
            </span>
            <h1 className="font-display text-xl font-bold" style={{ color: "var(--text-1)" }}>
              {contribution.pr_number ? `PR #${contribution.pr_number} — ` : ""}{contribution.title}
            </h1>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            by @{contribution.author_github}
            {contribution.category && <> · <span className="font-mono">{contribution.category}</span></>}
            {" · "} submitted {new Date(contribution.created_at).toLocaleDateString()}
          </p>
        </div>
        {contribution.pr_url && (
          <a
            href={contribution.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline btn-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open on GitHub
          </a>
        )}
      </div>

      {/* Action done banner */}
      {actionDone && (
        <div
          className="flex items-center gap-3 p-3 rounded-xl text-sm"
          style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}
        >
          <CheckCircle className="w-4 h-4" />
          Action recorded: <strong>{actionDone.replace("_", " ")}</strong>
        </div>
      )}

      {error && (
        <div
          className="flex items-center gap-3 p-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
        >
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Meta cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "CI Status",    value: contribution.ci_passed ? "Passed ✓" : "Failed ✗",  color: contribution.ci_passed ? "#4ade80" : "#fca5a5" },
          { label: "Quality Score", value: contribution.quality_score != null ? `${contribution.quality_score}/100` : "—", color: "var(--text-1)" },
          { label: "Author PRs",   value: `${contribution.author_previous_accepted} accepted`, color: contribution.author_previous_accepted > 0 ? "#fde047" : "var(--text-2)" },
          { label: "Last Update",  value: new Date(contribution.updated_at).toLocaleDateString(), color: "var(--text-2)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="panel p-4">
            <div className="text-xs mb-1" style={{ color: "var(--text-3)" }}>{label}</div>
            <div className="text-sm font-semibold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Form submission content */}
      {contribution.type === "form_submission" && (
        <div className="panel p-5 space-y-4">
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>Submission Details</h2>
          {contribution.description && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-3)" }}>Description</p>
              <p className="text-sm" style={{ color: "var(--text-2)" }}>{contribution.description}</p>
            </div>
          )}
          {contribution.suggested_fix && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-3)" }}>Suggested Fix</p>
              <p className="text-sm" style={{ color: "var(--text-2)" }}>{contribution.suggested_fix}</p>
            </div>
          )}
          {contribution.regex_hint && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-3)" }}>Regex Hint</p>
              <code className="text-xs px-2 py-1 rounded" style={{ background: "var(--surface-2)", color: "var(--acid)", border: "1px solid var(--border)" }}>
                {contribution.regex_hint}
              </code>
            </div>
          )}
        </div>
      )}

      {/* Review actions */}
      {canReview && !actionDone && (
        <div className="panel p-5 space-y-4">
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>Review Actions</h2>

          {/* Approve */}
          <div className="space-y-2">
            <textarea
              value={approveNotes}
              onChange={e => setApproveNotes(e.target.value)}
              placeholder="Optional approval notes…"
              rows={2}
              className="input-mono w-full resize-none"
            />
            <button
              onClick={handleApprove}
              disabled={actionLoading !== null}
              className="btn-success"
            >
              {actionLoading === "approve" ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
              ) : <CheckCircle className="w-4 h-4" />}
              Approve & Merge
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--border)" }} />

          {/* Request changes */}
          {!showChangesForm ? (
            <button onClick={() => setShowChangesForm(true)} className="btn-outline btn-sm">
              <Clock className="w-3.5 h-3.5" />
              Request Changes
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={changeMessage}
                onChange={e => setChangeMessage(e.target.value)}
                placeholder="Describe what needs to be changed…"
                rows={3}
                className="input-mono w-full resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRequestChanges}
                  disabled={!changeMessage.trim() || actionLoading !== null}
                  className="btn-outline btn-sm"
                >
                  {actionLoading === "changes" ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                      style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "var(--text-2)" }} />
                  ) : <Clock className="w-3.5 h-3.5" />}
                  Send Request
                </button>
                <button onClick={() => setShowChangesForm(false)} className="btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* Reject */}
          {!showRejectForm ? (
            <button onClick={() => setShowRejectForm(true)} className="btn-danger btn-sm">
              <XCircle className="w-3.5 h-3.5" />
              Reject PR
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection…"
                rows={3}
                className="input-mono w-full resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || actionLoading !== null}
                  className="btn-danger btn-sm"
                >
                  {actionLoading === "reject" ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                      style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fca5a5" }} />
                  ) : <XCircle className="w-3.5 h-3.5" />}
                  Confirm Reject
                </button>
                <button onClick={() => setShowRejectForm(false)} className="btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Already reviewed */}
      {!canReview && !actionDone && (
        <div
          className="panel p-4 flex items-center gap-3 text-sm"
          style={{ color: "var(--text-3)" }}
        >
          <GitPullRequest className="w-4 h-4" />
          This PR has already been reviewed ({contribution.status.replace(/_/g, " ")}).
        </div>
      )}
    </div>
  );
}
