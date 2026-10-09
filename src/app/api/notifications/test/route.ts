import { NextRequest, NextResponse } from "next/server";
import { sendTestEmail } from "@/lib/notifications/emailDispatcher";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await sendTestEmail(body.to);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test email failed" },
      { status: 500 }
    );
  }
}
