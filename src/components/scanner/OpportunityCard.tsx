"use client";

import { useEffect, useState } from "react";
import { Crosshair, Goal, Target } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { cn } from "@/lib/format";
import {
  formatCountdown,
  formatKickoffEAT,
  getActionStatus,
  isUpcoming,
} from "@/lib/executionState";

const typeIcon = {
  halftime_00: Goal,
  goal_volume: Target,
  corner_compression: Crosshair,
};

interface Props {
  opportunity: Opportunity;
  onAddToSlip: (op: Opportunity) => void;
}

export default function OpportunityCard({ opportunity: op, onAddToSlip }: Props) {
  const Icon = typeIcon[op.type];
  const action = getActionStatus(op);
  const kickoffLabel = formatKickoffEAT(op.kickoff);
  const upcoming = isUpcoming(op.badge);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!upcoming || !op.kickoff) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [upcoming, op.kickoff]);

  const countdown = upcoming ? formatCountdown(op.kickoff, now) : null;

  return (
    <article className="flex flex-col rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-4 shadow-lg shadow-black/20">
      <div className="mb-3 flex items-start justify-between gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-right text-[10px] font-bold uppercase leading-tight tracking-wide",
            action.className,
            action.flashing && "animate-execute-pulse"
          )}
          title={action.label}
        >
          {action.label}
        </span>
      </div>

      <h3 className="text-base font-semibold text-slate-100">
        {op.homeTeam} <span className="text-slate-500">vs</span> {op.awayTeam}
      </h3>
      <p className="mt-1 text-xs text-slate-400">{op.competition}</p>

      {upcoming && kickoffLabel && (
        <p className="mt-1 text-xs font-medium text-emerald-300/90">{kickoffLabel}</p>
      )}
      {upcoming && countdown && (
        <p className="mt-0.5 text-xs tabular-nums text-sky-300">{countdown}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5">
          Score: <span className="font-medium text-slate-100">{op.score || "—"}</span>
          {op.minute != null ? (
            <span className="ml-1 text-slate-500">· {op.minute}&apos;</span>
          ) : null}
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5">
          Market:{" "}
          <span className="font-medium text-emerald-300">{op.recommendedMarket}</span>
        </div>
        {op.shotsTotal != null && (
          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5">
            Shots: {op.shotsTotal} / SoT {op.shotsOnTarget ?? 0}
          </div>
        )}
        {op.leagueAvgGoals != null && (
          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5">
            League GPG: {op.leagueAvgGoals.toFixed(2)}
          </div>
        )}
        {op.possessionHome != null && (
          <div className="col-span-2 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5">
            Possession: {op.possessionHome}% – {op.possessionAway}%
          </div>
        )}
      </div>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{op.rationale}</p>

      <button
        onClick={() => onAddToSlip(op)}
        className="mt-4 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
      >
        Add to Bet Slip
      </button>
    </article>
  );
}
