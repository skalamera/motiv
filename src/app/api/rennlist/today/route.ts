import { NextResponse } from "next/server";
import { fetchRennlistTodayThreads } from "@/lib/rennlist/fetch-today-threads";
import { RENNLIST_TODAY_POSTS_URL } from "@/lib/rennlist/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await fetchRennlistTodayThreads();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reader failed";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        sourceUrl: RENNLIST_TODAY_POSTS_URL,
      },
      { status: 500 },
    );
  }
}
