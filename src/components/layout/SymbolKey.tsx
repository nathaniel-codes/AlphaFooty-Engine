"use client";

import { Crosshair, Goal, Target } from "lucide-react";

export default function SymbolKey() {
  return (
    <footer className="mt-10 border-t border-slate-800/80 pt-6 pb-2">
      <h3 className="text-sm font-semibold text-slate-200">Symbol key</h3>
      <p className="mt-1 text-xs text-slate-500">
        What the dots, icons, and status pills mean across the app.
      </p>

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Calendar dots
          </div>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Green — that day finished net profit
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              Red — that day finished net loss
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Yellow — break even / push / void day
            </li>
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Opportunity icons
          </div>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <Goal className="h-4 w-4 text-emerald-400" />
              Goal — Halftime 0 : 0 live trigger
            </li>
            <li className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-400" />
              Target — Pre-match goal volume (Strategy D)
            </li>
            <li className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-emerald-400" />
              Crosshair — Low-block corner compression
            </li>
          </ul>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Action status pills
          </div>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                PRE MATCH READY
              </span>
              <span>Upcoming fixture — watchlist</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 rounded-full border border-sky-500/40 bg-sky-500/20 px-2 py-0.5 text-[9px] font-bold text-sky-300">
                MONITORING FOR HT
              </span>
              <span>Live 0-0 — waiting for HT / entry window</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 rounded-full border border-emerald-400/60 bg-emerald-400/25 px-2 py-0.5 text-[9px] font-bold text-emerald-200">
                EXECUTE NOW
              </span>
              <span>Minute 58–62 — place Over 0.5 now</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 rounded-full border border-slate-600/50 bg-slate-500/20 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                WINDOW CLOSED
              </span>
              <span>Goals scored or past minute 65</span>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
