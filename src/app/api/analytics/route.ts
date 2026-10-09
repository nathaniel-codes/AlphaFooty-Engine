import { NextResponse } from "next/server";
import { ensureSettings, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await ensureSettings();
  const slips = await prisma.betSlip.findMany({
    include: { legs: true },
    orderBy: { date: "asc" },
  });

  const settled = slips.filter((s) => s.status !== "Pending");
  const wins = settled.filter((s) => s.status === "Won" || s.status === "Partial Push");
  const losses = settled.filter((s) => s.status === "Lost");
  const pushes = settled.filter((s) => s.status === "Void or Push");

  const netProfit = slips.reduce((sum, s) => sum + (s.status === "Pending" ? 0 : s.netProfit), 0);
  const totalStaked = slips.reduce((sum, s) => sum + s.stake, 0);
  const taxPaid = slips.reduce((sum, s) => sum + s.taxPaid, 0);
  const bankroll = settings.startingBankroll + netProfit;
  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;
  const winRate = settled.length ? (wins.length / settled.length) * 100 : 0;
  const pushRate = settled.length ? (pushes.length / settled.length) * 100 : 0;

  // Equity curve by date
  let running = settings.startingBankroll;
  const byDate = new Map<string, number>();
  for (const slip of slips) {
    if (slip.status === "Pending") continue;
    const key = slip.date.toISOString().slice(0, 10);
    running += slip.netProfit;
    byDate.set(key, running);
  }
  const equityCurve = Array.from(byDate.entries()).map(([date, balance]) => ({
    date,
    balance,
  }));

  // Strategy breakdown
  const strategies = [
    "Strategy A (Multi Favorite Accumulator)",
    "Strategy B (Daily Action Pot)",
    "Strategy C (Elite Team Alternative Double)",
    "Strategy D (High Tempo Goal Engine)",
    "Custom Live Trigger (Halftime 0 : 0)",
  ];

  const strategyBreakdown = strategies.map((name) => {
    const group = slips.filter((s) => s.strategy === name && s.status !== "Pending");
    const groupWins = group.filter((s) => s.status === "Won" || s.status === "Partial Push");
    const profit = group.reduce((sum, s) => sum + s.netProfit, 0);
    return {
      strategy: name.replace(/\s*\(.*\)/, "").trim(),
      fullName: name,
      netProfit: profit,
      winRate: group.length ? (groupWins.length / group.length) * 100 : 0,
      slips: group.length,
    };
  });

  // Calendar day outcomes
  const dayMap = new Map<string, number>();
  for (const slip of slips) {
    if (slip.status === "Pending") continue;
    const key = slip.date.toISOString().slice(0, 10);
    dayMap.set(key, (dayMap.get(key) || 0) + slip.netProfit);
  }
  const calendar = Array.from(dayMap.entries()).map(([date, dayProfit]) => ({
    date,
    dayProfit,
    outcome: dayProfit > 0 ? "profit" : dayProfit < 0 ? "loss" : "even",
  }));

  return NextResponse.json({
    kpis: {
      bankroll,
      startingBankroll: settings.startingBankroll,
      totalStaked,
      netProfit,
      taxPaid,
      roi,
      winRate,
      pushRate,
      totalSlips: slips.length,
      settledSlips: settled.length,
    },
    equityCurve,
    strategyBreakdown,
    outcomeDistribution: [
      { name: "Wins", value: wins.length },
      { name: "Losses", value: losses.length },
      { name: "Pushes", value: pushes.length },
    ],
    calendar,
  });
}
