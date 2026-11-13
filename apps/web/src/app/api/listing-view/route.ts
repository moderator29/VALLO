import { NextResponse } from "next/server";
import { countListingView } from "@/lib/listings/stats/count";

/**
 * THE LISTING VIEW BEACON (founder, 13 November 2026). `ListingViewBeacon`
 * posts `{ id }` once a listing page has been on screen for a second. Always
 * 204 with nothing in it, whatever happened, so a page learns nothing and a
 * phone never retries. Every rule (same site, a browser, consent, the rate
 * limit, the once-a-day count) is in `lib/listings/stats/count.ts`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await countListingView(request);
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
