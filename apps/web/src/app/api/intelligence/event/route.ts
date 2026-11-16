import { after, NextResponse } from "next/server";
import { z } from "zod";
import { INTELLIGENCE_KINDS, INTELLIGENCE_TABS } from "@/lib/intelligence/contract";
import { recordSearchEvent } from "@/lib/intelligence/analytics";
import { limitFor, sessionKey } from "@/lib/intelligence/http";
import { cleanQuery } from "@/lib/intelligence/text";
import { resolveViewer } from "@/lib/intelligence/viewer";

/**
 * POST /api/intelligence/event  { event: "click", q, tab, kind, position }
 *
 * The click beacon: which kind of result was opened from which tab, at which
 * position. Fire and forget, always 204, so a page learns nothing from it.
 * The body is capped at 1 KB; the words are normalised and dropped by the
 * database when they carry a long run of digits; no id or address is kept.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY = () => new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });

const body = z.object({
  event: z.literal("click"),
  q: z.string().max(480).transform((s) => cleanQuery(s)),
  tab: z.enum(INTELLIGENCE_TABS).catch("all"),
  kind: z.enum(INTELLIGENCE_KINDS),
  position: z.number().int().min(0).max(500).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (Number(request.headers.get("content-length") ?? "0") > 1024) return EMPTY();
  let json: unknown = null;
  try {
    const text = await request.text();
    json = text.length <= 1024 ? JSON.parse(text) : null;
  } catch {
    return EMPTY();
  }
  const parsed = body.safeParse(json);
  if (!parsed.success || parsed.data.q.length === 0) return EMPTY();
  const viewer = await resolveViewer();
  const verdict = await limitFor("event", viewer, request);
  if (!verdict.allowed) return EMPTY();
  const session = sessionKey(request, viewer);
  const e = parsed.data;
  after(() =>
    recordSearchEvent({ event: "click", query: e.q, tab: e.tab, clickedKind: e.kind, position: e.position, session }),
  );
  return EMPTY();
}
