import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAiConsent } from "@/lib/ai/consent-server";
import { isFeatureEnabled } from "@/lib/flags";
import { isVisitId, VISIT_COOKIE } from "@/lib/funnel/steps";
import { consume, ipFromHeaders, subjectForIp, subjectForUser, type RateLimitVerdict } from "@/lib/security/rate-limit";
import { INTELLIGENCE_KINDS, INTELLIGENCE_TABS, type Understood } from "./contract";
import { readStaffAliases } from "./analytics";
import type { EngineDeps } from "./engine";
import { askModel } from "./model";
import { placeFromLabel, placeLabel } from "./places";
import { SOURCES } from "./sources";
import { cleanQuery, MAX_QUERY_LENGTH } from "./text";
import type { Viewer } from "./viewer";

/**
 * THE ROUTES' SHARED DOOR: input, limits, cache headers, the engine's wiring.
 *
 * Input is read with zod and cleaned (`cleanQuery`: control characters out,
 * 120 characters at most). Limits use the project's durable limiter
 * (`lib/security/rate-limit`, which fails open), per member when signed in
 * and per address when not. Responses to a visitor may be kept briefly by a
 * browser or a CDN; a member's never are.
 */

const query = z
  .string()
  .max(MAX_QUERY_LENGTH * 4)
  .transform((s) => cleanQuery(s));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/* A code: an amenity ("wifi") or a listing kind ("shortlet"). */
const AMENITY = /^[a-z][a-z0-9_-]{0,23}$/;

export const suggestParams = z.object({
  q: query.default(""),
  tab: z.enum(INTELLIGENCE_TABS).catch("all"),
});

export const searchParams = z.object({
  q: query.default(""),
  tab: z.enum(INTELLIGENCE_TABS).catch("all"),
  cursor: z.string().max(200).optional(),
  /** Comma list of `Understood` keys the person removed. */
  drop: z
    .string()
    .max(200)
    .optional()
    .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 16) : [])),
  /** "1" on a submitted search (Enter, a suggestion tapped); absent on tab switches and paging. */
  submit: z.enum(["1", "0"]).optional(),
  kind: z.enum(INTELLIGENCE_KINDS).optional().catch(undefined),
  intent: z.enum(["rent", "buy", "stay"]).optional().catch(undefined),
  place: z.string().max(80).optional(),
  beds: z.coerce.number().int().min(1).max(20).optional().catch(undefined),
  max: z.coerce.number().int().min(1).max(100_000_000_000).optional().catch(undefined),
  min: z.coerce.number().int().min(1).max(100_000_000_000).optional().catch(undefined),
  furnished: z.enum(["1", "0"]).optional().catch(undefined),
  amenities: z.string().max(200).optional(),
  in: z.string().regex(ISO).optional().catch(undefined),
  out: z.string().regex(ISO).optional().catch(undefined),
  guests: z.coerce.number().int().min(1).max(30).optional().catch(undefined),
  since: z.string().regex(ISO).optional().catch(undefined),
  /** Marketplace listing kinds the person kept or set ("hotel,shortlet"); each source keeps only the kinds it knows. */
  types: z.string().max(200).optional(),
  /** The leftover words the person kept as text (the "words" chip). */
  words: z.string().max(MAX_QUERY_LENGTH * 4).optional(),
});

export type SearchParamsIn = z.infer<typeof searchParams>;

/** The filters the screen set explicitly, validated against what the platform holds. */
export function filtersSet(p: SearchParamsIn): Partial<Understood> | undefined {
  const set: Partial<Understood> = {};
  if (p.kind) set.kind = p.kind;
  if (p.intent) set.intent = p.intent;
  const place = placeFromLabel(p.place);
  if (place) set.place = placeLabel(place);
  if (p.beds !== undefined) set.bedrooms = p.beds;
  if (p.max !== undefined) set.maxPrice = p.max;
  if (p.min !== undefined && (p.max === undefined || p.min <= p.max)) set.minPrice = p.min;
  if (p.furnished) set.furnished = p.furnished === "1";
  if (p.amenities) {
    const codes = [...new Set(p.amenities.split(",").map((a) => a.trim().toLowerCase()).filter((a) => AMENITY.test(a)))].slice(0, 10);
    if (codes.length > 0) set.amenities = codes;
  }
  if (p.in && p.out && p.out > p.in) {
    set.checkIn = p.in;
    set.checkOut = p.out;
  }
  if (p.guests !== undefined) set.guests = p.guests;
  if (p.since) set.addedSince = p.since;
  if (p.types) {
    const kinds = [...new Set(p.types.split(",").map((k) => k.trim().toLowerCase()).filter((k) => AMENITY.test(k)))].slice(0, 8);
    if (kinds.length > 0) set.listingKinds = kinds;
  }
  if (p.words) {
    const text = cleanQuery(p.words).slice(0, 80);
    if (text) set.text = text;
  }
  return Object.keys(set).length > 0 ? set : undefined;
}

export function paramsOf(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(request.url).searchParams) if (!(k in out)) out[k] = v;
  return out;
}

/* ------------------------------------------------------------------ limits */

export const LIMITS = {
  suggest: { limit: 600, windowSeconds: 300 },
  search: { limit: 150, windowSeconds: 300 },
  discover: { limit: 120, windowSeconds: 300 },
  event: { limit: 300, windowSeconds: 600 },
  recent: { limit: 60, windowSeconds: 600 },
  model: { limit: 30, windowSeconds: 3_600 },
} as const;

export function limitFor(bucket: keyof typeof LIMITS, viewer: Viewer, request: Request): Promise<RateLimitVerdict> {
  return consume({
    bucket: `intelligence_${bucket}`,
    subject: viewer.userId ? subjectForUser(viewer.userId) : subjectForIp(ipFromHeaders(request.headers)),
    ...LIMITS[bucket],
  });
}

export function tooMany(verdict: Extract<RateLimitVerdict, { allowed: false }>): NextResponse {
  return NextResponse.json(
    { error: `Too many searches. Try again ${verdict.retryIn}.` },
    { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds), "cache-control": "no-store" } },
  );
}

/* ------------------------------------------------------------------ caching */

/** Short and public for a visitor (the answer is the same for every visitor), private and unkept for a member. */
export function cacheHeaders(viewer: Viewer, publicSeconds: number): Record<string, string> {
  if (viewer.signedIn) return { "cache-control": "private, no-store", vary: "Cookie" };
  return { "cache-control": `public, max-age=${publicSeconds}, s-maxage=${publicSeconds}, stale-while-revalidate=${publicSeconds * 2}`, vary: "Cookie" };
}

/* ------------------------------------------------------------------ session */

/** The key the analytics hash: the analytics visit cookie, or the member. Never stored as is. */
export function sessionKey(request: Request, viewer: Viewer): string | null {
  const visit = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${VISIT_COOKIE}=([0-9a-f-]{36})`, "i"))?.[1];
  if (isVisitId(visit)) return `v:${visit}`;
  return viewer.userId ? `u:${viewer.userId}` : null;
}

/* ------------------------------------------------------------------ wiring */

/** The engine as the routes run it: every source, the staff aliases and (gated) the model. */
export function engineDeps(viewer: Viewer, request: Request): EngineDeps {
  return {
    sources: SOURCES,
    aliases: () => readStaffAliases(),
    model: async (q, today) => {
      /* The assistant's own switch, the person's AI consent, and a budget. */
      if (!(await isFeatureEnabled("assistant"))) return null;
      const consented = await hasAiConsent(viewer.signedIn && viewer.db && viewer.userId ? { supabase: viewer.db, userId: viewer.userId } : {});
      if (!consented) return null;
      const verdict = await limitFor("model", viewer, request);
      if (!verdict.allowed) return null;
      return askModel(q, today);
    },
  };
}
