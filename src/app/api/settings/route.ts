import { NextRequest, NextResponse } from "next/server";
import { ensureSettings, prisma } from "@/lib/prisma";
import { maskEmail } from "@/lib/format";

export const dynamic = "force-dynamic";

function publicSettings<T extends { alertEmail: string }>(settings: T) {
  const { alertEmail, ...rest } = settings;
  return {
    ...rest,
    alertEmailMasked: maskEmail(alertEmail),
    hasAlertEmail: Boolean(alertEmail),
  };
}

export async function GET() {
  const settings = await ensureSettings();
  return NextResponse.json(publicSettings(settings));
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

  // Only update recipient when a full new address is explicitly provided
  const nextEmail = typeof body.alertEmail === "string" ? body.alertEmail.trim() : "";
  if (
    nextEmail &&
    nextEmail.includes("@") &&
    !nextEmail.includes("•") &&
    nextEmail.length > 5
  ) {
    data.alertEmail = nextEmail;
  }

  const settings = await prisma.settings.update({
    where: { id: 1 },
    data,
  });
  return NextResponse.json(publicSettings(settings));
}
