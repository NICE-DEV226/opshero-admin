"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mail,
  Send,
  Users,
  Eye,
  EyeOff,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { emailApi, EmailTemplate, EmailStats } from "@/lib/admin-api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "broadcast" | "single";
type Segment = "all" | "free" | "pro" | "team";

interface FormState {
  mode: Mode;
  segment: Segment;
  addresses: string;       // comma-separated for single mode
  template: string;
  subject: string;
  body: string;
  dryRun: boolean;
}

interface SendResult {
  ok: boolean;
  message: string;
  detail?: string;
}

const SEGMENTS: { value: Segment; label: string; desc: string }[] = [
  { value: "all",  label: "All users",   desc: "Everyone with an email address" },
  { value: "free", label: "Free tier",   desc: "Users on the free plan" },
  { value: "pro",  label: "Pro tier",    desc: "Pro subscribers" },
  { value: "team", label: "Team tier",   desc: "Team subscribers" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminEmailPage() {
  const [templates, setTemplates]   = useState<EmailTemplate[]>([]);
  const [stats, setStats]           = useState<EmailStats | null>(null);
  const [form, setForm]             = useState<FormState>({
    mode:      "broadcast",
    segment:   "all",
    addresses: "",
    template:  "welcome",
    subject:   "",
    body:      "",
    dryRun:    false,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl]   = useState<string>("");
  const [sending, setSending]         = useState(false);
  const [result, setResult]           = useState<SendResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load templates + stats on mount
  useEffect(() => {
    emailApi.getTemplates().then(setTemplates).catch(console.error);
    refreshStats();
  }, []);

  // Regenerate preview URL when template / body / subject changes
  useEffect(() => {
    if (!form.template) return;
    const url = emailApi.previewUrl(form.template, {
      subject: form.subject || undefined,
      body:    form.body    || undefined,
    });
    setPreviewUrl(url);
  }, [form.template, form.subject, form.body]);

  async function refreshStats() {
    try {
      const s = await emailApi.getStats();
      setStats(s);
    } catch { /* ignore */ }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setResult(null);
  }

  function validate(): string | null {
    if (form.mode === "single" && !form.addresses.trim()) return "Enter at least one recipient address.";
    if (!form.template) return "Select a template.";
    if (form.template === "custom" && !form.subject.trim()) return "Subject is required for Custom template.";
    if (form.template === "custom" && !form.body.trim()) return "Body is required for Custom template.";
    return null;
  }

  async function handleSend() {
    const err = validate();
    if (err) { setResult({ ok: false, message: err }); return; }
    setSending(true);
    setResult(null);
    setConfirmOpen(false);
    try {
      if (form.mode === "broadcast") {
        const res = await emailApi.broadcast({
          segment:  form.segment,
          template: form.template,
          subject:  form.subject || undefined,
          body:     form.body    || undefined,
          dry_run:  form.dryRun,
        });
        const msg = form.dryRun
          ? `Dry run — ${res.recipient_count} recipients would receive this email.`
          : res.message ?? "Broadcast queued.";
        setResult({ ok: true, message: msg });
      } else {
        const addresses = form.addresses
          .split(/[,\n]+/)
          .map(a => a.trim())
          .filter(Boolean);
        const res = await emailApi.send({
          to:       addresses,
          template: form.template,
          subject:  form.subject || undefined,
          body:     form.body    || undefined,
        });
        setResult({ ok: true, message: `Sent to ${res.sent} recipient${res.sent !== 1 ? "s" : ""}${res.failed > 0 ? `, ${res.failed} failed` : ""}.` });
      }
      await refreshStats();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setResult({ ok: false, message: msg });
    } finally {
      setSending(false);
    }
  }

  const selectedTemplate = templates.find(t => t.id === form.template);
  const isCustom = form.template === "custom";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: "var(--text-1)" }}>
            Email
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            Send transactional or broadcast emails to users
          </p>
        </div>
        <button
          onClick={refreshStats}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-3)", border: "1px solid var(--border)" }}
        >
          <RefreshCw className="w-3 h-3" /> Refresh stats
        </button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total sent",   value: stats.sent_total.toLocaleString() },
            { label: "Failed",       value: stats.failed_total.toLocaleString() },
            {
              label: "Success rate",
              value: stats.success_rate != null ? `${stats.success_rate}%` : "—",
            },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl px-5 py-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--text-3)" }}>{s.label}</div>
              <div className="font-display font-bold text-2xl" style={{ color: "var(--text-1)" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Compose form ── */}
        <div
          className="rounded-xl p-6 space-y-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span className="font-medium text-sm" style={{ color: "var(--text-1)" }}>Compose</span>
          </div>

          {/* Mode toggle */}
          <div
            className="flex rounded-lg p-1 gap-1"
            style={{ background: "var(--bg)" }}
          >
            {(["broadcast", "single"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => set("mode", m)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: form.mode === m ? "var(--surface)" : "transparent",
                  color:      form.mode === m ? "var(--text-1)"  : "var(--text-3)",
                  border:     form.mode === m ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                {m === "broadcast" ? <Users className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                {m === "broadcast" ? "Broadcast" : "Single / List"}
              </button>
            ))}
          </div>

          {/* Audience */}
          {form.mode === "broadcast" ? (
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: "var(--text-2)" }}>Segment</label>
              <div className="grid grid-cols-2 gap-2">
                {SEGMENTS.map(seg => (
                  <button
                    key={seg.value}
                    onClick={() => set("segment", seg.value)}
                    className="text-left px-3 py-2.5 rounded-lg text-xs transition-all"
                    style={{
                      background: form.segment === seg.value ? "rgba(99,102,241,0.08)" : "var(--bg)",
                      border:     form.segment === seg.value ? "1px solid rgba(99,102,241,0.35)" : "1px solid var(--border)",
                      color:      form.segment === seg.value ? "var(--accent)" : "var(--text-2)",
                    }}
                  >
                    <div className="font-medium">{seg.label}</div>
                    <div className="mt-0.5 opacity-70">{seg.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
                Recipients <span style={{ color: "var(--text-3)" }}>(comma or newline separated)</span>
              </label>
              <textarea
                rows={3}
                placeholder="alice@example.com, bob@example.com"
                value={form.addresses}
                onChange={e => set("addresses", e.target.value)}
                className="input w-full resize-none text-xs font-mono"
              />
            </div>
          )}

          {/* Template selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-2)" }}>Template</label>
            <div className="relative">
              <select
                value={form.template}
                onChange={e => set("template", e.target.value)}
                className="input w-full appearance-none pr-8 text-sm"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: "var(--text-3)" }}
              />
            </div>
            {selectedTemplate && (
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                {selectedTemplate.description}
              </p>
            )}
          </div>

          {/* Subject (custom template or override) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
              Subject{!isCustom && <span style={{ color: "var(--text-3)" }}> (optional override)</span>}
              {isCustom && <span style={{ color: "var(--danger)" }}> *</span>}
            </label>
            <input
              type="text"
              placeholder={isCustom ? "Your subject line" : "Leave blank to use default"}
              value={form.subject}
              onChange={e => set("subject", e.target.value)}
              className="input w-full text-sm"
            />
          </div>

          {/* Body (custom template or preview override) */}
          {isCustom && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
                Body <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <textarea
                rows={5}
                placeholder="Write your message here…"
                value={form.body}
                onChange={e => set("body", e.target.value)}
                className="input w-full resize-none text-sm"
              />
            </div>
          )}

          {/* Dry run */}
          {form.mode === "broadcast" && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => set("dryRun", !form.dryRun)}
                className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
                style={{ background: form.dryRun ? "var(--accent)" : "var(--border)" }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-transform bg-white"
                  style={{ left: form.dryRun ? "calc(100% - 18px)" : "2px" }}
                />
              </div>
              <span className="text-xs" style={{ color: "var(--text-2)" }}>
                Dry run — count recipients without sending
              </span>
            </label>
          )}

          {/* Result banner */}
          {result && (
            <div
              className="flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs"
              style={{
                background: result.ok ? "rgba(0,255,135,0.06)" : "rgba(255,68,68,0.06)",
                border:     `1px solid ${result.ok ? "rgba(0,255,135,0.25)" : "rgba(255,68,68,0.25)"}`,
                color:      result.ok ? "var(--acid)"   : "var(--danger)",
              }}
            >
              {result.ok
                ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              }
              <span>{result.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowPreview(p => !p)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors"
              style={{
                border: "1px solid var(--border)",
                color:  "var(--text-2)",
              }}
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? "Hide preview" : "Preview"}
            </button>
            <button
              onClick={() => {
                const err = validate();
                if (err) { setResult({ ok: false, message: err }); return; }
                setConfirmOpen(true);
              }}
              disabled={sending}
              className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs ml-auto"
            >
              {sending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }
              {sending ? "Sending…" : form.mode === "broadcast" ? "Send broadcast" : "Send"}
            </button>
          </div>
        </div>

        {/* ── Preview pane ── */}
        <div
          className="rounded-xl overflow-hidden flex flex-col"
          style={{
            background: "var(--surface)",
            border:     "1px solid var(--border)",
            minHeight:  "520px",
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <Eye className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span className="font-medium text-sm" style={{ color: "var(--text-1)" }}>Preview</span>
            <span className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>
              {selectedTemplate?.label ?? form.template}
            </span>
          </div>

          {showPreview && previewUrl ? (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="flex-1 w-full"
              style={{ border: "none", background: "#fff", minHeight: "460px" }}
              title="Email preview"
              sandbox="allow-same-origin"
            />
          ) : (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center"
              style={{ color: "var(--text-3)" }}
            >
              <Eye className="w-8 h-8 opacity-30" />
              <p className="text-sm">Click <strong style={{ color: "var(--text-2)" }}>Preview</strong> to see how the email will look</p>
              {selectedTemplate && (
                <div className="mt-2 text-xs space-y-1">
                  <p style={{ color: "var(--text-2)" }}>Template vars:</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {selectedTemplate.vars.map(v => (
                      <code
                        key={v}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ background: "var(--bg)", color: "var(--accent)", border: "1px solid var(--border)" }}
                      >
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm modal ── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(4,8,17,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,176,32,0.1)", border: "1px solid rgba(255,176,32,0.2)" }}
              >
                <Send className="w-5 h-5" style={{ color: "var(--amber)" }} />
              </div>
              <div>
                <div className="font-medium text-sm" style={{ color: "var(--text-1)" }}>
                  Confirm send
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  This action cannot be undone.
                </div>
              </div>
            </div>

            <div
              className="rounded-lg px-4 py-3 text-xs space-y-1.5"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            >
              <Row label="Template"  value={selectedTemplate?.label ?? form.template} />
              {form.mode === "broadcast" ? (
                <>
                  <Row label="Segment" value={SEGMENTS.find(s => s.value === form.segment)?.label ?? form.segment} />
                  {form.dryRun && <Row label="Mode" value="DRY RUN" accent />}
                </>
              ) : (
                <Row
                  label="Recipients"
                  value={form.addresses.split(/[,\n]+/).filter(Boolean).length + " address(es)"}
                />
              )}
              {form.subject && <Row label="Subject" value={form.subject} />}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmOpen(false)}
                className="btn-ghost flex-1 text-sm py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm py-2"
              >
                {sending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
                {form.dryRun ? "Run dry test" : "Send now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: "var(--text-3)", minWidth: "80px" }}>{label}</span>
      <span style={{ color: accent ? "var(--amber)" : "var(--text-1)", fontWeight: accent ? 600 : 400 }}>
        {value}
      </span>
    </div>
  );
}
