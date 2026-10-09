import { NextResponse } from "next/server";
import { runEmailDispatch } from "@/lib/notifications/emailDispatcher";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const result = await runEmailDispatch();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Dispatch failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
