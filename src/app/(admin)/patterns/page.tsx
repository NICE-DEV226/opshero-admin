"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { patternsApi, type AdminPattern, type PatternFilters } from "@/lib/admin-api";
import {
  Search, Plus, ChevronLeft, ChevronRight, Filter,
  Circle, Pencil, PowerOff, RefreshCw,
} from "lucide-react";

const SEV_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: "rgba(239,68,68,0.10)",  color: "#fca5a5", border: "rgba(239,68,68,0.25)" },
  high:     { bg: "rgba(249,115,22,0.10)", color: "#fdba74", border: "rgba(249,115,22,0.25)" },
  medium:   { bg: "rgba(250,204,21,0.10)", color: "#fde047", border: "rgba(250,204,21,0.25)" },
  low:      { bg: "rgba(74,222,128,0.10)", color: "#86efac", border: "rgba(74,222,128,0.25)" },
  info:     { bg: "rgba(56,220,255,0.10)", color: "#67e8f9", border: "rgba(56,220,255,0.25)" },
};

const SRC_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  core:      { bg: "rgba(99,102,241,0.10)", color: "#a5b4fc", border: "rgba(99,102,241,0.25)" },
  community: { bg: "rgba(168,85,247,0.10)", color: "#d8b4fe", border: "rgba(168,85,247,0.25)" },
  ai:        { bg: "rgba(250,204,21,0.10)", color: "#fde047", border: "rgba(250,204,21,0.25)" },
};

const CATEGORIES = ["all", "docker", "npm", "python", "git", "tests", "other"];
const PAGE_SIZE = 50;

function SevBadge({ sev }: { sev: string }) {
  const s = SEV_BADGE[sev] ?? SEV_BADGE.info;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {sev}
    </span>
  );
}

function SrcBadge({ src }: { src: string }) {
  const s = SRC_BADGE[src] ?? SRC_BADGE.core;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {src}
    </span>
  );
}

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<AdminPattern[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PatternFilters>({ page_size: PAGE_SIZE });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const f: PatternFilters = {
        ...filters,
        page,
        page_size: PAGE_SIZE,
        ...(category !== "all" ? { category } : {}),
      };
      const res = await patternsApi.list(f);
      setPatterns(res.patterns);
      setTotal(res.total);
    } catch {
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page, category]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Client-side search filter (applied on top of server results for instant feedback)
  const visible = search.trim()
    ? patterns.filter(p =>
        p.pattern_id.includes(search) ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.includes(search),
      )
    : patterns;

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Patterns
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            {total.toLocaleString()} patterns in database
          </p>
        </div>
        <Link href="/patterns/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          New Pattern
        </Link>
      </div>

      {/* Filters toolbar */}
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "var(--text-3)" }}
          />
          <input
            type="text"
            placeholder="Search by ID, name, category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8 py-2 text-xs"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: category === cat ? "rgba(99,102,241,0.15)" : "var(--surface-2)",
                color: category === cat ? "var(--accent)" : "var(--text-3)",
                border: category === cat
                  ? "1px solid rgba(99,102,241,0.30)"
                  : "1px solid var(--border)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <select
          value={filters.severity ?? ""}
          onChange={e =>
            setFilters(f => ({ ...f, severity: e.target.value || undefined }))
          }
          className="input py-1.5 text-xs"
          style={{ width: "auto", minWidth: 120 }}
        >
          <option value="">All severities</option>
          {["critical", "high", "medium", "low", "info"].map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Source filter */}
        <select
          value={filters.source ?? ""}
          onChange={e =>
            setFilters(f => ({ ...f, source: e.target.value || undefined }))
          }
          className="input py-1.5 text-xs"
          style={{ width: "auto", minWidth: 110 }}
        >
          <option value="">All sources</option>
          <option value="core">core</option>
          <option value="community">community</option>
          <option value="ai">ai</option>
        </select>

        <button onClick={load} className="btn-ghost btn-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>

        <span className="text-xs ml-auto" style={{ color: "var(--text-3)" }}>
          Showing {visible.length} of {total}
        </span>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Pattern ID", "Name", "Category", "Severity", "Source", "Hits 30d", "Success %", "Version", ""].map(h => (
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
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" style={{ width: j === 0 ? 160 : 80 }} />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map(p => (
                  <tr
                    key={p.pattern_id}
                    className="table-row"
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--accent)" }}>
                      {p.pattern_id}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-1)" }}>
                      {p.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-medium capitalize"
                        style={{ color: "var(--text-2)" }}
                      >
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SevBadge sev={p.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <SrcBadge src={p.source} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-2)" }}>
                      {(p.metadata?.match_count_30d ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const sr = p.metadata?.success_rate ?? 0;
                        return (
                          <span
                            className="font-mono text-xs"
                            style={{ color: sr >= 85 ? "#4ade80" : sr >= 70 ? "#fde047" : "#fca5a5" }}
                          >
                            {(sr * 100).toFixed(1)}%
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--text-3)" }}>
                      {p.version}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/patterns/${p.pattern_id}`}
                          className="btn-ghost btn-sm py-1 px-2"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          className="btn-ghost btn-sm py-1 px-2"
                          title={p.status === "active" ? "Disable" : "Enable"}
                          style={{
                            color: p.status === "active" ? "var(--text-3)" : "#4ade80",
                          }}
                        >
                          {p.status === "active" ? (
                            <PowerOff className="w-3.5 h-3.5" />
                          ) : (
                            <Circle className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Empty state */}
        {!loading && visible.length === 0 && (
          <div className="py-16 text-center" style={{ color: "var(--text-3)" }}>
            <Filter className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No patterns match your filters.</p>
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
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-outline btn-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-outline btn-sm"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
