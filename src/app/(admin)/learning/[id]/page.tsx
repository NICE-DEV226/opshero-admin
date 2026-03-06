"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Zap, CheckCircle, XCircle, ShieldCheck,
  AlertCircle, RefreshCw, Copy, Check, ChevronDown, ChevronUp,
  Clock, Tag, TrendingUp,
} from "lucide-react";
import {
  learningApi,
  LearningCandidate,
  GeneratePatternResult,
  ValidateRegexResult,
} from "@/lib/admin-api";
import { isSuperAdmin } from "@/lib/admin-auth";

// ── helpers ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
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

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {m.label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="w-6 h-6 rounded flex items-center justify-center transition-opacity hover:opacity-80"
      style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-3)" }}>
      {copied ? <Check className="w-3 h-3" style={{ color: "#4ade80" }} /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function Section({ title, children, collapsible = false }: {
  title: string; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="panel overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ 
          cursor: collapsible ? "pointer" : "default", 
          borderBottom: open ? "1px solid var(--border)" : "none" 
        }}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
          {title}
        </span>
        {collapsible && (
          open ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-3)" }} />
               : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-3)" }} />
        )}
      </div>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const superAdmin = isSuperAdmin();

  const [candidate, setCandidate] = useState<LearningCandidate | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  // generate-pattern state
  const [generating, setGenerating]     = useState(false);
  const [genResult, setGenResult]       = useState<GeneratePatternResult | null>(null);

  // validate-regex state
  const [validating, setValidating]     = useState(false);
  const [valResult, setValResult]       = useState<ValidateRegexResult | null>(null);

  // action state
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await learningApi.getCandidate(id);
      setCandidate(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load candidate");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── generate pattern ──────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    setGenResult(null);
    setError(null);
    try {
      const result = await learningApi.generatePattern(id);
      setGenResult(result);
      if (result.success) {
        showToast("Pattern generated — review below before promoting");
        load(); // refresh to show updated candidate
      } else {
        setError(result.error ?? "Generation failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation request failed");
    } finally {
      setGenerating(false);
    }
  }

  // ── validate regex ────────────────────────────────────────────────────────

  async function handleValidate() {
    setValidating(true);
    setValResult(null);
    setError(null);
    try {
      const result = await learningApi.validateRegex(id);
      setValResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validate request failed");
    } finally {
      setValidating(false);
    }
  }

  // ── approve / promote / reject ────────────────────────────────────────────

  async function handleAction(action: "approve" | "promote" | "reject") {
    setActionBusy(action);
    setError(null);
    try {
      if (action === "approve")  await learningApi.approve(id);
      if (action === "promote")  await learningApi.promote(id);
      if (action === "reject")   await learningApi.reject(id);
      showToast(`Candidate ${action}d successfully`);
      if (action === "promote" || action === "reject") {
        router.push("/learning");
      } else {
        load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setActionBusy(null);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl">
        <div className="skeleton h-8 w-64 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (error && !candidate) {
    return (
      <div className="p-6">
        <Link href="/learning" className="btn-ghost btn-sm gap-1.5 mb-4 inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="panel p-6 text-center" style={{ color: "#f87171" }}>
          {error}
        </div>
      </div>
    );
  }

  const c = candidate!;
  const catColor = CATEGORY_COLOR[c.llm_category ?? "other"] ?? "#94a3b8";
  const hasPatternData = !!c.pattern_data && Object.keys(c.pattern_data).length > 0;
  const regex = (c.pattern_data as Record<string, Record<string, string>> | undefined)
    ?.detection?.regex ?? "";
  const isActionable = ["pending", "ready_for_review", "approved"].includes(c.status);

  return (
    <div className="p-6 space-y-5 max-w-3xl">

      {/* Back + breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/learning" className="btn-ghost btn-sm gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <span style={{ color: "var(--text-3)" }}>/</span>
        <span className="font-mono text-sm" style={{ color: "var(--text-2)" }}>
          {c.llm_pattern_id}
        </span>
      </div>

      {/* Error banner */}
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
          <CheckCircle className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* Header card */}
      <div className="panel p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono font-bold text-lg" style={{ color: "var(--text-1)" }}>
                {c.llm_pattern_id}
              </h1>
              <StatusBadge status={c.status} />
            </div>
            {c.llm_error_type && (
              <p className="text-sm" style={{ color: "var(--text-2)" }}>{c.llm_error_type}</p>
            )}
            <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "var(--text-3)" }}>
              {c.llm_category && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span style={{ color: catColor }}>{c.llm_category}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span style={{ color: "#fbbf24" }}>×{c.unmatched_count} sightings</span>
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span style={{ color: c.llm_confidence >= 0.85 ? "#4ade80" : "#fbbf24" }}>
                  {(c.llm_confidence * 100).toFixed(0)}% confidence
                </span>
              </span>
              {c.last_seen_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(c.last_seen_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {superAdmin && isActionable && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Generate pattern */}
              <button
                onClick={handleGenerate}
                disabled={generating || !!actionBusy}
                className="btn-primary btn-sm gap-1.5"
              >
                {generating ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                ) : <Zap className="w-3.5 h-3.5" />}
                {generating ? "Generating…" : "Generate Pattern"}
              </button>

              {/* Approve (if ready_for_review) */}
              {c.status === "ready_for_review" && (
                <button
                  onClick={() => handleAction("approve")}
                  disabled={!!actionBusy}
                  className="btn-sm flex items-center gap-1.5"
                  style={{ background: "rgba(74,222,128,0.10)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 8, padding: "6px 12px" }}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve
                </button>
              )}

              {/* Promote live */}
              {["approved", "ready_for_review"].includes(c.status) && (
                <button
                  onClick={() => handleAction("promote")}
                  disabled={!!actionBusy || !hasPatternData}
                  title={!hasPatternData ? "Generate a pattern first" : undefined}
                  className="btn-sm flex items-center gap-1.5"
                  style={{ background: "rgba(0,212,255,0.10)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.25)", borderRadius: 8, padding: "6px 12px" }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {actionBusy === "promote" ? "Promoting…" : "Promote Live"}
                </button>
              )}

              {/* Reject */}
              <button
                onClick={() => handleAction("reject")}
                disabled={!!actionBusy}
                className="btn-sm flex items-center gap-1.5"
                style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "6px 12px" }}
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          )}
        </div>

        {/* Causal hint */}
        {c.llm_causal_hint && (
          <div className="mt-4 pt-4 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--text-2)" }}>
            <span style={{ color: "var(--text-3)" }}>Causal hint: </span>
            {c.llm_causal_hint}
          </div>
        )}
      </div>

      {/* Example log */}
      {c.example_log_snippet && (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Example Log Snippet
            </span>
            <CopyButton text={c.example_log_snippet} />
          </div>
          <pre
            className="p-5 text-[11px] overflow-x-auto"
            style={{
              background: "#02050d",
              color: "var(--acid)",
              fontFamily: "JetBrains Mono, monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              maxHeight: 280,
            }}
          >
            {c.example_log_snippet}
          </pre>
        </div>
      )}

      {/* Auto-extracted regex hint */}
      {c.suggested_regex && (
        <div className="panel p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Auto-Extracted Regex (heuristic)
            </span>
            <CopyButton text={c.suggested_regex} />
          </div>
          <code
            className="block text-xs rounded-lg px-3 py-2 break-all"
            style={{ background: "#02050d", color: "#fbbf24", fontFamily: "JetBrains Mono, monospace", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            {c.suggested_regex}
          </code>
          {c.extracted_keywords && c.extracted_keywords.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Keywords:</span>
              {c.extracted_keywords.map(k => (
                <span key={k}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: "rgba(0,212,255,0.08)", color: "var(--cyan)", border: "1px solid rgba(0,212,255,0.15)" }}>
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generation result */}
      {genResult && (
        <div
          className="panel p-5 space-y-3"
          style={{ border: `1px solid ${genResult.success ? "rgba(0,255,135,0.2)" : "rgba(248,113,113,0.2)"}` }}
        >
          <div className="flex items-center gap-2">
            {genResult.success
              ? <CheckCircle className="w-4 h-4" style={{ color: "#00ff87" }} />
              : <AlertCircle className="w-4 h-4" style={{ color: "#f87171" }} />}
            <span className="text-sm font-semibold" style={{ color: genResult.success ? "#00ff87" : "#f87171" }}>
              {genResult.success ? "Pattern Generated" : "Generation Failed"}
            </span>
            {genResult.model && (
              <span className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>
                {genResult.model} · {genResult.latency_ms}ms · {(genResult.input_tokens ?? 0) + (genResult.output_tokens ?? 0)} tokens
              </span>
            )}
          </div>

          {genResult.success && genResult.validation_errors && genResult.validation_errors.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold" style={{ color: "#fbbf24" }}>Validation issues (fix before promoting):</div>
              {genResult.validation_errors.map((e, i) => (
                <div key={i} className="text-xs flex gap-1.5" style={{ color: "#fca5a5" }}>
                  <span>•</span>{e}
                </div>
              ))}
            </div>
          )}

          {genResult.success && genResult.is_valid && (
            <div className="text-xs flex items-center gap-1.5" style={{ color: "#4ade80" }}>
              <CheckCircle className="w-3.5 h-3.5" />
              Schema validation passed — ready to promote
            </div>
          )}

          {genResult.error && (
            <div className="text-xs" style={{ color: "#fca5a5" }}>{genResult.error}</div>
          )}
        </div>
      )}

      {/* Validate regex */}
      {hasPatternData && regex && (
        <div className="panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Regex Validation
            </span>
            <button
              onClick={handleValidate}
              disabled={validating}
              className="btn-outline btn-sm gap-1.5"
            >
              {validating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : <ShieldCheck className="w-3.5 h-3.5" />}
              {validating ? "Testing…" : "Test Regex Against Examples"}
            </button>
          </div>

          {/* Current regex */}
          <div className="flex items-center justify-between gap-3">
            <code
              className="flex-1 block text-xs rounded-lg px-3 py-2 break-all"
              style={{ background: "#02050d", color: "#fbbf24", fontFamily: "JetBrains Mono, monospace", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {regex}
            </code>
            <CopyButton text={regex} />
          </div>

          {/* Validation results */}
          {valResult && (
            <div className="space-y-3">
              {!valResult.valid_regex ? (
                <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(248,113,113,0.08)", color: "#fca5a5", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <strong>Compile error:</strong> {valResult.compile_error}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {valResult.all_matched
                      ? <CheckCircle className="w-4 h-4" style={{ color: "#4ade80" }} />
                      : <AlertCircle className="w-4 h-4" style={{ color: "#fbbf24" }} />}
                    <span className="text-sm font-semibold"
                      style={{ color: valResult.all_matched ? "#4ade80" : "#fbbf24" }}>
                      {valResult.all_matched
                        ? `All ${valResult.examples_tested} example(s) matched`
                        : `Some examples did not match (${valResult.examples_tested} tested)`}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {valResult.results?.map((r, i) => (
                      <div key={i}
                        className="rounded-lg p-3 space-y-1"
                        style={{ background: r.matched ? "rgba(74,222,128,0.04)" : "rgba(248,113,113,0.04)", border: `1px solid ${r.matched ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}` }}
                      >
                        <div className="flex items-center gap-2">
                          {r.matched
                            ? <Check className="w-3.5 h-3.5" style={{ color: "#4ade80" }} />
                            : <XCircle className="w-3.5 h-3.5" style={{ color: "#f87171" }} />}
                          <span className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
                            {r.source}
                          </span>
                        </div>
                        <pre className="text-[10px] overflow-x-auto"
                          style={{ color: "var(--text-2)", fontFamily: "JetBrains Mono, monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                          {r.snippet_preview}
                        </pre>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Generated pattern data */}
      {hasPatternData && (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Generated Pattern Data
            </span>
            <div className="flex items-center gap-2">
              {c.generation_model && (
                <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                  {c.generation_model} · {c.generation_latency_ms}ms
                </span>
              )}
              <CopyButton text={JSON.stringify(c.pattern_data, null, 2)} />
            </div>
          </div>

          {/* Validation errors */}
          {c.validation_errors && c.validation_errors.length > 0 && (
            <div className="px-5 pt-4 space-y-1.5">
              <div className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
                Schema Validation Errors ({c.validation_errors.length})
              </div>
              {c.validation_errors.map((e, i) => (
                <div key={i} className="text-xs flex gap-1.5" style={{ color: "#fca5a5" }}>
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{e}
                </div>
              ))}
            </div>
          )}

          <pre
            className="p-5 text-[11px] overflow-x-auto"
            style={{
              background: "#02050d",
              color: "#e2e8f0",
              fontFamily: "JetBrains Mono, monospace",
              whiteSpace: "pre",
              maxHeight: 500,
              borderTop: c.validation_errors?.length ? "1px solid var(--border)" : "none",
            }}
          >
            {JSON.stringify(c.pattern_data, null, 2)}
          </pre>
        </div>
      )}

      {/* Admin notes */}
      {c.admin_notes && (
        <div className="panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-3)" }}>
            Admin Notes
          </div>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>{c.admin_notes}</p>
        </div>
      )}

      {/* Promoted info */}
      {(c.status === "promoted" || c.status === "auto_promoted") && c.promoted_pattern_id && (
        <div className="panel p-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5" style={{ color: "#00ff87" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "#00ff87" }}>Live in Pattern Library</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Pattern ID:{" "}
              <Link href={`/patterns/${c.promoted_pattern_id}`}
                className="underline hover:opacity-80"
                style={{ color: "var(--cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                {c.promoted_pattern_id}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
