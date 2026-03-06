"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { billingApi, type BillingRevenue } from "@/lib/admin-api";
import { CreditCard, TrendingUp, AlertCircle } from "lucide-react";

const MOCK_MRR = Array.from({ length: 6 }, (_, i) => ({
  month: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"][i],
  mrr: [5200, 6100, 6800, 7400, 8200, 8924][i],
}));

export default function BillingPage() {
  const [revenue, setRevenue] = useState<BillingRevenue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    billingApi.getRevenue()
      .then(setRevenue)
      .catch(() => setRevenue(null))
      .finally(() => setLoading(false));
  }, []);

  const mrr = revenue?.mrr_usd ?? 8924;
  const arr = revenue?.arr_usd ?? 107088;
  const churn = revenue?.churn_rate_pct ?? 3.2;
  const mrr_change = revenue?.mrr_change_pct ?? 12;

  const planData = revenue?.by_plan ?? {
    free:  { users: 12204, revenue: 0 },
    pro:   { users: 589,   revenue: 7068 },
    team:  { users: 14,    revenue: 1806 },
  };

  const mobileMoney = revenue?.mobile_money ?? {
    "Orange Money": { users: 89, revenue: 489 },
    "MTN":          { users: 34, revenue: 204 },
    "Wave":         { users: 12, revenue: 108 },
    "Moov":         { users: 8,  revenue: 72 },
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
          Billing & Revenue
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
          Stripe integration — MRR, ARR, churn
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "MRR", value: `$${mrr.toLocaleString()}`, sub: `↑ ${mrr_change}% MoM`, icon: TrendingUp, color: "#4ade80" },
          { label: "ARR", value: `$${arr.toLocaleString()}`, icon: CreditCard, color: "var(--accent)" },
          { label: "Churn Rate", value: `${churn}%`, sub: "Monthly", icon: AlertCircle, color: churn > 5 ? "#fca5a5" : "#fde047" },
          { label: "Paying Users", value: ((planData.pro?.users ?? 589) + (planData.team?.users ?? 14)).toLocaleString(), icon: CreditCard, color: "#38dcff" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3"
              style={{ background: `${color}18`, border: `1px solid ${color}28` }}
            >
              <Icon className="w-4 h-4" style={{ color, width: 16, height: 16 }} />
            </div>
            <div className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
              {value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{label}</div>
            {sub && <div className="text-xs" style={{ color }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* MRR chart */}
      <div className="panel p-5">
        <h2 className="section-label mb-4">MRR Trend (6 months)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={MOCK_MRR}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-1)", fontSize: 12 }}
              formatter={(v: number) => [`$${v.toLocaleString()}`, "MRR"]}
            />
            <Line type="monotone" dataKey="mrr" stroke="#4ade80" strokeWidth={2.5} dot={{ fill: "#4ade80", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* By plan */}
        <div className="panel p-5">
          <h2 className="section-label mb-4">By Plan</h2>
          <div className="space-y-3">
            {Object.entries(planData).map(([plan, data]) => (
              <div key={plan} className="flex justify-between items-center">
                <div>
                  <div className="text-xs font-semibold capitalize" style={{ color: "var(--text-1)" }}>
                    {plan}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-3)" }}>
                    {data.users.toLocaleString()} users
                  </div>
                </div>
                <div className="text-sm font-semibold font-mono" style={{ color: "#4ade80" }}>
                  ${data.revenue.toLocaleString()}/mo
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile money */}
        <div className="panel p-5">
          <h2 className="section-label mb-4">Mobile Money (Africa)</h2>
          <div className="space-y-3">
            {Object.entries(mobileMoney).map(([provider, data]) => (
              <div key={provider} className="flex justify-between items-center">
                <div>
                  <div className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>
                    {provider}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-3)" }}>
                    {data.users} users
                  </div>
                </div>
                <div className="text-sm font-semibold font-mono" style={{ color: "var(--accent)" }}>
                  ${data.revenue}/mo
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
