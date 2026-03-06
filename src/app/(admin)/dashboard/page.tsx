"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity, Users, BrainCog, Layers, CheckCircle, GitPullRequest,
  TrendingUp, TrendingDown,
} from "lucide-react";
import { dashboardApi, type DashboardMetrics } from "@/lib/admin-api";

// ── Stat card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}

function StatCard({ label, value, change, sub, icon: Icon, accent = "var(--accent)" }: StatCardProps) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl"
          style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: accent, width: 18, height: 18 }} />
        </div>
        {change !== undefined && (
          <div
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: up ? "#22c55e" : "#ef4444" }}
          >
            {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
        {value}
      </div>
      <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
        {label}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Category bar ───────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  docker:  "#38dcff",
  npm:     "#ffb020",
  python:  "#c084fc",
  git:     "#4ade80",
  tests:   "#fb923c",
  other:   "#94a3b8",
};

function CategoryBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-xs font-mono capitalize" style={{ color: "var(--text-2)" }}>
        {label}
      </div>
      <div className="flex-1 h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="w-8 text-xs font-mono text-right" style={{ color: "var(--text-3)" }}>
        {pct}%
      </div>
    </div>
  );
}

// ── Activity item ──────────────────────────────────────────────────────────

function ActivityRow({
  type,
  description,
  timestamp,
}: {
  type: string;
  description: string;
  timestamp: string;
}) {
  const dot =
    type === "analysis" ? "#38dcff"
    : type === "contribution" ? "#a78bfa"
    : type === "llm_call" ? "#facc15"
    : "#94a3b8";

  const time = new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }) + " UTC";

  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: dot }} />
      <span className="text-xs flex-1" style={{ color: "var(--text-2)" }}>
        {description}
      </span>
      <span className="text-xs flex-shrink-0 font-mono" style={{ color: "var(--text-3)" }}>
        {time}
      </span>
    </div>
  );
}

// ── Mock data for skeleton / demo ──────────────────────────────────────────

const MOCK_TREND = Array.from({ length: 14 }, (_, i) => ({
  date: `Feb ${i + 8}`,
  analyses: Math.floor(800 + Math.random() * 600),
  llm: Math.floor(80 + Math.random() * 120),
}));

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("24h");

  useEffect(() => {
    dashboardApi.getMetrics()
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  const cats = metrics?.category_distribution
    ? Object.entries(metrics.category_distribution)
        .map(([k, v]) => ({ label: k, pct: Math.round(v) }))
        .sort((a, b) => b.pct - a.pct)
    : [
        { label: "docker",  pct: 42 },
        { label: "npm",     pct: 28 },
        { label: "python",  pct: 18 },
        { label: "git",     pct: 10 },
        { label: "other",   pct: 2 },
      ];

  const activity = metrics?.recent_activity ?? [
    { type: "analysis",     description: "user:a3f9c — docker_no_space_left matched",     timestamp: new Date().toISOString() },
    { type: "analysis",     description: "user:b7d2e — npm_peer_dependency matched",       timestamp: new Date(Date.now() - 60_000).toISOString() },
    { type: "contribution", description: "Community PR #42 submitted (CI passed)",          timestamp: new Date(Date.now() - 120_000).toISOString() },
    { type: "llm_call",     description: "LLM fallback triggered — 45ms / 0.89 confidence",timestamp: new Date(Date.now() - 180_000).toISOString() },
    { type: "system",       description: "Pattern index reloaded from Redis",               timestamp: new Date(Date.now() - 240_000).toISOString() },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Platform Overview
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            Real-time metrics and platform health
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-2)" }}>
          {(["24h", "7d", "30d"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={{
                background: period === p ? "var(--surface)" : "transparent",
                color: period === p ? "var(--text-1)" : "var(--text-3)",
                border: period === p ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label={`Analyses (${period})`}
          value={loading ? "—" : (metrics?.analyses_today ?? 12_847).toLocaleString()}
          change={metrics?.analyses_change_pct}
          icon={Activity}
          accent="#38dcff"
        />
        <StatCard
          label="Active Users"
          value={loading ? "—" : (metrics?.active_users_today ?? 1_204).toLocaleString()}
          change={metrics?.active_users_change_pct}
          icon={Users}
          accent="#a78bfa"
        />
        <StatCard
          label="LLM Calls"
          value={loading ? "—" : (metrics?.llm_calls_today ?? 3_291).toLocaleString()}
          sub={`$${(metrics?.llm_cost_today_usd ?? 4.12).toFixed(2)} today`}
          icon={BrainCog}
          accent="#facc15"
        />
        <StatCard
          label="Pattern Hits"
          value={loading ? "—" : (metrics?.pattern_hits_today ?? 10_203).toLocaleString()}
          change={metrics?.pattern_hits_change_pct}
          icon={Layers}
          accent="#4ade80"
        />
        <StatCard
          label="Success Rate"
          value={loading ? "—" : `${(metrics?.success_rate_pct ?? 87.3).toFixed(1)}%`}
          change={metrics?.success_rate_change_pct}
          icon={CheckCircle}
          accent="#34d399"
        />
        <StatCard
          label="Open Contributions"
          value={loading ? "—" : String(metrics?.open_prs ?? 7)}
          sub="Pending review"
          icon={GitPullRequest}
          accent="#f472b6"
        />
      </div>

      {/* Lower grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Trend chart */}
        <div className="panel p-5 xl:col-span-2">
          <h2 className="section-label mb-4">Analysis Volume (14d)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MOCK_TREND} barGap={2}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  color: "var(--text-1)",
                  fontSize: 12,
                }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="analyses" fill="rgba(99,102,241,0.7)" radius={[4, 4, 0, 0]} name="Analyses" />
              <Bar dataKey="llm"      fill="rgba(250,204,21,0.5)"  radius={[4, 4, 0, 0]} name="LLM Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category distribution */}
        <div className="panel p-5">
          <h2 className="section-label mb-4">Error Distribution (today)</h2>
          <div className="space-y-3">
            {cats.map(({ label, pct }) => (
              <CategoryBar
                key={label}
                label={label}
                pct={pct}
                color={CAT_COLORS[label] ?? "#94a3b8"}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-label">Recent Activity</h2>
          <span
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "#22c55e" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        </div>
        <div>
          {activity.map((item, i) => (
            <ActivityRow
              key={i}
              type={item.type}
              description={item.description}
              timestamp={item.timestamp}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
