"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { calculateSettlement, productOdds } from "@/lib/taxCalculator";
import { formatTZS } from "@/lib/format";
import { STATUSES, STRATEGIES, type BetLegInput, type Opportunity, type SlipStatus } from "@/lib/types";

export interface SlipRecord {
  id?: string;
  date: string;
  strategy: string;
  stake: number;
  status: string;
  notes?: string | null;
  legs: BetLegInput[];
}

interface Props {
  open: boolean;
  initialDate?: string;
  initial?: SlipRecord | null;
  seedFromOpportunity?: Opportunity | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function BetSlipModal({
  open,
  initialDate,
  initial,
  seedFromOpportunity,
  onClose,
  onSaved,
}: Props) {
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [strategy, setStrategy] = useState(STRATEGIES[3]);
  const [stake, setStake] = useState(10000);
  const [status, setStatus] = useState<SlipStatus>("Pending");
  const [notes, setNotes] = useState("");
  const [legs, setLegs] = useState<BetLegInput[]>([
    { matchName: "", market: "", odds: 1.5 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sessionSlipCount, setSessionSlipCount] = useState(0);
  const [priorSlipLost, setPriorSlipLost] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setDate(initial.date.slice(0, 10));
      setStrategy(initial.strategy as typeof STRATEGIES[number]);
      setStake(initial.stake);
      setStatus(initial.status as SlipStatus);
      setNotes(initial.notes || "");
      setLegs(initial.legs.length ? initial.legs : [{ matchName: "", market: "", odds: 1.5 }]);
      return;
    }
    setDate(initialDate || new Date().toISOString().slice(0, 10));
    setTime(new Date().toTimeString().slice(0, 5));
    setStatus("Pending");
    setNotes("");
    if (seedFromOpportunity) {
      const isLiveHt = seedFromOpportunity.type === "halftime_00";
      setStrategy(
        isLiveHt
          ? "Custom Live Trigger (Halftime 0 : 0)"
          : "Strategy D (High Tempo Goal Engine)"
      );
      setLegs([
        {
          matchName: `${seedFromOpportunity.homeTeam} vs ${seedFromOpportunity.awayTeam}`,
          market: isLiveHt
            ? "Over 0.5 Match Goals"
            : seedFromOpportunity.recommendedMarket,
          odds: isLiveHt
            ? 1.6
            : seedFromOpportunity.suggestedOdds || 1.5,
        },
      ]);
    } else {
      setStrategy(STRATEGIES[3]);
      setLegs([{ matchName: "", market: "", odds: 1.5 }]);
      setStake(10000);
    }
  }, [open, initial, initialDate, seedFromOpportunity]);

  // Sequential staggered slip discipline for the selected evening
  useEffect(() => {
    if (!open || initial?.id) {
      setSessionSlipCount(0);
      setPriorSlipLost(false);
      return;
    }
    const day = (initialDate || date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    fetch(`/api/bets?date=${day}&pageSize=50`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const items = (data.items || []) as Array<{ status: string; date: string }>;
        setSessionSlipCount(items.length);
        setPriorSlipLost(items.some((s) => s.status === "Lost"));
      })
      .catch(() => {
        setSessionSlipCount(0);
        setPriorSlipLost(false);
      });
  }, [open, initial?.id, initialDate, date]);

  const settlement = useMemo(
    () => calculateSettlement(stake, legs, status),
    [stake, legs, status]
  );

  if (!open) return null;

  const updateLeg = (idx: number, patch: Partial<BetLegInput>) => {
    setLegs((prev) => prev.map((leg, i) => (i === idx ? { ...leg, ...patch } : leg)));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        date: new Date(`${date}T${time}:00`).toISOString(),
        strategy,
        stake: Number(stake),
        status,
        notes,
        legs: legs.map((l) => ({
          matchName: l.matchName,
          market: l.market,
          odds: Number(l.odds),
        })),
      };
      const res = await fetch(initial?.id ? `/api/bets/${initial.id}` : "/api/bets", {
        method: initial?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save slip");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-950 sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <h3 className="text-lg font-semibold text-slate-100">
            {initial?.id ? "Edit Bet Slip" : "Log New Slip"}
          </h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {!initial?.id && sessionSlipCount >= 1 && (
            <div
              className={`rounded-lg border px-3 py-3 text-sm leading-relaxed ${
                priorSlipLost
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-100"
              }`}
            >
              <div className="font-semibold">Discipline Check</div>
              <p className="mt-1">
                Slip {sessionSlipCount + 1} may only be deployed using house profit from a settled
                winning Slip 1. If Slip 1 lost, stop trading for the session.
              </p>
              {priorSlipLost && (
                <p className="mt-2 font-medium text-rose-300">
                  Session lock: a lost slip is already logged today — do not stack further risk.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="text-sm text-slate-300">
              Time
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
          </div>

          <label className="block text-sm text-slate-300">
            Strategy
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as typeof STRATEGIES[number])}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            >
              {STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">Match Legs</span>
              <button
                type="button"
                onClick={() =>
                  setLegs((prev) => [...prev, { matchName: "", market: "Over 1.5", odds: 1.4 }])
                }
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-emerald-300"
              >
                <Plus className="h-3 w-3" /> Add leg
              </button>
            </div>
            {legs.map((leg, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 sm:grid-cols-[1fr_1fr_90px_36px]">
                <input
                  placeholder="Match name"
                  value={leg.matchName}
                  onChange={(e) => updateLeg(idx, { matchName: e.target.value })}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
                <input
                  placeholder="Market"
                  value={leg.market}
                  onChange={(e) => updateLeg(idx, { market: e.target.value })}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={leg.odds}
                  onChange={(e) => updateLeg(idx, { odds: Number(e.target.value) })}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
                <button
                  type="button"
                  disabled={legs.length === 1}
                  onClick={() => setLegs((prev) => prev.filter((_, i) => i !== idx))}
                  className="flex items-center justify-center rounded-md text-rose-400 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Stake (TZS)
              <input
                type="number"
                min="0"
                step="100"
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="text-sm text-slate-300">
              Settlement Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SlipStatus)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-slate-400">Total Odds</div>
              <div className="font-semibold text-slate-100">{productOdds(legs).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Gross Payout</div>
              <div className="font-semibold text-slate-100">{formatTZS(settlement.grossPayout)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Tax (12%)</div>
              <div className="font-semibold text-amber-300">{formatTZS(settlement.taxPaid)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Net Profit</div>
              <div
                className={`font-semibold ${
                  settlement.netProfit >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {formatTZS(settlement.netProfit)}
              </div>
            </div>
          </div>

          <label className="block text-sm text-slate-300">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Slip"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
