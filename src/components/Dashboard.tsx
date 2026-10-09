"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import AppShell, { type TabId } from "@/components/layout/AppShell";
import OpportunityList from "@/components/scanner/OpportunityList";
import CalendarView from "@/components/tracker/CalendarView";
import BetSlipModal, { type SlipRecord } from "@/components/tracker/BetSlipModal";
import EquityChart from "@/components/analytics/EquityChart";
import StrategyBreakdown from "@/components/analytics/StrategyBreakdown";
import TradeTable from "@/components/analytics/TradeTable";
import { formatPct, formatTZS } from "@/lib/format";
import type { Opportunity } from "@/lib/types";

interface AnalyticsPayload {
  kpis: {
    bankroll: number;
    startingBankroll: number;
    totalStaked: number;
    netProfit: number;
    taxPaid: number;
    roi: number;
    winRate: number;
    pushRate: number;
  };
  equityCurve: Array<{ date: string; balance: number }>;
  strategyBreakdown: Array<{
    strategy: string;
    netProfit: number;
    winRate: number;
    slips: number;
  }>;
  outcomeDistribution: Array<{ name: string; value: number }>;
  calendar: Array<{ date: string; dayProfit: number; outcome: "profit" | "loss" | "even" }>;
}

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

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>("scanner");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string>();
  const [scanMeta, setScanMeta] = useState<{
    liveCount: number;
    scheduledCount: number;
    polledAt: string;
    source: string;
  }>();
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [slips, setSlips] = useState<SlipRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SlipRecord | null>(null);
  const [seedOp, setSeedOp] = useState<Opportunity | null>(null);
  const [startingBankroll, setStartingBankroll] = useState(1_000_000);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadScanner = useCallback(async () => {
    setScanLoading(true);
    try {
      const res = await fetch("/api/scanner", { cache: "no-store" });
      const data = await res.json();
      setOpportunities(data.opportunities || []);
      setScanMeta(data.meta);
      setScanError(data.error);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scanner unavailable");
    } finally {
      setScanLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    const res = await fetch("/api/analytics", { cache: "no-store" });
    const data = await res.json();
    setAnalytics(data);
    setStartingBankroll(data.kpis.startingBankroll);
  }, []);

  const loadSlips = useCallback(async () => {
    const res = await fetch("/api/bets?pageSize=200", { cache: "no-store" });
    const data = await res.json();
    setSlips(data.items || []);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadAnalytics(), loadSlips()]);
  }, [loadAnalytics, loadSlips]);

  useEffect(() => {
    loadScanner();
    refreshAll();
    const id = setInterval(loadScanner, 60_000);
    return () => clearInterval(id);
  }, [loadScanner, refreshAll]);

  const daySlips = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return slips.filter((s) => s.date.slice(0, 10) === key);
  }, [slips, selectedDate]);

  const kpis = analytics?.kpis;

  return (
    <AppShell
      tab={tab}
      onTab={setTab}
      bankrollLabel={formatTZS(kpis?.bankroll ?? startingBankroll)}
    >
      {tab === "scanner" && (
        <OpportunityList
          opportunities={opportunities}
          loading={scanLoading}
          error={scanError}
          meta={scanMeta}
          onRefresh={loadScanner}
          onAddToSlip={(op) => {
            setSeedOp(op);
            setEditing(null);
            setModalOpen(true);
          }}
        />
      )}

      {tab === "journal" && (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <CalendarView
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            calendar={analytics?.calendar || []}
            onLogNew={() => {
              setSeedOp(null);
              setEditing(null);
              setModalOpen(true);
            }}
          />
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
              <h3 className="text-base font-semibold text-slate-100">
                Slips on {format(selectedDate, "MMM d, yyyy")}
              </h3>
              <p className="text-xs text-slate-400">{daySlips.length} recorded</p>
              <div className="mt-3 space-y-2">
                {daySlips.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setEditing({
                        id: s.id,
                        date: s.date,
                        strategy: s.strategy,
                        stake: s.stake,
                        status: s.status,
                        notes: s.notes,
                        legs: s.legs,
                      });
                      setSeedOp(null);
                      setModalOpen(true);
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-left hover:border-emerald-500/30"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-slate-200">{s.strategy}</span>
                      <span
                        className={
                          s.netProfit > 0
                            ? "text-emerald-300"
                            : s.netProfit < 0
                              ? "text-rose-300"
                              : "text-slate-400"
                        }
                      >
                        {formatTZS(s.netProfit)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {s.legs.map((l) => l.matchName).join(" · ")} · {s.status}
                    </div>
                  </button>
                ))}
                {daySlips.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No slips on this date.
                  </p>
                )}
              </div>
            </div>
            <TradeTable
              slips={slips}
              onEdit={(slip) => {
                setEditing(slip);
                setSeedOp(null);
                setModalOpen(true);
              }}
              onDeleted={refreshAll}
            />
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Current Bankroll", value: formatTZS(kpis?.bankroll || 0) },
              { label: "Total Capital Staked", value: formatTZS(kpis?.totalStaked || 0) },
              {
                label: "Net Profit / Loss",
                value: formatTZS(kpis?.netProfit || 0),
                tone: (kpis?.netProfit || 0) >= 0 ? "pos" : "neg",
              },
              { label: "ROI", value: formatPct(kpis?.roi || 0) },
              { label: "Win Rate", value: formatPct(kpis?.winRate || 0) },
              { label: "Push Rate", value: formatPct(kpis?.pushRate || 0) },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4"
              >
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {card.label}
                </div>
                <div
                  className={`mt-2 text-2xl font-semibold ${
                    card.tone === "pos"
                      ? "text-emerald-300"
                      : card.tone === "neg"
                        ? "text-rose-300"
                        : "text-slate-100"
                  }`}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <EquityChart data={analytics?.equityCurve || []} />
          <StrategyBreakdown
            strategies={analytics?.strategyBreakdown || []}
            outcomes={analytics?.outcomeDistribution || []}
          />
          <TradeTable
            slips={slips}
            onEdit={(slip) => {
              setEditing(slip);
              setSeedOp(null);
              setModalOpen(true);
              setTab("journal");
            }}
            onDeleted={refreshAll}
          />
        </div>
      )}

      {tab === "settings" && (
        <section className="max-w-lg rounded-xl border border-slate-700/80 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
          <p className="mt-1 text-sm text-slate-400">
            Starting bankroll updates KPI cards in real time with settled P/L.
          </p>
          <label className="mt-5 block text-sm text-slate-300">
            Starting Bankroll (TZS)
            <input
              type="number"
              value={startingBankroll}
              onChange={(e) => setStartingBankroll(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <button
            disabled={savingSettings}
            onClick={async () => {
              setSavingSettings(true);
              await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startingBankroll }),
              });
              await refreshAll();
              setSavingSettings(false);
            }}
            className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            {savingSettings ? "Saving…" : "Save Settings"}
          </button>
          <p className="mt-6 text-xs text-slate-500">
            Tax engine: Tanzania 12% withholding on net winnings. Data store: local SQLite via
            Prisma. Scanner source: Sofascore public JSON endpoints.
          </p>
        </section>
      )}

      <BetSlipModal
        open={modalOpen}
        initialDate={format(selectedDate, "yyyy-MM-dd")}
        initial={editing}
        seedFromOpportunity={seedOp}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setSeedOp(null);
        }}
        onSaved={refreshAll}
      />
    </AppShell>
  );
}
