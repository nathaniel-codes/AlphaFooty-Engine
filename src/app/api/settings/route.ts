import { NextRequest, NextResponse } from "next/server";
import { ensureSettings, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await ensureSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  await ensureSettings();
  const body = await req.json();
  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: {
      startingBankroll: Number(body.startingBankroll) || 1_000_000,
      currency: body.currency || "TZS",
      taxRate: Number(body.taxRate) || 0.12,
    },
  });
  return NextResponse.json(settings);
}
