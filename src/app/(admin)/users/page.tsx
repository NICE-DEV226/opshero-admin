"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usersApi, type AdminUser } from "@/lib/admin-api";
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, Download,
  UserX, UserCheck, CreditCard, ExternalLink, AlertTriangle,
} from "lucide-react";

// ── Config ─────────────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  free:       { bg: "rgba(148,163,184,0.08)", color: "#94a3b8", border: "rgba(148,163,184,0.2)" },
  pro:        { bg: "rgba(99,102,241,0.10)",  color: "#a5b4fc", border: "rgba(99,102,241,0.25)" },
  team:       { bg: "rgba(56,220,255,0.10)",  color: "#67e8f9", border: "rgba(56,220,255,0.25)" },
  enterprise: { bg: "rgba(250,204,21,0.10)",  color: "#fde047", border: "rgba(250,204,21,0.25)" },
};

const TIER_OPTS = ["free", "pro", "team", "enterprise"] as const;
const PAGE_SIZE = 50;

// ── Sub-components ──────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const s = TIER_BADGE[tier] ?? TIER_BADGE.free;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {tier}
    </span>
  );
}

// ── Inline action row ───────────────────────────────────────────────────────

function UserRow({
  user,
  onUpdated,
}: {
  user: AdminUser;
  onUpdated: (u: AdminUser) => void;
}) {
  const [tierValue, setTierValue]   = useState(user.tier);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const isSuspended = user.status === "suspended";

  async function changeTier(newTier: string) {
    setTierValue(newTier);
    if (newTier === user.tier) return;
    setBusy(true);
    setError(null);
    try {
      await usersApi.changeTier(user.user_id, newTier);
      onUpdated({ ...user, tier: newTier as AdminUser["tier"] });
    } catch {
      setError("Tier change failed");
      setTierValue(user.tier);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    setBusy(true);
    setError(null);
    try {
      if (isSuspended) {
        await usersApi.activate(user.user_id);
        onUpdated({ ...user, status: "active" });
      } else {
        // Minimal reason — full reason can be set in detail page
        await usersApi.suspend(user.user_id, "Suspended by admin");
        onUpdated({ ...user, status: "suspended" });
      }
    } catch {
      setError("Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Status dot */}
      <td className="px-4 py-3">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ background: isSuspended ? "#fca5a5" : "#4ade80" }}
        />
      </td>

      {/* GitHub */}
      <td className="px-4 py-3">
        <div className="text-xs font-medium" style={{ color: "var(--text-1)" }}>
          @{user.github_login}
        </div>
        <div className="text-xs truncate max-w-[180px]" style={{ color: "var(--text-3)" }}>
          {user.email || "—"}
        </div>
      </td>

      {/* Tier — inline dropdown */}
      <td className="px-4 py-3">
        <select
          value={tierValue}
          onChange={e => changeTier(e.target.value)}
          disabled={busy}
          className="input py-0.5 text-xs"
          style={{ width: "auto", minWidth: 110, fontSize: 11 }}
        >
          {TIER_OPTS.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </td>

      {/* Analyses */}
      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-2)" }}>
        {(user.total_analyses ?? 0).toLocaleString()}
      </td>

      {/* Country */}
      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-3)" }}>
        {user.country ?? "—"}
      </td>

      {/* Last Active */}
      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-3)" }}>
        {user.last_active_at
          ? new Date(user.last_active_at).toLocaleDateString()
          : "—"}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {error && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: "#fca5a5" }}>
              <AlertTriangle className="w-3 h-3" /> {error}
            </span>
          )}

          {/* Suspend / Reactivate */}
          <button
            onClick={toggleSuspend}
            disabled={busy}
            title={isSuspended ? "Reactivate account" : "Suspend account"}
            className={isSuspended ? "btn-success btn-sm" : "btn-danger btn-sm"}
            style={{ padding: "3px 8px" }}
          >
            {isSuspended
              ? <UserCheck className="w-3 h-3" />
              : <UserX className="w-3 h-3" />
            }
            {isSuspended ? "Reactivate" : "Suspend"}
          </button>

          {/* View detail */}
          <Link
            href={`/users/${user.user_id}`}
            className="btn-ghost btn-sm"
            style={{ padding: "3px 8px" }}
            title="Manage user (quota, delete, full options)"
          >
            <ExternalLink className="w-3 h-3" />
            Manage
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (tier)   params.tier   = tier;
      if (status) params.status = status;
      const res = await usersApi.list(params);
      setUsers(res.users);
      setTotal(res.total);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, tier, status]);

  useEffect(() => { load(); }, [load]);

  function handleUserUpdated(updated: AdminUser) {
    setUsers(prev => prev.map(u => u.user_id === updated.user_id ? updated : u));
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Users
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            {total.toLocaleString()} total · change tier or suspend directly from the list, or click <strong>Manage</strong> for full options
          </p>
        </div>
        <button className="btn-outline btn-sm">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
          <input
            type="text"
            placeholder="Search by email, GitHub login…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input pl-8 py-2 text-xs"
          />
        </div>

        <select
          value={tier}
          onChange={e => { setTier(e.target.value); setPage(1); }}
          className="input py-1.5 text-xs"
          style={{ width: "auto", minWidth: 110 }}
        >
          <option value="">All tiers</option>
          {TIER_OPTS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>

        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="input py-1.5 text-xs"
          style={{ width: "auto", minWidth: 120 }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        <button onClick={load} className="btn-ghost btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tier legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs" style={{ color: "var(--text-3)" }}>Tiers:</span>
        {TIER_OPTS.map(t => <TierBadge key={t} tier={t} />)}
        <span className="text-xs ml-2" style={{ color: "var(--text-3)" }}>
          · <CreditCard className="w-3 h-3 inline" /> Tier changes take effect immediately
        </span>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["", "GitHub / Email", "Tier", "Analyses", "Country", "Last Active", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-3)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" style={{ width: j === 0 ? 16 : 100 }} />
                      </td>
                    ))}
                  </tr>
                ))
              : users.map(u => (
                  <UserRow key={u.user_id} user={u} onUpdated={handleUserUpdated} />
                ))}
          </tbody>
        </table>

        {!loading && users.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: "var(--text-3)" }}>
            No users found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-outline btn-sm">
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-outline btn-sm">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
