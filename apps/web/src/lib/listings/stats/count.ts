import "server-only";

import { resolveSession } from "@/lib/actions/session";
import { isQaAccount } from "@/lib/admin/reads/shapes";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { consume, ipFromHeaders, subjectForIp } from "@/lib/security/rate-limit";
import { guestKey, isMissingFunction, listingIdFrom, viewRefusal, type ViewRefusal } from "./record";

/**
 * ONE BEACON FROM `ListingViewBeacon`, START TO FINISH (founder, 13 November
 * 2026). Called by `app/api/listing-view/route.ts`, which always answers 204
 * whatever this returns, so a page learns nothing from it and never waits.
 *
 *   1. The body names one listing id; anything else is dropped.
 *   2. `viewRefusal`: not from a Vallo page, not a browser, or usage counts
 *      declined. Turned away before any database work.
 *   3. 120 beacons an hour per network address (the durable limiter), so a
 *      script cannot walk the catalogue from one address.
 *   4. A signed-in member is passed by id (the QA accounts never); a guest by
 *      `guestKey`. The service role calls `public.record_listing_view`, which
 *      keeps one view per viewer per listing per Lagos day and leaves out the
 *      lister, staff, internal accounts and examples.
 *   5. FAIL QUIET. Until the pending SQL is applied the function is missing:
 *      a member's open still reaches V-73's `record_listing_views` (as the
 *      server render used to send it), a guest's is simply not counted.
 *
 * The dependencies are arguments so the whole path is tested without a
 * network or a database.
 */

export type CountOutcome = "counted" | "repeat" | "dropped" | "limited" | "unavailable" | `refused:${ViewRefusal}`;

type Rpc = { rpc: (fn: string, args: object) => PromiseLike<{ data: unknown; error: unknown }> };

export type CountDeps = {
  viewer: () => Promise<string | null>;
  allow: (subject: string) => Promise<boolean>;
  db: () => Rpc | null;
};

const defaultDeps: CountDeps = {
  viewer: async () => {
    const session = await resolveSession();
    return session.state === "signed-in" ? session.user.id : null;
  },
  allow: async (subject) =>
    (await consume({ bucket: "listing_view", subject, limit: 120, windowSeconds: 3_600 })).allowed,
  db: () =>
    isSupabaseConfigured() && (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length > 0
      ? (createAdminClient({ deadlineMs: 4_000 }) as unknown as Rpc)
      : null,
};

export async function countListingView(request: Request, deps: CountDeps = defaultDeps): Promise<CountOutcome> {
  if (Number(request.headers.get("content-length") ?? "0") > 1024) return "dropped";
  let listingId: string | null = null;
  try {
    listingId = listingIdFrom(await request.text());
  } catch {
    return "dropped";
  }
  if (!listingId) return "dropped";

  const h = request.headers;
  const userAgent = h.get("user-agent");
  const refusal = viewRefusal({
    userAgent,
    origin: h.get("origin"),
    host: h.get("x-forwarded-host") ?? h.get("host"),
    fetchSite: h.get("sec-fetch-site"),
    cookie: h.get("cookie"),
    gpc: h.get("sec-gpc"),
  });
  if (refusal) return `refused:${refusal}`;

  const address = ipFromHeaders(h);
  try {
    if (!(await deps.allow(subjectForIp(address)))) return "limited";
  } catch {
    /* The limiter fails open on its own; a throw here is the same. */
  }

  try {
    const db = deps.db();
    if (!db) return "unavailable";
    const viewer = await deps.viewer();
    if (viewer && isQaAccount(viewer)) return "refused:bot";
    const { data, error } = await db.rpc("record_listing_view", {
      p_listing: listingId,
      p_viewer: viewer,
      p_guest: viewer ? null : guestKey(address, userAgent ?? ""),
    });
    if (!error) return data === true ? "counted" : "repeat";
    if (isMissingFunction(error) && viewer) {
      /* Before the pending SQL: the V-73 recorder still counts a member's open,
         with the internal-account check RecordViews used to make (C10). */
      const { isInternalAccount } = await import("@/lib/admin/internal-accounts");
      if (await isInternalAccount(viewer)) return "repeat";
      const old = await db.rpc("record_listing_views", { p_viewer: viewer, p_seen: [], p_opened: listingId });
      return old.error ? "unavailable" : "counted";
    }
    return "unavailable";
  } catch {
    return "unavailable";
  }
}
