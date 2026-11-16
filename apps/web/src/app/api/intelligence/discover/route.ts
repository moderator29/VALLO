import { NextResponse } from "next/server";
import { discover } from "@/lib/intelligence/discover";
import { cacheHeaders, engineDeps, limitFor, tooMany } from "@/lib/intelligence/http";
import { resolveViewer } from "@/lib/intelligence/viewer";

/**
 * GET /api/intelligence/discover
 *
 * The empty VALLO Intelligence screen (`DiscoverResponse`): popular searches
 * above the privacy floor, the member's own recent searches, the newest real
 * listings, people to follow (never the viewer) and example searches that
 * return results today. Every list may be empty; none is invented.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const viewer = await resolveViewer();
  const deps = engineDeps(viewer, request);
  /* The examples are checked as a visitor would see them; no model is involved. */
  const [verdict, answer] = await Promise.all([limitFor("discover", viewer, request), discover(viewer, { ...deps, model: undefined })]);
  if (!verdict.allowed) return tooMany(verdict);
  return NextResponse.json(answer, { headers: cacheHeaders(viewer, 60) });
}
