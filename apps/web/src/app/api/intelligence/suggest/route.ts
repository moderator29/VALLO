import { NextResponse } from "next/server";
import { cacheHeaders, limitFor, paramsOf, suggestParams, tooMany } from "@/lib/intelligence/http";
import { suggest } from "@/lib/intelligence/suggest";
import { resolveViewer } from "@/lib/intelligence/viewer";

/**
 * GET /api/intelligence/suggest?q=&tab=
 *
 * Typed-ahead suggestions for VALLO Intelligence (`SuggestResponse`). Fast,
 * never the model, debounced by the screen. The limiter runs beside the work
 * so it adds no wait; a spent allowance is answered 429.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const parsed = suggestParams.safeParse(paramsOf(request));
  if (!parsed.success) return NextResponse.json({ error: "Check the search words." }, { status: 400 });
  const viewer = await resolveViewer();
  const [verdict, answer] = await Promise.all([
    limitFor("suggest", viewer, request),
    suggest({ q: parsed.data.q, tab: parsed.data.tab, viewer }),
  ]);
  if (!verdict.allowed) return tooMany(verdict);
  return NextResponse.json(answer, { headers: cacheHeaders(viewer, 30) });
}
