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
  const data: Record<string, unknown> = {};

  if (body.startingBankroll != null) {
    data.startingBankroll = Number(body.startingBankroll) || 1_000_000;
  }
  if (body.currency != null) data.currency = body.currency || "TZS";
  if (body.taxRate != null) data.taxRate = Number(body.taxRate) || 0.12;
  if (typeof body.emailEnabled === "boolean") data.emailEnabled = body.emailEnabled;
  if (body.alertEmail != null) {
    data.alertEmail = String(body.alertEmail || "nathanielmwaipopo@gmail.com");
  }

  const settings = await prisma.settings.update({
    where: { id: 1 },
    data,
  });
  return NextResponse.json(settings);
}
