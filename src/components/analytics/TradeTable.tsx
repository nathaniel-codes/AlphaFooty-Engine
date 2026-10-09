"use client";

import { useMemo, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { formatTZS, cn } from "@/lib/format";
import type { SlipRecord } from "@/components/tracker/BetSlipModal";

interface SlipRow {
  id: string;
  date: string;
  strategy: string;
  stake: number;
  totalOdds: number;
  taxPaid: number;
  netProfit: number;
  status: string;
  notes?: string | null;
  legs: Array<{ matchName: string; market: string; odds: number }>;
}

interface Props {
  slips: SlipRow[];
  onEdit: (slip: SlipRecord) => void;
  onDeleted: () => void;
}

export default function TradeTable({ slips, onEdit, onDeleted }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    return slips.filter((s) => {
      if (status && s.status !== status) return false;
      if (!q) return true;
      const hay = [
        s.strategy,
        s.status,
        ...s.legs.map((l) => `${l.matchName} ${l.market}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [slips, q, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const remove = async (id: string) => {
    if (!confirm("Delete this slip?")) return;
    await fetch(`/api/bets/${id}`, { method: "DELETE" });
    onDeleted();
  };

  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Trade Ledger</h3>
          <p className="text-xs text-slate-400">{filtered.length} slips</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search…"
              className="rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-sm text-slate-100"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All statuses</option>
            <option>Pending</option>
            <option>Won</option>
            <option>Lost</option>
            <option>Void or Push</option>
            <option>Partial Push</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Strategy</th>
              <th className="px-2 py-2">Legs</th>
              <th className="px-2 py-2">Odds</th>
              <th className="px-2 py-2">Stake</th>
              <th className="px-2 py-2">Tax</th>
              <th className="px-2 py-2">Net</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((s) => (
              <tr key={s.id} className="border-b border-slate-800/80 text-slate-300">
                <td className="whitespace-nowrap px-2 py-3">
                  {new Date(s.date).toLocaleDateString()}
                </td>
                <td className="max-w-[160px] truncate px-2 py-3">{s.strategy}</td>
                <td className="max-w-[220px] px-2 py-3 text-xs text-slate-400">
                  {s.legs.map((l) => `${l.matchName} · ${l.market}`).join(" | ")}
                </td>
                <td className="px-2 py-3">{s.totalOdds.toFixed(2)}</td>
                <td className="px-2 py-3">{formatTZS(s.stake)}</td>
                <td className="px-2 py-3">{formatTZS(s.taxPaid)}</td>
                <td
                  className={cn(
                    "px-2 py-3 font-medium",
                    s.netProfit > 0 && "text-emerald-300",
                    s.netProfit < 0 && "text-rose-300"
                  )}
                >
                  {formatTZS(s.netProfit)}
                </td>
                <td className="px-2 py-3">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs",
                      s.status === "Won" && "bg-emerald-500/15 text-emerald-300",
                      s.status === "Lost" && "bg-rose-500/15 text-rose-300",
                      s.status === "Pending" && "bg-sky-500/15 text-sky-300",
                      (s.status === "Void or Push" || s.status === "Partial Push") &&
                        "bg-amber-500/15 text-amber-300"
                    )}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        onEdit({
                          id: s.id,
                          date: s.date,
                          strategy: s.strategy,
                          stake: s.stake,
                          status: s.status,
                          notes: s.notes,
                          legs: s.legs,
                        })
                      }
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      className="rounded-md p-1 text-rose-400 hover:bg-slate-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-8 text-center text-slate-500">
                  No slips for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-sm">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-md border border-slate-700 px-2 py-1 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-slate-400">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border border-slate-700 px-2 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  );
}
