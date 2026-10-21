"use server";

/**
 * Deciding on a stays business, and recording its rungs.
 *
 * The same machine as `reviewListing`, applied to the operator entity: a
 * human moves SUBMITTED to APPROVED, then a second, property-level gate moves
 * an accommodation to PUBLISHED. Two gates rather than one, because approving
 * an operator and putting a specific property on the shelf are different
 * judgements and the second one has a requirement the first cannot check
 * (the pin, MK-55).
 *
 * A REFUSAL AND A SEND-BACK CARRY THE REVIEWER'S WORDS, and the minimum is
 * twelve characters rather than a token four for the reason `kyc-actions.ts`
 * gives: "blurry" is a complete and useful sentence and "no" is not. A host
 * told no with nothing to answer uploads the same document again and
 * concludes the platform is refusing them personally.
 *
 * THE TIER IS NEVER WRITTEN HERE. `business_verification_checks` is the only
 * thing this file writes for verification, and a database trigger recomputes
 * `businesses.verification_tier` and the badge from the rungs that actually
 * passed, so the badge a guest eventually sees can only be the sum of
 * decisions somebody made.
 *
 * The decision goes through the admin's own RLS-bound client, so Postgres
 * re-checks the role on the mutation rather than trusting a page that already
 * checked. The audit line and the owner's notification are the service role's
 * work, because `audit_log` has no insert policy for anybody and
 * `notifications` has no client insert policy at all, both deliberately, and
 * both are best effort after the decision has committed: a failed log line
 * must not turn a real decision into an error the operator cannot act on.
 */

import { withPublicPoint } from "../supabase/public-point";
import { revalidatePath } from "next/cache";
import { ARRIVAL_DECLARATION_NEEDED, arrivalChargesDeclared } from "../stays/arrival-gate";
import { withBusinessPrivate } from "../supabase/private-fields";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { createAdminClient } from "../supabase/admin";
import type { Database } from "../supabase/database.types";
import { writeAudit, type AuditDetail } from "./audit";
import { BUSINESS_LADDER, BUSINESS_TIER_NAME, asBusinessTier } from "./business-ladder";
import { BUSINESS_RUNGS } from "./business-queries";
import { SELF_REVIEW_REFUSAL, decisionRefusal, isOwnBusiness } from "./business-decision";
import { adminRefusal, requireAdmin } from "./guard";
import { writeInAppNotice } from "../notify/in-app";
import { nightsToOpen } from "../stays/inventory";
import { lagosToday } from "../bookings/schema";
import { HOST_AGREEMENT_VERSION } from "../legal/versions";
import { readHostAgreementVersion } from "../host/agreement";

type ListingStatus = Database["public"]["Enums"]["listing_status"];

const SERVICE_DOWN =
  "That decision could not be recorded just now. Nothing was changed. Please try again.";
const GONE = "That application is no longer there. Refresh the queue to see the current state.";

/** The shortest note that can actually be answered. See the header. */
const MIN_NOTE = 12;
const MAX_NOTE = 400;

const noteSchema = z
  .string()
  .trim()
  .min(MIN_NOTE, "Say what is wrong, in a sentence the host can answer.")
  .max(MAX_NOTE, `Keep the note under ${MAX_NOTE} characters.`);

const businessIdSchema = z.object({
  businessId: z.uuid("That application could not be identified."),
});

const withNoteSchema = businessIdSchema.extend({ note: noteSchema });

const rungSchema = businessIdSchema.extend({
  rung: z.enum(BUSINESS_RUNGS, { message: "Pick one of the four checks." }),
  status: z.enum(["passed", "failed"], { message: "Say whether it passed or failed." }),
  note: z.string().trim().max(MAX_NOTE).optional().or(z.literal("")),
});

type BusinessRow = {
  id: string;
  name: string;
  status: ListingStatus;
  owner_id: string | null;
  source: Database["public"]["Enums"]["source_kind"];
};

/* What a decision that changed nothing says: somebody else decided it, or the
   host sent it again, between the reviewer opening the card and pressing. */
const MOVED =
  "This application changed while it was open. Nothing was changed; refresh the queue to see where it stands now.";

function refreshConsole(): void {
  revalidatePath("/admin/businesses");
  revalidatePath("/admin");
}

/** Tell the owner, and write the line. Both best effort, both after the fact. */
async function announce(
  actorId: string,
  business: BusinessRow,
  /** `href` is where the notification opens; the host page when it is left out. */
  notice: { title: string; body: string; href?: string } | null,
  audit: { action: string; detail: AuditDetail },
): Promise<void> {
  try {
    const admin = createAdminClient();
    if (notice && business.owner_id) {
      await writeInAppNotice(admin, {
        user_id: business.owner_id,
        kind: "listing",
        title: notice.title,
        body: notice.body,
        href: notice.href ?? "/host",
      });
    }
    await writeAudit(admin, {
      actorId,
      action: audit.action,
      entityType: "business",
      entityId: business.id,
      detail: audit.detail,
    });
  } catch {
    // The decision has committed. The follow-on work is best effort.
  }
}

/**
 * Whether the business's host agreed to the current Terms, Privacy policy and
 * Host Agreement (founder decision B). Nothing is published for a host who has
 * not. Read through the definer that serves staff the private columns.
 */
async function hostAgreed(
  supabase: Parameters<typeof withBusinessPrivate>[0],
  businessId: string,
): Promise<boolean | null> {
  try {
    const [row] = await withBusinessPrivate(supabase, [{ id: businessId }], ["consents"] as const);
    return readHostAgreementVersion(row?.consents ?? null) === HOST_AGREEMENT_VERSION;
  } catch {
    return null;
  }
}

const NOT_AGREED =
  "This host has not agreed to the current Terms, Privacy policy and Host Agreement, so nothing of theirs can be published. They agree on the business screen of their application.";

/* ---------------------------------------------------------------- decisions */

async function decide(
  input: unknown,
  decision: "approve" | "more_info" | "reject",
  schema: typeof businessIdSchema | typeof withNoteSchema,
): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(schema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const businessId = parsed.data.businessId;
  const note = "note" in parsed.data ? parsed.data.note : null;

  const { data: business, error: readError } = await access.supabase
    .from("businesses")
    .select("id, name, kind, status, owner_id, source")
    .eq("id", businessId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!business) return fail(GONE);

  if (isOwnBusiness(business.owner_id, access.user.id)) return fail(SELF_REVIEW_REFUSAL);
  const refusal = decisionRefusal(business.status, decision);
  if (refusal) return fail(refusal);

  const nextStatus: ListingStatus =
    decision === "approve" ? "APPROVED" : decision === "reject" ? "REJECTED" : "MORE_INFO_REQUIRED";

  /* ON THE STATUS JUST READ, and counted. Without the second `eq` a reviewer
     deciding a card that another reviewer (or the host, resubmitting) had
     moved since it was drawn wrote over that decision, and the owner was
     told about a decision that no longer described their business. */
  const now = new Date().toISOString();
  const { error: updateError, count } = await access.supabase
    .from("businesses")
    .update(
      {
        status: nextStatus,
        reviewer_id: access.user.id,
        reviewed_at: now,
        review_notes: note,
      },
      { count: "exact" },
    )
    .eq("id", business.id)
    .eq("status", business.status);
  if (updateError) return fail(SERVICE_DOWN);
  if (count === 0) return fail(MOVED);

  /* What happens next differs by spine, so the approval says it. A
     restaurant goes on the shelf from this desk; a stay goes on from its
     property, which also needs the host's charges at the door (V-57) before
     it can be published. This used to tell every host, restaurants included,
     to "add or finish a property". */
  const notice =
    decision === "approve"
      ? business.kind === "restaurant"
        ? {
            title: "Your business is approved",
            body: `${business.name} passed review. We put it in front of guests next, and tell you when it is live.`,
          }
        : {
            title: "Your business is approved",
            body: `${business.name} passed review. Before it goes live, answer the charges at the door if you have not already, and we tell you when guests can find it.`,
            href: `/host/arrival?business=${business.id}`,
          }
      : decision === "reject"
        ? {
            title: "Your application was not approved",
            body: note ?? `${business.name} did not pass review. Open it to read the note.`,
          }
        : {
            title: "We need something more",
            body: note ?? `${business.name} needs a change before it can go live.`,
            /* Straight to where it is answered: the application now prints the
               reviewer's note at the top of every step. */
            href: "/host/apply",
          };

  await announce(access.user.id, business as BusinessRow, notice, {
    action: "business.review",
    detail: {
      before_status: business.status,
      after_status: nextStatus,
      decision,
      name: business.name,
      note,
    },
  });

  refreshConsole();
  return ok(null);
}

/** SUBMITTED or UNDER_REVIEW to APPROVED. No note needed to say yes. */
export async function approveBusiness(input: { businessId: string }): Promise<ActionResult<null>> {
  return decide(input, "approve", businessIdSchema);
}

/** Send it back with the reviewer's words, which the host is shown verbatim. */
export async function requestMoreInfo(input: {
  businessId: string;
  note: string;
}): Promise<ActionResult<null>> {
  return decide(input, "more_info", withNoteSchema);
}

/** Refuse it, with a reason. A refusal with no reason is the cruel failure. */
export async function rejectBusiness(input: {
  businessId: string;
  note: string;
}): Promise<ActionResult<null>> {
  return decide(input, "reject", withNoteSchema);
}

/* ------------------------------------------------------------ the shelf gate */

const publishSchema = z.object({
  accommodationId: z.uuid("That property could not be identified."),
});

const PUBLISH_READ =
  "id, name, status, latitude, longitude, business_id, accommodation_photos(id), room_types(id, status, units_total, rate_plans(id, active)), businesses(id, name, status, owner_id, source)";

/**
 * Put one property on the shelf: APPROVED to PUBLISHED.
 *
 * THE PIN IS REQUIRED AND THAT IS THE WHOLE GATE (MK-55). A stay a guest
 * cannot find on a map is a stay they arrive late to, in a city where "off
 * Admiralty Way" is an address. A cover photo and one bookable room with a
 * rate are checked here too, because a published property with neither is a
 * dead end wearing a price.
 *
 * The parent business must be APPROVED first: publishing a property belonging
 * to an operator nobody has read would put the second gate in front of the
 * first.
 */
export async function publishAccommodation(input: {
  accommodationId: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(publishSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: property, error: readError } = await access.supabase
    .from("accommodations")
    /* The public point is enough to know a pin was placed; it is null exactly
       when the exact one is. */
    .select(withPublicPoint(PUBLISH_READ) as typeof PUBLISH_READ)
    .eq("id", parsed.data.accommodationId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!property || !property.businesses) return fail(GONE);

  const business = property.businesses;
  if (isOwnBusiness(business.owner_id, access.user.id)) return fail(SELF_REVIEW_REFUSAL);
  if (business.status !== "APPROVED" && business.status !== "PUBLISHED") {
    return fail("Approve the business first, then publish its property.");
  }
  if (property.status === "PUBLISHED") {
    return fail("This property is already live. Refresh the queue to see the current state.");
  }
  const agreedHost = await hostAgreed(access.supabase, business.id);
  if (agreedHost === null) return fail(SERVICE_DOWN);
  if (!agreedHost) return fail(NOT_AGREED);
  if (property.latitude === null || property.longitude === null) {
    return fail(
      "This property has no pin on the map, so it cannot be published. Ask the host to place it.",
    );
  }
  if (property.accommodation_photos.length === 0) {
    return fail("This property has no photographs, so there is nothing to show a guest.");
  }
  /* A ROOM IS BOOKABLE WHEN IT CARRIES A RATE PLAN. The same predicate
     decides the gate below and which room types go live with the property,
     because a gate that admits a property on one reading and then publishes
     nothing on another is how a live hotel came to project a null price. */
  const bookableRooms = property.room_types.filter((roomType) => roomType.rate_plans.length > 0);
  if (bookableRooms.length === 0) {
    return fail("This property has no room with a rate, so nobody could book it. Ask the host to add a rate to at least one room, then publish again.");
  }
  /* V-57: nothing at the door that is not declared. A property is published
     only once its host has answered all five arrival charges. */
  if (!(await arrivalChargesDeclared(access.supabase, { accommodationId: property.id }))) {
    return fail(ARRIVAL_DECLARATION_NEEDED);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await access.supabase
    .from("accommodations")
    .update({
      status: "PUBLISHED",
      reviewer_id: access.user.id,
      reviewed_at: now,
      published_at: now,
    })
    .eq("id", property.id);
  if (updateError) return fail(SERVICE_DOWN);

  /* ---------------------------------------------------------------------
     THE TWO WRITES WITHOUT WHICH A PUBLISHED HOTEL IS USELESS, and neither
     of them existed anywhere in the application before this.

     ONE: NOTHING EVER PUBLISHED A ROOM TYPE. `addRoomTypeDraft` inserts DRAFT
     and no code path moved it on, while the catalogue projection reads the
     headline price, the maximum sleeps, the room categories, the breakfast
     flag and the free cancellation flag from room types where
     `status = 'PUBLISHED'`. So a hotel that passed every gate appeared on the
     shelf with a null price. A room type that carries a rate plan goes live
     with the property it belongs to, in the same act, because the gate
     directly above has just established that it is bookable and there is no
     second editorial decision to make about it. A room type with no rate plan
     stays DRAFT: it is not bookable, and publishing it would put an
     unsellable room's sleeps into the catalogue.

     TWO: NO APPLICATION CODE EVER WROTE `room_inventory`. `stays_search`
     treats a missing night as NOT OFFERED, so a hotel with no inventory was
     invisible to every dated search. The only rows the table has ever held are
     the B2 seed's ninety nights for the demo stays, which is why the shelf
     answered a dated search and nobody noticed. The nights are opened at the
     host's OWN declared `units_total` and at nothing else; see
     `lib/stays/inventory.ts` for why that is a written-down answer rather than
     an invented number, and for the horizon.

     NEITHER FAILURE UNDOES THE DECISION. The property is published by this
     point. A failure here is recorded in the audit detail and told to the
     admin as the one thing left to do, which is the pattern the business
     publish beneath already follows.
     --------------------------------------------------------------------- */
  const { error: roomsError, count: roomsPublished } = await access.supabase
    .from("room_types")
    .update({ status: "PUBLISHED" }, { count: "exact" })
    .in(
      "id",
      bookableRooms.map((roomType) => roomType.id),
    )
    .neq("status", "PUBLISHED");

  const nights = bookableRooms.flatMap((roomType) =>
    /* From today on the Lagos calendar, not the UTC one (an hour behind). */
    nightsToOpen(roomType.id, roomType.units_total, new Date(`${lagosToday()}T00:00:00Z`)),
  );
  /* `onConflict` on the primary key, ignoring duplicates: a room type being
     republished keeps the nights its host has already adjusted rather than
     having them reset underneath live bookings. */
  const { error: inventoryError } =
    nights.length > 0
      ? await access.supabase
          .from("room_inventory")
          .upsert(nights, { onConflict: "room_type_id,date", ignoreDuplicates: true })
      : { error: null };

  // The business goes live with its first published property, so a host does
  // not have to be told to do a second thing they cannot do. The property is
  // already published by this point, so a failure here is not a failure of
  // the decision: it is written into the audit line and the admin is told the one thing left to do.
  let businessPublished: boolean | null = null;
  if (business.status === "APPROVED") {
    const { error: businessError } = await access.supabase
      .from("businesses")
      .update({ status: "PUBLISHED", published_at: now })
      .eq("id", business.id);
    businessPublished = !businessError;
  }

  await announce(
    access.user.id,
    business as BusinessRow,
    {
      title: "Your property is live",
      body: `${property.name} is now in search and open to guests.`,
    },
    {
      action: "accommodation.publish",
      detail: {
        accommodation_id: property.id,
        accommodation_name: property.name,
        business_name: business.name,
        photo_count: property.accommodation_photos.length,
        business_published: businessPublished,
        /* What went live beside the property, so a null price on the shelf
           can be traced to the act that should have prevented it. */
        room_types_published: roomsError ? null : (roomsPublished ?? 0),
        inventory_nights_opened: inventoryError ? null : nights.length,
      },
    },
  );

  if (businessPublished === false) {
    refreshConsole();
    revalidatePath("/stays");
    return fail(
      "The property is published, but the business could not be marked live at the same time. Open the business and publish it from there.",
    );
  }

  /* Said in the order a reviewer can act on: a property with no published
     room shows no price at all, which is worse than one that shows a price
     and cannot be found on a dated search. */
  if (roomsError) {
    refreshConsole();
    revalidatePath("/stays");
    return fail(
      "The property is published, but its rooms could not be put on sale, so it will show no price. Publish it again in a moment.",
    );
  }
  if (inventoryError) {
    refreshConsole();
    revalidatePath("/stays");
    return fail(
      "The property is published and priced, but its nights could not be opened, so a search with dates on it will not find the property. Publish it again in a moment.",
    );
  }

  refreshConsole();
  revalidatePath("/stays");
  return ok(null);
}

/* ------------------------------------------------ the shelf gate, part two */

/**
 * Put one RESTAURANT on the shelf: APPROVED to PUBLISHED.
 *
 * WHY THIS EXISTS AT ALL. `publishAccommodation` above is the only code path
 * in the product that has ever written PUBLISHED on a business, and every one
 * of its four gates is about a property: an `accommodations` row, a pin, a
 * photograph and a room type with a rate. A restaurant has none of those and
 * never will, so a venue could be put in front of guests only by somebody
 * writing SQL by hand, which is what happened to the first first-party venue
 * (ledger 12.5) and is not a process.
 *
 * THE GATE, AND THE REASONING FOR EVERY LINE OF IT. The rule cannot be
 * borrowed from the stays side, so it is derived from two places: what
 * `private.reservation_is_valid` refuses a table for, and what the venue's own
 * page has to be able to read to be a real place rather than a stub.
 *
 *   A SERVICE WINDOW WITH COVERS ABOVE ZERO. This is the hard one. The
 *   database works out whether a venue can take a booking entirely from
 *   `service_windows`; with none, EVERY request is refused with "that
 *   restaurant does not seat guests at that time", and the owner sits for a
 *   fortnight watching a page that looks perfectly fine take no bookings.
 *   Publishing a venue that cannot accept a single table is publishing a dead
 *   end, which is the same fault the room-with-a-rate gate prevents next door.
 *
 *   A CITY AND A STATE. `listRestaurants` filters by state and city and
 *   `catalogue_entries` files the venue under them, so a venue with neither is
 *   unreachable from every shelf in the product. It would be live and
 *   invisible, which is worse than not being live, because nobody would go
 *   looking for the reason.
 *
 *   A PHONE NUMBER THAT SOMEBODY ANSWERS. A reservation is a request a venue
 *   answers in its own time and the platform holds nothing. When the app is
 *   not enough - a guest is late, a party has grown - the phone is the only
 *   remaining route, and it is the one thing the onboarding script marks
 *   REQUIRED for exactly this reason.
 *
 *   FIRST PARTY, NOT AN EXAMPLE, AND ACTUALLY A RESTAURANT. These three are
 *   not judgement calls: they are the conditions `private.reservation_is_valid`
 *   itself imposes, so a venue published without them is a page whose only
 *   control refuses every use. Checking them here means the refusal is a
 *   sentence a reviewer can act on rather than a trigger exception nobody sees.
 *
 * WHAT IS DELIBERATELY NOT A GATE.
 *
 *   PHOTOGRAPHS. The stays gate requires one because a stay with no
 *   photographs is a dead end wearing a price. A restaurant page is not that:
 *   it draws a Vallo category plate under a plain "No photographs yet" chip,
 *   so a guest is never shown a stock picture as if it were this dining room,
 *   and a table costs nobody anything. The onboarding script promises an owner
 *   they can go live the day they sign and send their photographs during the
 *   week; making a photograph a gate would make that promise false. The desk
 *   says what is missing instead of refusing.
 *
 *   THE PIN. Same argument, and `search_catalogue` admits a row with a null
 *   location inside a radius filter: a missing pin costs distance sorting and
 *   the map, not visibility. The stays gate (MK-55) is about somebody arriving
 *   at a building at night with a suitcase; a diner choosing a restaurant has
 *   the address, the area and the phone.
 *
 *   A RUNG, OR A BADGE. Nothing on this path reads or writes the verification
 *   ladder. Publishing is a decision about inventory and the ladder is a
 *   decision about a person, and tying the two together is how a venue ends up
 *   wearing a mark no human check earned.
 *
 * The business must be APPROVED first, for the same reason the stays gate
 * insists on it: putting the second gate in front of the first would publish
 * an operator nobody has read.
 */
export async function publishRestaurant(input: {
  businessId: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(businessIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { data: publicRow, error: readError } = await access.supabase
    .from("businesses")
    .select("id, name, kind, status, owner_id, source, is_demo, city, state_code, service_windows(covers)")
    .eq("id", parsed.data.businessId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!publicRow) return fail(GONE);
  /* The venue's phone is a private column, read through the definer (staff
     pass it). */
  const [business] = await withBusinessPrivate(access.supabase, [publicRow], ["phone"] as const).catch(() => [null]);
  if (!business) return fail(SERVICE_DOWN);

  if (isOwnBusiness(business.owner_id, access.user.id)) return fail(SELF_REVIEW_REFUSAL);
  if (business.kind !== "restaurant") {
    return fail(
      "This is not a restaurant. A stay goes live from its property, which carries the pin and the rooms.",
    );
  }
  if (business.status === "PUBLISHED") {
    return fail("This venue is already live. Refresh the queue to see the current state.");
  }
  if (business.status !== "APPROVED") {
    return fail("Approve the application first, then put the venue on the shelf.");
  }
  if (business.source !== "first_party") {
    return fail(
      "Only a first-party venue is published from here. Partner inventory is labelled where it is shown and never dressed as ours.",
    );
  }
  if (business.is_demo) {
    return fail("This venue is an example, so it cannot take a table and must not go on the shelf.");
  }
  if (!business.city || !business.state_code) {
    return fail(
      "This venue has no city and state on record, so no shelf in the product could show it. Add them and try again.",
    );
  }
  if (!business.phone) {
    return fail(
      "This venue has no phone number, so a guest who needs the restaurant itself has no way to reach it. Add one and try again.",
    );
  }
  const agreedHost = await hostAgreed(access.supabase, business.id);
  if (agreedHost === null) return fail(SERVICE_DOWN);
  if (!agreedHost) return fail(NOT_AGREED);
  const seats = business.service_windows.filter((window) => window.covers > 0).length;
  if (seats === 0) {
    return fail(
      "This venue has no service with covers above zero, so every request for a table would be refused. Add the hours and the guest number first.",
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await access.supabase
    .from("businesses")
    .update({ status: "PUBLISHED", published_at: now })
    .eq("id", business.id)
    .eq("status", "APPROVED");
  if (updateError) return fail(SERVICE_DOWN);

  await announce(
    access.user.id,
    business as BusinessRow,
    {
      title: "Your venue is live",
      body: `${business.name} is now in search and open for tables. You answer each request yourself, and nothing is held for a guest until you do.`,
    },
    {
      action: "business.publish",
      detail: {
        name: business.name,
        kind: business.kind,
        service_windows: seats,
        city: business.city,
        state_code: business.state_code,
      },
    },
  );

  refreshConsole();
  revalidatePath("/restaurants");
  return ok(null);
}

/* -------------------------------------------------------------- the rungs */

/**
 * Record one rung on a business's ladder.
 *
 * One rung, one decision, one row, and the tier is read back rather than
 * predicted: the trigger owns the number, and a separate statement is the
 * only way to see what it actually wrote, because every subquery in one
 * statement shares a snapshot taken before it ran.
 *
 * A failed rung must say why. It can drop a business's tier in public, and a
 * host who is told their registration check failed with no reason cannot
 * answer it.
 */
export async function recordBusinessRung(input: {
  businessId: string;
  rung: (typeof BUSINESS_RUNGS)[number];
  status: "passed" | "failed";
  note?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(rungSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { businessId, rung, status } = parsed.data;
  const note = parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null;

  if (status === "failed" && (note === null || note.length < MIN_NOTE)) {
    return fail("Say what did not check out.", {
      note: "A failed check has to carry a reason the host can answer.",
    });
  }

  const { data: publicRow, error: readError } = await access.supabase
    .from("businesses")
    .select("id, name, status, owner_id, source")
    .eq("id", businessId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!publicRow) return fail(GONE);
  const [business] = await withBusinessPrivate(access.supabase, [publicRow], ["verification_tier"] as const).catch(
    () => [null],
  );
  if (!business) return fail(SERVICE_DOWN);
  /* The identity rung is the verified mark, so passing your own is lighting
     your own badge. Failing your own is refused too: it is still a decision
     about a business you own. */
  if (isOwnBusiness(business.owner_id, access.user.id)) return fail(SELF_REVIEW_REFUSAL);
  if (business.source !== "first_party") {
    return fail("Only a first-party business carries a verification ladder, so this one has no tier to set. Nothing was changed.");
  }

  const before = business.verification_tier ?? 0;

  /*
   * THE IDENTITY RUNG IS THE BADGE, SO THE SERVER ASKS FOR THE EVIDENCE TOO.
   *
   * `businesses.verified` is derived by trigger from this one rung and nothing
   * else, so a passed identity rung is the only thing in the product that can
   * produce a verified mark. The desk already refuses to offer the control
   * while no identity document is on file, and until now that refusal lived
   * ONLY in the browser: the action itself would have recorded the rung, and a
   * badge no human check earned is exactly what rule 12 exists to prevent.
   * The screen and the server now say the same thing, in the same words.
   *
   * It gates `passed` only. A FAILED identity check with nothing uploaded is a
   * true and useful record: it is how a reviewer says the document never came.
   */
  if (rung === "identity" && status === "passed") {
    const { data: papers, error: papersError } = await access.supabase
      .from("business_documents")
      .select("id")
      .eq("business_id", business.id)
      .eq("kind", "identity")
      .limit(1);
    if (papersError) return fail(SERVICE_DOWN);
    if ((papers ?? []).length === 0) {
      return fail(
        "No identity document is on file, so there is nothing to check a person against. This rung is what the verified mark is derived from, and it cannot be recorded on nothing.",
      );
    }
  }

  const { error: writeError } = await access.supabase
    .from("business_verification_checks")
    .upsert(
      {
        business_id: business.id,
        rung,
        status,
        note,
        reviewer_id: access.user.id,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "business_id,rung" },
    );
  if (writeError) return fail(SERVICE_DOWN);

  const { data: afterPublic } = await access.supabase
    .from("businesses")
    .select("id, verified")
    .eq("id", business.id)
    .maybeSingle();
  const [after] = afterPublic
    ? await withBusinessPrivate(access.supabase, [afterPublic], ["verification_tier"] as const).catch(() => [null])
    : [null];
  const now = after?.verification_tier ?? before;

  /*
   * THE OWNER HEARS ABOUT EVERY DECISION, not only a change of level. A
   * passed rung that leaves the tier where it was (a registration check
   * recorded before identity) is still a decision about their business that
   * somebody took, and a failed one always carries the reviewer's words. The
   * tier name is the ladder's own, so the notification and the status page
   * say the same thing.
   */
  const label = BUSINESS_LADDER[rung].label;
  const tierName = BUSINESS_TIER_NAME[asBusinessTier(now)];
  const notice =
    status === "passed"
      ? {
          title: now > before ? "Your verification level has gone up" : `${label} check passed`,
          body:
            now > before
              ? `The ${label.toLowerCase()} check passed. Your business is now ${tierName.toLowerCase()}, and guests can see how far it has been checked.`
              : `The ${label.toLowerCase()} check passed. Your level stays ${tierName.toLowerCase()} until the checks below it pass too.`,
        }
      : {
          title: `${label} check did not pass`,
          body: `${note ?? ""} Your level is now ${tierName.toLowerCase()}. Answer the note from your host page and we will look again.`.trim(),
        };

  await announce(access.user.id, business as BusinessRow, notice, {
    action: "business.verification_check",
    detail: {
      rung,
      status,
      tier_before: before,
      tier_after: now,
      verified: after?.verified ?? false,
      note,
      business_name: business.name,
    },
  });

  refreshConsole();
  return ok(null);
}

/*
 * One action per rung, on the generic recorder, so a desk button and a test
 * can name the rung they mean without passing a string the schema has to
 * check. Each is the research's rung (sections 3.3 and 3.4): identity from
 * the document on file, registration from the free CAC public search (or the
 * address, for an individual host), payout from the resolved bank name
 * beside the identity or business name, on site from a visit or a video call.
 */
type RungDecision = { businessId: string; status: "passed" | "failed"; note?: string };

/** Rung 1: the representative's government ID, seen. */
export async function recordIdentityCheck(input: RungDecision): Promise<ActionResult<null>> {
  return recordBusinessRung({ ...input, rung: "identity" });
}

/** Rung 2: the CAC record matches, or for an individual host the address does. */
export async function recordRegistrationCheck(input: RungDecision): Promise<ActionResult<null>> {
  return recordBusinessRung({ ...input, rung: "registration" });
}

/** Rung 3: the resolved bank account name matches the person or the business. */
export async function recordPayoutCheck(input: RungDecision): Promise<ActionResult<null>> {
  return recordBusinessRung({ ...input, rung: "payout" });
}

/** Rung 4: somebody from Vallo has stood in the property or seen it live. */
export async function recordOnSiteCheck(input: RungDecision): Promise<ActionResult<null>> {
  return recordBusinessRung({ ...input, rung: "on_site" });
}
