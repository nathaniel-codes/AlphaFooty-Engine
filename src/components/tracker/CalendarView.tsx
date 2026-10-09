"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/format";

interface DayOutcome {
  date: string;
  dayProfit: number;
  outcome: "profit" | "loss" | "even";
}

interface Props {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  calendar: DayOutcome[];
  onLogNew: () => void;
}

export default function CalendarView({
  selectedDate,
  onSelectDate,
  calendar,
  onLogNew,
}: Props) {
  const monthStart = startOfMonth(selectedDate);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });

  const outcomeMap = new Map(calendar.map((c) => [c.date, c]));

  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Bet Journal Calendar</h2>
          <p className="text-sm text-slate-400">Click a date to filter the ledger</p>
        </div>
        <button
          onClick={onLogNew}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Log New Slip
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => onSelectDate(subMonths(selectedDate, 1))}
          className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold text-slate-200">
          {format(selectedDate, "MMMM yyyy")}
        </div>
        <button
          onClick={() => onSelectDate(addMonths(selectedDate, 1))}
          className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-slate-500">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const outcome = outcomeMap.get(key);
          const selected = isSameDay(day, selectedDate);
          return (
            <button
              key={key}
              onClick={() => onSelectDate(day)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition",
                isSameMonth(day, monthStart)
                  ? "border-slate-800 bg-slate-950/40 text-slate-200"
                  : "border-transparent text-slate-600",
                selected && "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/40"
              )}
            >
              <span>{format(day, "d")}</span>
              {outcome && (
                <span
                  className={cn(
                    "mt-0.5 h-1.5 w-1.5 rounded-full",
                    outcome.outcome === "profit" && "bg-emerald-400",
                    outcome.outcome === "loss" && "bg-rose-400",
                    outcome.outcome === "even" && "bg-amber-400"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Profit day
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Loss day
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Break even / push
        </span>
      </div>
    </section>
  );
}
