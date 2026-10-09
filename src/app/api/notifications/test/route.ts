import { NextResponse } from "next/server";
import { sendTestEmail } from "@/lib/notifications/emailDispatcher";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await sendTestEmail();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test email failed" },
      { status: 500 }
    );
  }
}
