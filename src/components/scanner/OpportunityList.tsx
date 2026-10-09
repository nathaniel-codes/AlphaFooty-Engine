"use client";

import { Activity, Crosshair, Goal, Loader2, RefreshCw, Target } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { cn } from "@/lib/format";

interface Props {
  opportunities: Opportunity[];
  loading: boolean;
  error?: string;
  meta?: {
    liveCount: number;
    scheduledCount: number;
    polledAt: string;
    source: string;
  };
  onRefresh: () => void;
  onAddToSlip: (op: Opportunity) => void;
}

const typeIcon = {
  halftime_00: Goal,
  goal_volume: Target,
  corner_compression: Crosshair,
};

export default function OpportunityList({
  opportunities,
  loading,
  error,
  meta,
  onRefresh,
  onAddToSlip,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">
            Opportunity Scanner
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Live Sofascore ingestion · Strategy D / Goal Volume / Corner Compression
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {meta && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1">
            <Activity className="h-3 w-3 text-emerald-400" />
            Live fixtures: {meta.liveCount}
          </span>
          <span className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1">
            Scheduled today: {meta.scheduledCount}
          </span>
          <span className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1">
            Source: {meta.source}
          </span>
          <span className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1">
            Polled: {new Date(meta.polledAt).toLocaleTimeString()}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      )}

      {!loading && opportunities.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center text-slate-400">
          No active opportunities right now. Scanner continues polling every 60s during live blocks.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {opportunities.map((op) => {
          const Icon = typeIcon[op.type];
          return (
            <article
              key={op.id}
              className="flex flex-col rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-4 shadow-lg shadow-black/20"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    op.badge === "Live" && "bg-rose-500/20 text-rose-300",
                    op.badge === "Halftime" && "bg-amber-500/20 text-amber-300",
                    op.badge === "Upcoming" && "bg-sky-500/20 text-sky-300"
                  )}
                >
                  {op.badge}
                  {op.minute != null ? ` · ${op.minute}'` : ""}
                </span>
                <Icon className="h-4 w-4 text-emerald-400" />
              </div>

              <h3 className="text-base font-semibold text-slate-100">
                {op.homeTeam}{" "}
                <span className="text-slate-500">vs</span> {op.awayTeam}
              </h3>
              <p className="mt-1 text-xs text-slate-400">{op.competition}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5">
                  Score: <span className="font-medium text-slate-100">{op.score || "—"}</span>
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

              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
                {op.rationale}
              </p>

              <button
                onClick={() => onAddToSlip(op)}
                className="mt-4 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Add to Bet Slip
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
