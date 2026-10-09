"use client";

import { Activity, CalendarDays, ChartLine, Radar, Settings } from "lucide-react";
import { cn } from "@/lib/format";

export type TabId = "scanner" | "journal" | "analytics" | "settings";

const TABS: Array<{ id: TabId; label: string; icon: typeof Radar }> = [
  { id: "scanner", label: "Scanner", icon: Radar },
  { id: "journal", label: "Journal", icon: CalendarDays },
  { id: "analytics", label: "Analytics", icon: ChartLine },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function AppShell({
  tab,
  onTab,
  children,
  bankrollLabel,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  children: React.ReactNode;
  bankrollLabel: string;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0f172a_0%,_#020617_55%,_#000_100%)] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-emerald-300">
                ALPHAFOOTY ENGINE
              </div>
              <div className="text-xs text-slate-500">Opportunity Scanner · Bet Journal · Analytics</div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm">
            <span className="text-slate-400">Bankroll </span>
            <span className="font-semibold text-emerald-300">{bankrollLabel}</span>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTab(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                tab === id
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
