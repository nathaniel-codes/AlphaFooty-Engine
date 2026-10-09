"use client";

import { Activity, Loader2, RefreshCw } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import OpportunityCard from "./OpportunityCard";

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
            Live fixture ingestion · Strategy D execution windows · Goal Volume / Corners
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
        {opportunities.map((op) => (
          <OpportunityCard key={op.id} opportunity={op} onAddToSlip={onAddToSlip} />
        ))}
      </div>
    </section>
  );
}
