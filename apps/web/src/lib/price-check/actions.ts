"use server";

import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, resolveSession } from "../actions/session";
import { isSupabaseConfigured } from "../supabase/env";
import { createAdminClient } from "../supabase/admin";
import { coarsenPoint } from "./address";
import { isHeldAreaName, looksLikeAnAddress } from "./area-name";
import { geohash5 } from "./geohash";
import { publicAreaName } from "../share/public-text";
import { areaSuggestions } from "./queries";
import { insertPriceCheckWatch, priceCheckRpc } from "./rpc";
import { openShareSeal, shareSealKey } from "./share-seal";
import {
  areaSuggestionSchema,
  recordStageSchema,
  shareSealSchema,
  watchSpotSchema,
} from "./schema";
import type { AreaSuggestion } from "./types";
import { headers } from "next/headers";
import { consume, ipFromHeaders, subjectForIp, subjectForUser } from "../security/rate-limit";

/**
 * THE FOUR THINGS A PRICE CHECK WRITES, AND WHAT EACH ONE IS ALLOWED TO KEEP.
 *
 * This module exports only async functions, which is what
 * `nf/server-actions-export-only-actions` requires of a "use server" module and
 * what the twenty minute outage of 19 September was about. The schemas and the
 * constants live in `schema.ts` beside it.
 *
 * ---------------------------------------------------------------------------
 * THE COARSENING HAPPENS HERE, NOT ON THE CLIENT, AND THAT IS THE POINT.
 *
 * A client that coarsened its own point could be changed to stop. The server
 * takes the precise point, uses it to ask the gate, and writes only the
 * coarsened form: a five character cell for the funnel, three decimal places
 * for a watch. Neither table has a column a finer one could go in, so this is
 * belt and braces rather than the whole belt.
 *
 * ---------------------------------------------------------------------------
 * AND THE FREE TEXT HINT IS NOT A PARAMETER OF ANY FUNCTION IN THIS FILE.
 *
 * "Anything else that helps, like the estate name or the nearest landmark" is
 * stored nowhere and parsed never. It lives in the form's own state while the
 * person is on the screen. Section 4.2 of the research file is not a paragraph
 * in a policy; it is a column list, and this is the column that is not in it.
 */

const NOT_SIGNED_IN =
  "Sign in to be told when we can answer. This arrives in your Vallo notifications and we do not send emails for it.";

const WATCH_FAILED =
  "We could not save that just now. Nothing was lost, so try again in a moment.";

const SHARE_FAILED =
  "We could not make that card just now. Nothing was lost, so try again in a moment.";

/*
 * THE FREE TEXT ROUTE ONTO A SHARE CARD, AND WHY IT IS CLOSED HERE.
 *
 * `shareAreaSchema.area` is a string a caller supplies: it now travels inside
 * the server's seal, but the page sealed it from the query string, and anyone
 * can write a query string. Until this check, the only thing
 * between an arbitrary 80 character string and the heading on a forwarded card
 * was `price_check_shares_area_is_not_an_address`, which refuses a leading
 * house number and a number followed by a street word and is deliberately
 * narrow so that "1004 Estate" and "Phase 2" get through. "14 Bourdillon" has
 * neither shape and would have been minted.
 *
 * So an area is not a shape question any more. IT MUST BE A NEIGHBOURHOOD NAME
 * WE ACTUALLY HOLD REAL PUBLISHED LISTINGS IN, which is the only neighbourhood
 * vocabulary this platform has and is exactly what a card can honestly be
 * about: a card is minted from the area report, the area report needs three
 * real published listings in that area, and `area_suggestions` is the same
 * set. An area we cannot report on is an area we cannot mint a card for.
 *
 * IT FAILS CLOSED. An unreachable database returns no suggestions and the card
 * is refused. Refusing a card costs a person one tap; minting one that names a
 * building is the thing this whole surface exists to make impossible.
 *
 * A state-wide card carries no area at all and is unaffected.
 */
const SHARE_TOO_MANY = "That is a lot of cards at once. Try again {when}.";

/** Cards one person (or one address, signed out) may mint per window. */
const SHARE_LIMIT = 20;
const SHARE_WINDOW_SECONDS = 3600;

/** Funnel rows one person (or one address) may write per window: about
    thirty full checks of seven stages an hour, far past any real reader. */
const STAGE_LIMIT = 240;
const STAGE_WINDOW_SECONDS = 3600;

const SHARE_AREA_UNKNOWN =
  "We can only make a card for an area we hold listings in. Run the check again and pick the area from the list.";

/** Rung three of the ladder: the only neighbourhood vocabulary we hold. */
export async function fetchAreaSuggestions(input: unknown): Promise<ActionResult<AreaSuggestion[]>> {
  const parsed = validate(areaSuggestionSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  return ok(await areaSuggestions(parsed.data.stateCode, parsed.data.query ?? null));
}

/**
 * Record one stage of one check.
 *
 * ALWAYS `ok`, EVEN WHEN IT FAILS, and that is deliberate. This is
 * instrumentation. A funnel row that could not be written must never turn into
 * an error a person reads on a screen about their own home, and it must never
 * stop the answer arriving. The failure is swallowed here and the only cost is
 * one missing row in a table nobody but an admin can read.
 *
 * The service-role client is used because `record_price_check_event` is BORN
 * LOCKED: EXECUTE is revoked from anon and authenticated in its own migration,
 * so a browser can record nothing directly and can read nobody's rows, not
 * even its own.
 */
export async function recordPriceCheckStage(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(recordStageSchema, input);
  if (!parsed.ok) return ok(null);
  if (!isSupabaseConfigured()) return ok(null);

  const values = parsed.data;

  try {
    const session = await resolveSession();
    const userId = session.state === "signed-in" ? session.user.id : null;

    /* An open, anonymous door onto a service-role write, so it is paced like
       the card mint: per person, or per address signed out. Over the limit
       the row is simply not written; the reader sees nothing either way. */
    const verdict = await consume({
      bucket: "price_check_stage",
      subject: userId ? subjectForUser(userId) : subjectForIp(ipFromHeaders(await headers())),
      limit: STAGE_LIMIT,
      windowSeconds: STAGE_WINDOW_SECONDS,
    });
    if (!verdict.allowed) return ok(null);

    await priceCheckRpc(createAdminClient(), "record_price_check_event", {
      p_check_id: values.checkId,
      p_stage: values.stage,
      p_user_id: userId,
      p_entry_point: values.entryPoint ?? null,
      p_state_code: values.stateCode ?? null,
      p_lga_code: values.lgaCode ?? null,
      /* The cell, computed here from a point that is then dropped. Null when
         no pin was ever placed: latitude zero, longitude zero is a real cell
         in the Gulf of Guinea and would quietly become the busiest
         neighbourhood in this funnel. */
      p_geohash5: geohash5(values.lat ?? null, values.lng ?? null),
      p_property_type: values.propertyType ?? null,
      p_listing_intent: values.listingIntent ?? null,
      p_bedrooms: values.bedrooms ?? null,
      p_size_stated: values.sizeStated ?? null,
      p_outcome: values.outcome ?? null,
      p_refusal_code: values.refusalCode ?? null,
      p_comparable_count: values.comparableCount ?? null,
      p_radius_m: values.radiusM ?? null,
      p_dispersion: values.dispersion ?? null,
      p_confidence: values.confidence ?? null,
      p_intent_chosen: values.intentChosen ?? null,
      p_listing_id: null,
    });
  } catch {
    /* Instrumentation never becomes the reader's problem. */
  }

  return ok(null);
}

/**
 * Tell me when you can answer.
 *
 * SIGNED IN ONLY, AND THE COPY SAYS SO RATHER THAN PROMISING AN EMAIL. The
 * sweep tells a watcher through `private.notify`, which writes a row the
 * notifications screen already reads, so this promise is kept by machinery
 * that exists and works today. An email to a signed-out watcher would need an
 * outbox this database does not have, and a refusal screen that promises an
 * email nothing sends would be a worse lie than the refusal it replaced.
 *
 * The point is rounded before it is written. The unique constraint means a
 * second tap on the same refusal is the same watch rather than a second
 * notification, so a duplicate is reported as success: the person's intent is
 * satisfied either way and telling them off for tapping twice is noise.
 */
export async function watchThisSpot(input: unknown): Promise<ActionResult<{ watching: true }>> {
  const parsed = validate(watchSpotSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(NOT_SIGNED_IN);

  const values = parsed.data;
  const point = coarsenPoint(values.lat, values.lng);

  const { error } = await insertPriceCheckWatch(session.supabase, {
    user_id: session.user.id,
    lat: point.lat,
    lng: point.lng,
    state_code: values.stateCode,
    lga_code: values.lgaCode ?? null,
    area: values.area ?? null,
    property_type: values.propertyType,
    listing_intent: values.listingIntent,
    bedrooms: values.bedrooms,
  });

  /* 23505 is a unique violation: they are already watching this spot, which is
     the outcome they asked for. */
  if (error && error.code !== "23505") return fail(WATCH_FAILED);

  return ok({ watching: true });
}

/**
 * Mint an area level share card.
 *
 * THE RULE IS ABSOLUTE AND IT IS KEPT IN THREE PLACES, of which this is the
 * weakest. `price_check_share_scope` has two labels and neither is a property.
 * `create_price_check_share` has no parameter for an address, a coordinate or
 * a listing id. `price_check_shares` has no column for one and a check refuses
 * an area string shaped like a street address. This function simply has
 * nothing to pass even if it wanted to.
 *
 * A refused check mints nothing, because the three figures are required: an
 * image is a claim and a refusal has nothing to claim. And the figures are
 * never the caller's: the input is a seal the server made over the card when
 * it computed it, so a made-up range cannot be minted.
 */
export async function shareAreaPrices(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = validate(shareSealSchema, input);
  if (!parsed.ok) return fail(SHARE_FAILED);
  if (!isSupabaseConfigured()) return fail(NOT_CONFIGURED_MESSAGE);

  /* THE CARD IS THE SERVER'S. Every figure, the count and the place come from
     the seal the page made when it computed them (`share-seal.ts`); a caller
     can carry a seal but cannot write one, so it cannot mint a figure. */
  const key = shareSealKey();
  const values = key ? openShareSeal(key, parsed.data.seal, Math.floor(Date.now() / 1000)) : null;
  if (values === null) return fail(SHARE_FAILED);

  /* RULE 10: a card names only a neighbourhood on the closed list, in its own
     state, stored in the list's spelling. Checked at mint as well as at
     render. */
  const listedArea = values.area === undefined ? null : publicAreaName(values.area, values.stateCode);
  if (values.area !== undefined && listedArea === null) return fail(SHARE_AREA_UNKNOWN);

  if (values.area !== undefined) {
    /* The shape rule first, because it needs no round trip and because it is
       the same rule the database applies, read a second time at a different
       moment. */
    if (looksLikeAnAddress(values.area)) return fail(SHARE_AREA_UNKNOWN);
    const held = await areaSuggestions(values.stateCode, values.area);
    if (!isHeldAreaName(values.area, held.map((row) => row.area))) {
      return fail(SHARE_AREA_UNKNOWN);
    }
  }

  const session = await resolveSession();
  const createdBy = session.state === "signed-in" ? session.user.id : null;

  /* Minting writes a public row through the service role and is open to a
     signed-out reader, so it is bounded per person, or per address when
     there is no account. */
  const verdict = await consume({
    bucket: "price_share_mint",
    subject: createdBy ? subjectForUser(createdBy) : subjectForIp(ipFromHeaders(await headers())),
    limit: SHARE_LIMIT,
    windowSeconds: SHARE_WINDOW_SECONDS,
  });
  if (!verdict.allowed) return fail(SHARE_TOO_MANY.replace("{when}", verdict.retryIn));

  try {
    const { data, error } = await priceCheckRpc(
      createAdminClient(),
      "create_price_check_share",
      {
        p_scope: values.scope,
        p_state_code: values.stateCode,
        p_lga_code: values.lgaCode ?? null,
        p_area: listedArea,
        p_property_type: values.propertyType ?? null,
        p_listing_intent: values.listingIntent,
        p_bedrooms: values.bedrooms ?? null,
        p_low_minor: values.lowMinor,
        p_mid_minor: values.midMinor,
        p_high_minor: values.highMinor,
        p_listing_count: values.listingCount,
        p_oldest_at: values.oldestAt ?? null,
        p_newest_at: values.newestAt ?? null,
        p_created_by: createdBy,
      },
    );
    if (error || typeof data !== "string") return fail(SHARE_FAILED);
    return ok({ id: data });
  } catch {
    return fail(SHARE_FAILED);
  }
}
