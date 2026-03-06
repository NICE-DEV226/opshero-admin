"use client";

import { useEffect, useState } from "react";
import { announcementsApi, type Announcement } from "@/lib/admin-api";
import { Plus, Megaphone, Trash2, Eye, EyeOff } from "lucide-react";

const TYPE_CONFIG = {
  info:        { color: "#38dcff", bg: "rgba(56,220,255,0.08)",  border: "rgba(56,220,255,0.2)" },
  warning:     { color: "#fde047", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.2)" },
  maintenance: { color: "#fca5a5", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)" },
  feature:     { color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  billing:     { color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.2)" },
} as const;

const ALL_TIERS = ["free", "pro", "team", "enterprise"] as const;

/** Returns current local date-time string for <input type="datetime-local">.
 *  We shift by the local UTC offset so JS correctly parses it back as local time. */
function localNow(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const EMPTY_FORM = () => ({
  type: "info" as Announcement["type"],
  title: "",
  message: "",
  target_tiers: ["free", "pro", "team"] as string[],
  dismissible: true,
  show_from: localNow(),   // evaluated at call-time so it's always "now"
  show_until: "",
  cta_text: "",
  cta_url: "",
  active: true,
});

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setLoading(true);
    try {
      const res = await announcementsApi.list();
      setList(Array.isArray(res) ? res : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY_FORM);   // resets form AND refreshes show_from to current time
    setSubmitError(null);
    setCreating(true);
  }

  function toggleTier(tier: string) {
    setForm(f => ({
      ...f,
      target_tiers: f.target_tiers.includes(tier)
        ? f.target_tiers.filter(t => t !== tier)
        : [...f.target_tiers, tier],
    }));
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.message.trim()) {
      setSubmitError("Title and message are required.");
      return;
    }
    if (form.target_tiers.length === 0) {
      setSubmitError("Select at least one target tier.");
      return;
    }
    setSubmitError(null);
    try {
      const created = await announcementsApi.create({
        ...form,
        // datetime-local string → parsed as local time → stored as UTC ISO
        show_from: new Date(form.show_from).toISOString(),
        show_until: form.show_until ? new Date(form.show_until).toISOString() : undefined,
        cta_text: form.cta_text || undefined,
        cta_url: form.cta_url || undefined,
      });
      setList(prev => [created, ...prev]);
      setCreating(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function handleToggle(ann: Announcement) {
    try {
      await announcementsApi.update(ann.id, { active: !ann.active });
      setList(prev => prev.map(a => a.id === ann.id ? { ...a, active: !a.active } : a));
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement permanently?")) return;
    try {
      await announcementsApi.delete(id);
      setList(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Announcements
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            Banners, maintenance alerts, and feature announcements visible to users
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Announcement
        </button>
      </div>

      {/* ── Create form ── */}
      {creating && (
        <div className="panel p-5 space-y-4">
          <h2 className="section-label">New Announcement</h2>

          {submitError && (
            <div className="text-xs px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as Announcement["type"] }))}
                className="input text-xs"
              >
                {Object.keys(TYPE_CONFIG).map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                Title <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="input text-xs"
                placeholder="e.g. Scheduled maintenance Feb 28"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
              Message <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={3}
              className="input text-xs resize-none"
              placeholder="Full announcement text shown to users…"
            />
          </div>

          {/* Target tiers */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-2)" }}>
              Target tiers <span style={{ color: "var(--danger)" }}>*</span>
              <span className="ml-1 font-normal" style={{ color: "var(--text-3)" }}>
                — announcement is shown only to users on selected tiers
              </span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {ALL_TIERS.map(t => {
                const active = form.target_tiers.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTier(t)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: active ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
                      color:      active ? "#a5b4fc"                : "var(--text-3)",
                      border:     active ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, target_tiers: [...ALL_TIERS] }))}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-3)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Select all
              </button>
            </div>
          </div>

          {/* Schedule — datetime-local inputs always show/submit local time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                Show from <span className="font-normal" style={{ color: "var(--text-3)" }}>(your local time)</span>
              </label>
              <input
                type="datetime-local"
                value={form.show_from}
                onChange={e => setForm(f => ({ ...f, show_from: e.target.value }))}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                Show until <span className="font-normal" style={{ color: "var(--text-3)" }}>(leave empty = no expiry)</span>
              </label>
              <input
                type="datetime-local"
                value={form.show_until}
                onChange={e => setForm(f => ({ ...f, show_until: e.target.value }))}
                className="input text-xs"
              />
            </div>
          </div>

          {/* CTA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                Button text <span className="font-normal" style={{ color: "var(--text-3)" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={form.cta_text}
                onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))}
                className="input text-xs"
                placeholder="e.g. Learn more"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                Button URL <span className="font-normal" style={{ color: "var(--text-3)" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={form.cta_url}
                onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))}
                className="input text-xs"
                placeholder="https://…"
              />
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.dismissible}
                onChange={e => setForm(f => ({ ...f, dismissible: e.target.checked }))}
              />
              <span className="text-xs" style={{ color: "var(--text-2)" }}>Dismissible (users can close it)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              />
              <span className="text-xs" style={{ color: "var(--text-2)" }}>Publish immediately</span>
            </label>
          </div>

          <div className="flex gap-3 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={handleCreate} className="btn-primary btn-sm mt-3">Create & publish</button>
            <button onClick={() => setCreating(false)} className="btn-ghost btn-sm mt-3">Cancel</button>
          </div>
        </div>
      )}

      {/* ── List ── */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="panel p-4">
                <div className="skeleton h-5 w-48 rounded mb-2" />
                <div className="skeleton h-4 w-full rounded" />
              </div>
            ))
          : list.length === 0
          ? (
            <div className="panel py-16 text-center" style={{ color: "var(--text-3)" }}>
              <Megaphone className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No announcements yet. Create one to notify your users.</p>
            </div>
          )
          : list.map(ann => {
              const cfg = TYPE_CONFIG[ann.type] ?? TYPE_CONFIG.info;
              return (
                <div
                  key={ann.id}
                  className="panel p-4"
                  style={{ opacity: ann.active ? 1 : 0.55 }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0 mt-0.5"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                    >
                      {ann.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>
                          {ann.title}
                        </span>
                        {!ann.active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-3)", border: "1px solid rgba(255,255,255,0.10)" }}>
                            PAUSED
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                        {ann.message.slice(0, 140)}{ann.message.length > 140 && "…"}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs flex-wrap" style={{ color: "var(--text-3)" }}>
                        <span>
                          Tiers: <strong style={{ color: "var(--text-2)" }}>{ann.target_tiers.join(", ")}</strong>
                        </span>
                        <span>From: {new Date(ann.show_from).toLocaleString()}</span>
                        {ann.show_until && (
                          <span>Until: {new Date(ann.show_until).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggle(ann)}
                        className="btn-ghost btn-sm py-1 px-2"
                        title={ann.active ? "Pause (hide from users)" : "Activate (show to users)"}
                      >
                        {ann.active
                          ? <Eye className="w-3.5 h-3.5" style={{ color: "#4ade80" }} />
                          : <EyeOff className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(ann.id)}
                        className="btn-ghost btn-sm py-1 px-2"
                        title="Delete permanently"
                        style={{ color: "#fca5a5" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
