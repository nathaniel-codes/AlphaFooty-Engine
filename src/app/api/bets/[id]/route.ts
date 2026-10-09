import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateSettlement } from "@/lib/taxCalculator";
import type { BetSlipInput, SlipStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await req.json()) as BetSlipInput;
  const settlement = calculateSettlement(
    body.stake,
    body.legs,
    (body.status || "Pending") as SlipStatus
  );

  await prisma.betLeg.deleteMany({ where: { betSlipId: params.id } });

  const slip = await prisma.betSlip.update({
    where: { id: params.id },
    data: {
      date: new Date(body.date),
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

  return NextResponse.json(slip);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.betSlip.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
