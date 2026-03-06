"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usersApi, type AdminUser, AdminApiError } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-auth";
import {
  ArrowLeft, UserX, UserCheck, Trash2, CreditCard,
  AlertTriangle, CheckCircle, Activity, Gauge,
} from "lucide-react";

type DetailUser = AdminUser & {
  github_avatar_url?: string;
  github_name?: string;
  analyses_this_month?: number;
  custom_monthly_limit?: number | null;
  team_id?: string;
  suspended_reason?: string;
  subscription_expires_at?: string;
  top_patterns?: { pattern_id: string; count: number }[];
};

const TIER_OPTS = ["free", "pro", "team", "enterprise"] as const;

export default function UserDetailPage() {
  const { user_id } = useParams<{ user_id: string }>();
  const router = useRouter();
  const canManageUsers = hasPermission("can_manage_users");
  const canDeleteUsers = hasPermission("can_delete_users");

  const [user, setUser] = useState<DetailUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newTier, setNewTier] = useState("");
  const [busy, setBusy] = useState(false);

  // Quota override state
  const [quotaInput, setQuotaInput] = useState<string>("");
  const [quotaMode, setQuotaMode] = useState<"default" | "custom">("default");

  useEffect(() => {
    usersApi.get(user_id)
      .then(u => {
        const du = u as DetailUser;
        setUser(du);
        setNewTier(du.tier);
        if (du.custom_monthly_limit == null) {
          setQuotaMode("default");
          setQuotaInput("");
        } else {
          setQuotaMode("custom");
          setQuotaInput(String(du.custom_monthly_limit));
        }
      })
      .catch(() => setError("User not found."))
      .finally(() => setLoading(false));
  }, [user_id]);

  async function doAction(fn: () => Promise<unknown>, successMsg: string) {
    setBusy(true);
    setActionError(null);
    setActionMsg(null);
    try {
      await fn();
      setActionMsg(successMsg);
      const updated = await usersApi.get(user_id) as DetailUser;
      setUser(updated);
    } catch (err) {
      setActionError(err instanceof AdminApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveQuota() {
    const limit = quotaMode === "custom" ? parseInt(quotaInput) : null;
    await doAction(
      () => usersApi.setQuota(user_id, limit),
      quotaMode === "custom"
        ? `Quota set to ${limit} analyses/month`
        : "Quota reset to tier default",
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-40 rounded" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6">
        <button onClick={() => router.push("/users")} className="btn-ghost btn-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
          <AlertTriangle className="w-5 h-5" />
          {error ?? "User not found."}
        </div>
      </div>
    );
  }

  const isSuspended = user.status === "suspended";

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/users")} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          {user.github_avatar_url && (
            <img src={user.github_avatar_url} alt="avatar"
              className="w-10 h-10 rounded-full"
              style={{ border: "2px solid var(--border)" }} />
          )}
          <div>
            <h1 className="font-display text-xl font-bold" style={{ color: "var(--text-1)" }}>
              {user.github_name || user.github_login}
            </h1>
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              {user.email || "no email"} · @{user.github_login}
            </p>
          </div>
          <span
            className="ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{
              background: isSuspended ? "rgba(239,68,68,0.10)" : "rgba(74,222,128,0.10)",
              color:      isSuspended ? "#fca5a5"              : "#4ade80",
              border:     `1px solid ${isSuspended ? "rgba(239,68,68,0.25)" : "rgba(74,222,128,0.25)"}`,
            }}
          >
            {isSuspended ? "Suspended" : "Active"}
          </span>
        </div>
      </div>

      {/* Feedback */}
      {actionMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
          <CheckCircle className="w-4 h-4" /> {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
          <AlertTriangle className="w-4 h-4" /> {actionError}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Analyses",   value: user.total_analyses.toLocaleString() },
          { label: "This Month",       value: (user.analyses_this_month ?? 0).toLocaleString() },
          { label: "Tier",             value: user.tier.toUpperCase() },
          { label: "Member Since",     value: new Date(user.created_at).toLocaleDateString() },
        ].map(({ label, value }) => (
          <div key={label} className="panel p-4">
            <div className="text-xs mb-1" style={{ color: "var(--text-3)" }}>{label}</div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Suspension info */}
      {isSuspended && user.suspended_reason && (
        <div className="panel p-4"
          style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "#fca5a5" }}>Suspension reason</p>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>{user.suspended_reason}</p>
        </div>
      )}

      {/* Change tier */}
      {canManageUsers && (
        <div className="panel p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-1)" }}>
            <CreditCard className="w-4 h-4" style={{ color: "var(--accent)" }} />
            Change Subscription Tier
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={newTier}
              onChange={e => setNewTier(e.target.value)}
              className="input text-sm"
              style={{ width: "auto", minWidth: 130 }}
            >
              {TIER_OPTS.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <button
              onClick={() => doAction(() => usersApi.changeTier(user_id, newTier), `Tier changed to ${newTier}`)}
              disabled={busy || newTier === user.tier}
              className="btn-primary btn-sm"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Usage quota override */}
      {canManageUsers && (
        <div className="panel p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-1)" }}>
            <Gauge className="w-4 h-4" style={{ color: "#fdba74" }} />
            Monthly Analysis Quota
            {user.custom_monthly_limit != null && (
              <span
                className="ml-2 px-2 py-0.5 rounded-md text-xs font-semibold"
                style={{ background: "rgba(253,186,116,0.10)", color: "#fdba74", border: "1px solid rgba(253,186,116,0.2)" }}
              >
                Custom override active
              </span>
            )}
          </h2>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            Override the default tier quota for this user. Set to "Tier default" to remove the override.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={quotaMode}
              onChange={e => setQuotaMode(e.target.value as "default" | "custom")}
              className="input text-sm"
              style={{ width: "auto", minWidth: 160 }}
            >
              <option value="default">Tier default</option>
              <option value="custom">Custom limit</option>
            </select>
            {quotaMode === "custom" && (
              <input
                type="number"
                min={0}
                step={10}
                value={quotaInput}
                onChange={e => setQuotaInput(e.target.value)}
                placeholder="e.g. 50"
                className="input text-sm"
                style={{ width: 120 }}
              />
            )}
            <button
              onClick={saveQuota}
              disabled={busy || (quotaMode === "custom" && !quotaInput.trim())}
              className="btn-primary btn-sm"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Account actions */}
      {canManageUsers && (
        <div className="panel p-5 space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>Account Actions</h2>

          {!isSuspended ? (
            showSuspendForm ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  placeholder="Reason for suspension…"
                  className="input text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => doAction(
                      () => usersApi.suspend(user_id, suspendReason),
                      "User suspended"
                    )}
                    disabled={!suspendReason.trim() || busy}
                    className="btn-danger btn-sm"
                  >
                    <UserX className="w-3.5 h-3.5" /> Confirm Suspend
                  </button>
                  <button onClick={() => setShowSuspendForm(false)} className="btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowSuspendForm(true)} className="btn-danger btn-sm">
                <UserX className="w-3.5 h-3.5" /> Suspend Account
              </button>
            )
          ) : (
            <button
              onClick={() => doAction(() => usersApi.activate(user_id), "User reactivated")}
              disabled={busy}
              className="btn-success btn-sm"
            >
              <UserCheck className="w-3.5 h-3.5" /> Reactivate Account
            </button>
          )}
        </div>
      )}

      {/* Danger zone */}
      {canDeleteUsers && (
        <div className="panel p-5"
          style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#fca5a5" }}>Danger Zone</h2>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger btn-sm">
              <Trash2 className="w-3.5 h-3.5" /> Permanently Delete User
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "#fca5a5" }}>
                This will permanently delete <strong>{user.email || user.github_login}</strong> and anonymise their analyses. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => doAction(
                    async () => { await usersApi.delete(user_id); router.push("/users"); },
                    "User deleted"
                  )}
                  disabled={busy}
                  className="btn-danger btn-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top patterns */}
      {(user.top_patterns?.length ?? 0) > 0 && (
        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-1)" }}>
            <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} />
            Top Matched Patterns
          </h2>
          <div className="space-y-2">
            {user.top_patterns!.map(p => (
              <div key={p.pattern_id} className="flex items-center justify-between text-xs">
                <span className="font-mono" style={{ color: "var(--accent)" }}>{p.pattern_id}</span>
                <span style={{ color: "var(--text-3)" }}>{p.count.toLocaleString()} hits</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
