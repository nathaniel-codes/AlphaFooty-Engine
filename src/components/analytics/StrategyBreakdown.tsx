"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTZS } from "@/lib/format";

interface StrategyRow {
  strategy: string;
  netProfit: number;
  winRate: number;
  slips: number;
}

interface OutcomeRow {
  name: string;
  value: number;
}

const COLORS = ["#34d399", "#f43f5e", "#fbbf24"];

export default function StrategyBreakdown({
  strategies,
  outcomes,
}: {
  strategies: StrategyRow[];
  outcomes: OutcomeRow[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
        <h3 className="mb-1 text-base font-semibold text-slate-100">
          Strategy Performance
        </h3>
        <p className="mb-4 text-xs text-slate-400">Net profit and win rate by strategy</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={strategies}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="strategy" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                  borderRadius: 8,
                }}
                formatter={(value, name) =>
                  name === "netProfit"
                    ? [formatTZS(Number(value)), "Net Profit"]
                    : [`${Number(value).toFixed(1)}%`, "Win Rate"]
                }
              />
              <Legend />
              <Bar dataKey="netProfit" name="Net Profit" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="winRate" name="Win Rate %" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
        <h3 className="mb-1 text-base font-semibold text-slate-100">Outcome Distribution</h3>
        <p className="mb-4 text-xs text-slate-400">Wins / Losses / Pushes</p>
        <div className="h-64">
          {outcomes.every((o) => o.value === 0) ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No settled outcomes yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={outcomes}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {outcomes.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                    borderRadius: 8,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
