"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTZS } from "@/lib/format";

interface Point {
  date: string;
  balance: number;
}

export default function EquityChart({ data }: { data: Point[] }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
      <h3 className="mb-1 text-base font-semibold text-slate-100">Equity Curve</h3>
      <p className="mb-4 text-xs text-slate-400">Cumulative bankroll after tax across settled dates</p>
      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Settle slips to build the equity curve.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                  borderRadius: 8,
                }}
                formatter={(value) => [formatTZS(Number(value)), "Bankroll"]}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
