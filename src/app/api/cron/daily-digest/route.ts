import { NextRequest, NextResponse } from "next/server";
import { runDailyMorningDigest } from "@/lib/notifications/dailyDigest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // open when unset (local/VPS loopback cron)
  const header =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const force = req.nextUrl.searchParams.get("force") === "1";
    const result = await runDailyMorningDigest({ force });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[daily-digest]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Daily digest failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
