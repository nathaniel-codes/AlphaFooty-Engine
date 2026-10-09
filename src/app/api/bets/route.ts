import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateSettlement } from "@/lib/taxCalculator";
import type { BetSlipInput, SlipStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const q = searchParams.get("q")?.toLowerCase();
  const status = searchParams.get("status");
  const strategy = searchParams.get("strategy");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize") || 20)));

  const where: Record<string, unknown> = {};

  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    where.date = { gte: start, lte: end };
  }
  if (status) where.status = status;
  if (strategy) where.strategy = strategy;

  const slips = await prisma.betSlip.findMany({
    where,
    include: { legs: true },
    orderBy: { date: "desc" },
  });

  let filtered = slips;
  if (q) {
    filtered = slips.filter((s) => {
      const hay = [
        s.strategy,
        s.status,
        s.notes || "",
        ...s.legs.map((l) => `${l.matchName} ${l.market}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BetSlipInput;
  if (!body.legs?.length || !body.stake || !body.strategy) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const settlement = calculateSettlement(
    body.stake,
    body.legs,
    (body.status || "Pending") as SlipStatus
  );

  const slip = await prisma.betSlip.create({
    data: {
      date: new Date(body.date || new Date().toISOString()),
      strategy: body.strategy,
      stake: body.stake,
      totalOdds: settlement.totalOdds,
      grossPayout: settlement.grossPayout,
      taxPaid: settlement.taxPaid,
      netProfit: settlement.netProfit,
      netReturn: settlement.netReturn,
      status: body.status || "Pending",
      notes: body.notes || null,
      legs: {
        create: body.legs.map((leg) => ({
          matchName: leg.matchName,
          market: leg.market,
          odds: Number(leg.odds),
        })),
      },
    },
    include: { legs: true },
  });

  return NextResponse.json(slip, { status: 201 });
}
