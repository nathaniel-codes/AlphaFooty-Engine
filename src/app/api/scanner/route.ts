import { NextResponse } from "next/server";
import { runOpportunityScan } from "@/lib/scraper/detectors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await runOpportunityScan();
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
