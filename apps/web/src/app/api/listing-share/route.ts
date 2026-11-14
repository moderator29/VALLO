import { NextResponse } from "next/server";
import { countListingShare } from "@/lib/listings/stats/count";

/**
 * THE LISTING SHARE BEACON (founder, 14 November 2026). The listing page
 * posts `{ id }` when a share has gone out (the share sheet finished, or the
 * link was copied). Always 204 with nothing in it, whatever happened, so a
 * page learns nothing and a phone never retries. Every rule (same site, a
 * browser, consent, the rate limit, once a day per person) is in
 * `lib/listings/stats/count.ts`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await countListingShare(request);
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
