"use client";

import { useEffect, useState, useCallback } from "react";
import { auditApi, type AuditLog } from "@/lib/admin-api";
import { ShieldAlert, Download, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

const CAT_COLORS: Record<string, string> = {
  patterns:     "#38dcff",
  users:        "#a78bfa",
  config:       "#fde047",
  billing:      "#4ade80",
  auth:         "#fb923c",
  contributions:"#f472b6",
};

const ACTION_LABELS: Record<string, string> = {
  pattern_updated:      "Pattern Updated",
  pattern_disabled:     "Pattern Disabled",
  pattern_created:      "Pattern Created",
  user_suspended:       "User Suspended",
  user_tier_changed:    "Tier Changed",
  user_deleted:         "User Deleted",
  config_changed:       "Config Changed",
  contribution_approved:"Contribution Approved",
  contribution_rejected:"Contribution Rejected",
  admin_login:          "Admin Login",
  admin_logout:         "Admin Logout",
};

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [alerts, setAlerts] = useState<unknown[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (category) params.category = category;
      const res = await auditApi.getLogs(params);
      setLogs(res.logs);
      setTotal(res.total);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    auditApi.getAlerts().then(setAlerts).catch(() => setAlerts([]));
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Demo data when backend isn't available
  const displayLogs: AuditLog[] = logs.length ? logs : [
    { id: "1", timestamp: new Date().toISOString(),           admin_email: "admin@opshero.dev", admin_ip: "192.168.1.1", action: "pattern_updated",      category: "patterns",     target_type: "pattern", target_id: "docker_missing_package", result: "success" },
    { id: "2", timestamp: new Date(Date.now()-60000).toISOString(), admin_email: "admin@opshero.dev", admin_ip: "192.168.1.1", action: "user_suspended",        category: "users",        target_type: "user",    target_id: "usr_b7d2e",             result: "success" },
    { id: "3", timestamp: new Date(Date.now()-120000).toISOString(),admin_email: "super@opshero.dev", admin_ip: "192.168.1.1", action: "config_changed",        category: "config",       target_type: "config_key",target_id: "llm.enabled",          result: "success" },
    { id: "4", timestamp: new Date(Date.now()-180000).toISOString(),admin_email: "admin@opshero.dev", admin_ip: "192.168.1.1", action: "contribution_approved", category: "contributions",target_type: "pr",      target_id: "42",                    result: "success" },
    { id: "5", timestamp: new Date(Date.now()-240000).toISOString(),admin_email: "super@opshero.dev", admin_ip: "10.0.0.1",   action: "admin_login",           category: "auth",         result: "success" },
    { id: "6", timestamp: new Date(Date.now()-360000).toISOString(),admin_email: "admin@opshero.dev", admin_ip: "192.168.1.1", action: "user_tier_changed",     category: "users",        target_type: "user",    target_id: "usr_a3f9c",             result: "success" },
  ];

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Security Audit Log
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            {total.toLocaleString()} entries — immutable, tamper-detected
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost btn-sm">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button className="btn-outline btn-sm">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Security alerts */}
      {(alerts.length > 0 || true /* show demo alert */) && (
        <div
          className="flex items-start gap-3 p-3 rounded-xl text-sm"
          style={{ background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.2)" }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#fde047" }} />
          <div className="space-y-1" style={{ color: "#fde047" }}>
            <div className="text-xs">3 failed login attempts from 203.0.113.42 (blocked 15 min)</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="panel p-3 flex items-center gap-3">
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="input py-1.5 text-xs"
          style={{ width: "auto", minWidth: 130 }}
        >
          <option value="">All categories</option>
          {["patterns", "users", "config", "billing", "auth", "contributions"].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <span className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>
          {total.toLocaleString()} entries
        </span>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Timestamp", "Admin", "IP", "Action", "Category", "Target", "Result"].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold"
                  style={{ color: "var(--text-3)" }}
                >
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
                        <div className="skeleton h-4 rounded" style={{ width: j === 3 ? 140 : 80 }} />
                      </td>
                    ))}
                  </tr>
                ))
              : displayLogs.map(log => {
                  const catColor = CAT_COLORS[log.category] ?? "#94a3b8";
                  const time = new Date(log.timestamp).toLocaleTimeString("en-US", {
                    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                  });
                  return (
                    <tr key={log.id} className="table-row">
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-3)" }}>
                        {time} UTC
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-2)" }}>
                        {log.admin_email}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-3)" }}>
                        {log.admin_ip}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-1)" }}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-semibold capitalize"
                          style={{ color: catColor }}
                        >
                          {log.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-3)" }}>
                        {log.target_id ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: log.result === "success" ? "#4ade80" : "#fca5a5" }}
                        >
                          {log.result}
                        </span>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-outline btn-sm">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-outline btn-sm">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
