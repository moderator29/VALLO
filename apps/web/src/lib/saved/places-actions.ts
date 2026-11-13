"use server";

/**
 * The shortlist across both sides: save a stay, a table or a listing.
 *
 * public.saved_places is keyed on the catalogue entity kind, so one row shape
 * serves the Property side (listing) and the Stays side (accommodation,
 * restaurant). Every write runs under the account's own RLS-bound client, so
 * the database decides whose shortlist it is. There is no toggle here on
 * purpose: the two sides render their hearts from a list they already hold,
 * so save and unsave are separate, idempotent intents, and a double tap or a
 * stale tab cannot flip a save the wrong way.
 *
 * The entity id carries no foreign key (M13 explains why), so a save against
 * a retired entity simply resolves to nothing at read time. The caller
 * resolves ids to cards through the catalogue; this module only knows keys.
 *
 * NOTHING BUT ASYNC FUNCTIONS IS EXPORTED FROM HERE, and that is a rule rather
 * than a tidiness. A `"use server"` module may export async functions and
 * nothing else, not even a type: this build lost production for twenty minutes
 * to that exact mistake. `SavedPlace`, the shape every write below answers
 * with, lives in `./places` with the rest of the pure half and is imported as
 * a type. Anything new here is an async function or it belongs in `./places`.
 */

import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import { setupExempt } from "../actions/setup-exempt";
import { SAVED_PLACE_KINDS, asSavedPlaceKind, type SavedPlaceKind } from "./db";
import type { SavedPlace } from "./places";

const placeKeySchema = z.object({
  entityKind: z.enum(SAVED_PLACE_KINDS, { message: "That is not something we can save." }),
  entityId: z.uuid("This place could not be identified."),
});

const listSchema = z.object({
  entityKind: z.enum(SAVED_PLACE_KINDS).optional(),
});

const SAVE_DOWN_MESSAGE =
  "We could not update your shortlist just now. Please try again in a moment.";

/** Put a place on the shortlist. Saying it twice is one save. */
export async function savePlace(input: {
  entityKind: SavedPlaceKind;
  entityId: string;
}): Promise<ActionResult<SavedPlace>> {
  const parsed = validate(placeKeySchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { data, error } = await session.supabase
    .from("saved_places")
    .insert({
      user_id: session.user.id,
      entity_kind: parsed.data.entityKind,
      entity_id: parsed.data.entityId,
    })
    .select("entity_kind, entity_id, created_at")
    .single();

  if (error || !data) {
    // 23505: already saved in another tab. The intent is satisfied.
    if (error?.code === "23505") {
      const { data: existing } = await session.supabase
        .from("saved_places")
        .select("entity_kind, entity_id, created_at")
        .eq("user_id", session.user.id)
        .eq("entity_kind", parsed.data.entityKind)
        .eq("entity_id", parsed.data.entityId)
        .maybeSingle();
      if (existing) {
        /* Already saved in another tab: no revalidation, as in the first-write
           branch (see `toggleSave` in ./actions.ts for why); /saved refreshes
           itself through `SavedFreshness` when this tab shows it. */
        return ok({
          entityKind: asSavedPlaceKind(existing.entity_kind),
          entityId: existing.entity_id,
          savedAt: existing.created_at,
        });
      }
    }
    return fail(SAVE_DOWN_MESSAGE);
  }

  return ok({
    entityKind: asSavedPlaceKind(data.entity_kind),
    entityId: data.entity_id,
    savedAt: data.created_at,
  });
}

/** Take a place off the shortlist. Removing what is not there is a no-op. */
export async function unsavePlace(input: {
  entityKind: SavedPlaceKind;
  entityId: string;
}): Promise<ActionResult<null>> {
  const parsed = validate(placeKeySchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { error } = await session.supabase
    .from("saved_places")
    .delete()
    .eq("user_id", session.user.id)
    .eq("entity_kind", parsed.data.entityKind)
    .eq("entity_id", parsed.data.entityId);
  if (error) return fail(SAVE_DOWN_MESSAGE);

  return ok(null);
}

/**
 * The account's saved places, newest first, optionally one kind. Empty when
 * signed out or unconfigured rather than an error: a shortlist is a section
 * of a screen with other things on it.
 */
/* B-2: read-only (or an exit the finish-setup hold never blocks), so it runs
   with the hold lifted. See lib/actions/setup-exempt.ts. */
export async function listSavedPlaces(
  ...args: Parameters<typeof listSavedPlacesInner>
): Promise<Awaited<ReturnType<typeof listSavedPlacesInner>>> {
  return setupExempt(() => listSavedPlacesInner(...args));
}

async function listSavedPlacesInner(input?: {
  entityKind?: SavedPlaceKind;
}): Promise<ActionResult<SavedPlace[]>> {
  const parsed = validate(listSchema, input ?? {});
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") return ok([]);

  let query = session.supabase
    .from("saved_places")
    .select("entity_kind, entity_id, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (parsed.data.entityKind) query = query.eq("entity_kind", parsed.data.entityKind);

  const { data, error } = await query;
  if (error) return fail("We could not load your shortlist just now. Please try again in a moment.");
  return ok(
    (data ?? []).map((row) => ({
      entityKind: asSavedPlaceKind(row.entity_kind),
      entityId: row.entity_id,
      savedAt: row.created_at,
    })),
  );
}

/*
 * The Stays side, by name.
 *
 * A stay card and a restaurant card each carry one heart, and the component
 * behind it should not have to know the catalogue's kind vocabulary to tap
 * it. These are `savePlace` and `unsavePlace` with the kind fixed, so a
 * caller cannot save a restaurant as an accommodation by passing the wrong
 * string, and each still revalidates /saved through the function it wraps.
 */

/** Put an accommodation on the shortlist. */
export async function saveStay(input: { accommodationId: string }): Promise<ActionResult<SavedPlace>> {
  return savePlace({ entityKind: "accommodation", entityId: input.accommodationId });
}

/** Take an accommodation off the shortlist. */
export async function unsaveStay(input: { accommodationId: string }): Promise<ActionResult<null>> {
  return unsavePlace({ entityKind: "accommodation", entityId: input.accommodationId });
}

/** Put a restaurant on the shortlist. */
export async function saveRestaurant(input: { restaurantId: string }): Promise<ActionResult<SavedPlace>> {
  return savePlace({ entityKind: "restaurant", entityId: input.restaurantId });
}

/** Take a restaurant off the shortlist. */
export async function unsaveRestaurant(input: { restaurantId: string }): Promise<ActionResult<null>> {
  return unsavePlace({ entityKind: "restaurant", entityId: input.restaurantId });
}
