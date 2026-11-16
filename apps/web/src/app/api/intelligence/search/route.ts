import { after, NextResponse } from "next/server";
import { recordSearchEvent, rememberSearch } from "@/lib/intelligence/analytics";
import { runSearch } from "@/lib/intelligence/engine";
import { cacheHeaders, engineDeps, filtersSet, limitFor, paramsOf, searchParams, sessionKey, tooMany } from "@/lib/intelligence/http";
import { resolveViewer } from "@/lib/intelligence/viewer";

/**
 * GET /api/intelligence/search?q=&tab=&cursor=&submit=1&drop=&...filters
 *
 * One VALLO Intelligence search (`SearchResponse`). `submit=1` marks a search
 * the person submitted: only then may the model step run (and only when the
 * rules read too little, the assistant is on, the person agreed to AI and the
 * budget allows), and only then is the search recorded for analytics and in
 * the member's own recent searches, after the response has gone.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request): Promise<NextResponse> {
  const parsed = searchParams.safeParse(paramsOf(request));
  if (!parsed.success) return NextResponse.json({ error: "Check the search words." }, { status: 400 });
  const p = parsed.data;
  const viewer = await resolveViewer();
  const submitted = p.submit === "1" && !p.cursor;
  const [verdict, answer] = await Promise.all([
    limitFor("search", viewer, request),
    runSearch(
      { q: p.q, tab: p.tab, cursor: p.cursor ?? null, viewer, drop: p.drop, set: filtersSet(p), allowModel: submitted && p.q.length > 0 },
      engineDeps(viewer, request),
    ),
  ]);
  if (!verdict.allowed) return tooMany(verdict);

  if (submitted && answer.q.length > 0) {
    const session = sessionKey(request, viewer);
    after(async () => {
      await Promise.all([
        recordSearchEvent({
          event: "search",
          query: answer.showing?.query ?? answer.q,
          kind: answer.understood.kind,
          tab: answer.tab,
          results: answer.results.length,
          tookMs: answer.tookMs,
          place: answer.understood.place,
          session,
        }),
        rememberSearch(viewer, answer.q),
      ]);
    });
  }
  return NextResponse.json(answer, { headers: cacheHeaders(viewer, 15) });
}
