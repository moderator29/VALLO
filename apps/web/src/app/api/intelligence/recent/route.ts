import { NextResponse } from "next/server";
import { forgetRecentSearches, readRecentSearches } from "@/lib/intelligence/analytics";
import { limitFor, tooMany } from "@/lib/intelligence/http";
import { cleanQuery } from "@/lib/intelligence/text";
import { resolveViewer } from "@/lib/intelligence/viewer";

/**
 * The member's own recent searches.
 *
 *   GET    /api/intelligence/recent           the list, newest first
 *   DELETE /api/intelligence/recent?q=words   forget one
 *   DELETE /api/intelligence/recent           forget them all
 *
 * Signed in only, through the member's own session (`public.search_recent`,
 * own rows only). Until the pending SQL is applied the list is empty and a
 * delete answers 503 with `not_set_up`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "cache-control": "private, no-store" };

export async function GET(): Promise<NextResponse> {
  const viewer = await resolveViewer();
  if (!viewer.signedIn) return NextResponse.json({ error: "Sign in to see your recent searches." }, { status: 401, headers: PRIVATE });
  return NextResponse.json({ recent: await readRecentSearches(viewer, 20) }, { headers: PRIVATE });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const viewer = await resolveViewer();
  if (!viewer.signedIn) return NextResponse.json({ error: "Sign in to change your recent searches." }, { status: 401, headers: PRIVATE });
  const verdict = await limitFor("recent", viewer, request);
  if (!verdict.allowed) return tooMany(verdict);
  const raw = new URL(request.url).searchParams.get("q");
  const q = raw === null ? null : cleanQuery(raw);
  if (q !== null && q.length === 0) return NextResponse.json({ error: "Say which search to forget." }, { status: 400, headers: PRIVATE });
  const outcome = await forgetRecentSearches(viewer, q);
  if (outcome === "ok") return NextResponse.json({ ok: true }, { headers: PRIVATE });
  if (outcome === "not-set-up") return NextResponse.json({ ok: false, reason: "not_set_up" }, { status: 503, headers: PRIVATE });
  return NextResponse.json({ ok: false, reason: "failed" }, { status: 502, headers: PRIVATE });
}
