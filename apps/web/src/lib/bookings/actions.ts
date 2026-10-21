"use server";

/**
 * The bookings loop: reserve, cancel, confirm.
 *
 * Reserve inserts under the guest's own RLS-bound client, so the database is
 * the authority on identity and on double booking: the GiST exclusion
 * constraint on overlapping PENDING and CONFIRMED stays raises SQLSTATE 23P01,
 * which is translated into one friendly sentence and never surfaced raw.
 * Cancel proves ownership through an RLS read first, then performs the state
 * transition through the service role, because guests hold no UPDATE grant on
 * bookings by design. Confirm is the service path a host or admin surface will
 * call; it carries its own authorisation check because every export of this
 * file is a callable endpoint. Notification fan-out happens in database
 * triggers on insert and status change: nothing here writes notifications.
 *
 * All money is integer kobo. Price snapshots come from the listing row at the
 * moment of booking, never from the client.
 *
 * Email is layered on top of that, never inside it. Every send happens after
 * the database write has committed, runs through bestEffortEmail (which does
 * nothing at all without RESEND_API_KEY and swallows every failure), and can
 * therefore never turn a saved booking into an error the guest sees.
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stayTitle } from "./stay-title";
import { readInstantOutcome } from "./instant-pay";
import { STAYS_INSTANT_PAY_FLAG, flagIsOn } from "../flags/read";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import { bestEffortEmail, sendMessage } from "../email/client";
import {
  bookingCancelled,
  bookingRequested,
  bookingRequestedHost,
  type ArrivingGuest,
} from "../email/messages";
import { adminOrNull, contactForAgent, contactForSelf } from "../email/recipients";
import { mailLanguageFor } from "../email/mail-language";
import { announceConfirmedStay } from "./arrival";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import { isFeatureEnabled } from "../flags";
import { phoneGateFor } from "../phone-otp/gate";
import { checkConstraintMessage, NOT_LIVE_MESSAGE } from "./reserve-refusals";
import { getListingRepository } from "../listings/repository";
import { createAdminClient } from "../supabase/admin";
import { actsAsProvedAdmin } from "../admin/guard";
import {
  cancelInputSchema,
  lagosToday,
  nightsBetween,
  normalisePhone,
  reserveInputSchema,
} from "./schema";
import { releaseBookedNights, writeBookedNights } from "./settlement";
import { countOf } from "@vallo/i18n/core";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAUSED_MESSAGE = "Bookings are paused for maintenance. Please try again in a little while.";

const DATES_TAKEN_MESSAGE = "Those dates were just taken. Pick different dates.";

/*
 * "This stay opens for booking as soon as live inventory lands. Save it and
 * check back soon" promised a date for a property that does not exist. An
 * example listing never opens, and "check back soon" is the banned "coming
 * soon" in other words. See F2-003.
 *
 * One sentence for both kinds of example, because to a guest they are the
 * same thing: a seed catalogue entry that has no database row at all, and a
 * `listings` row carrying `is_demo`. Both are shown in search and neither can
 * ever be stayed in.
 */
const SEED_LISTING_MESSAGE =
  "This is an example listing, so there are no dates to book. Open a real listing from search to book a stay.";

const RENTAL_MESSAGE =
  "This home is rented on a tenancy, not per night. Message the agent to arrange an inspection.";

const SALE_MESSAGE =
  "This property is for sale, not for booking. Message the agent to arrange an inspection.";

const RESTAURANT_MESSAGE =
  "This place takes table reservations rather than overnight stays. Reserve a table from the listing.";

const UNKNOWN_LISTING_MESSAGE =
  "This listing no longer exists. Explore other stays from search.";

const GENERIC_RESERVE_MESSAGE =
  "We could not place this booking just now. Nothing was charged. Please try again.";

const SERVICE_DOWN_MESSAGE =
  "Cancelling is temporarily unavailable. Your booking is unchanged. Please try again shortly.";

const NOT_YOURS_MESSAGE =
  "We could not find that booking on your account. Open it again from Bookings, and check you are signed in with the account that reserved it.";

/** The host-and-admin side of confirm: every refusal ends at the same queue. */
const CONFIRM_DOWN_MESSAGE =
  "Confirming is temporarily unavailable. The request is unchanged. Please try again shortly.";

/** What a successful reserve hands back for the confirmation moment. */
export type ReserveReceipt = {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  subtotalMinor: number;
  cleaningMinor: number;
  totalMinor: number;
  /** The person arriving, when the payer named somebody else. */
  arrivingName: string | null;
  /** D73: the database booked it instantly at the published rate; pay now. */
  instant: boolean;
  /** When an unpaid instant booking stops being held (ISO), else null. */
  payBy: string | null;
};

export async function reserve(
  _prev: ActionResult<ReserveReceipt> | null,
  formData: FormData,
): Promise<ActionResult<ReserveReceipt>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("bookings"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(reserveInputSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const input = parsed.data;

  /* FULL GATE (13 October 2026): the first booking needs a confirmed phone,
     flag on. Asked before anything is read or held. */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "booking");
  if (phoneGate) return phoneGate;

  // ------------------------------------------------- resolve the listing
  // A bookable listing lives in public.listings and carries its own price
  // snapshot columns in kobo. Seed catalogue entries render the page but
  // cannot be written to bookings (the FK points at real listings), so they
  // get an honest refusal rather than a fake booking.
  let priceMinor: number | null = null;
  /* Cleaning and service fees are gone from the schema. They belonged to the
     short-stay model this platform started as; the rent and sale model that
     replaced it has a move-in cost breakdown instead, which is a property of
     the tenancy and not of a night. Kept as named zeros rather than deleted
     because `bookings` still carries both columns and a booking row has to
     state something for them. */
  const cleaningMinor = 0;
  const serviceMinor = 0;
  /* The shortest stay a host accepts is no longer a column. `min_stay_nights`
     went with the short-stay model, so every stay is one night or more, which
     is what the date validation already enforces. */
  const minStayNights = 1;
  /* Capacity is no longer declared per listing either: `max_guests` went with
     the same model. Null means "this source declares no capacity", which is
     exactly how the seed catalogue has always behaved, so the party-size check
     below is skipped rather than guessing a ceiling nobody stated. */
  const maxGuests: number | null = null;
  // Read for the emails sent once the booking has saved, nothing else.
  let listingTitle = "your stay";
  let listingAgentId: string | null = null;

  if (UUID_RE.test(input.listingId)) {
    const { data: row, error } = await session.supabase
      .from("listings")
      .select(
        "id, title, agent_id, listing_intent, rate_minor, rate_period, rent_amount_minor, is_demo, status",
      )
      .eq("id", input.listingId)
      .maybeSingle();
    if (error) return fail(GENERIC_RESERVE_MESSAGE);
    if (row) {
      /* Four refusals, in the order somebody would meet them.

         An example is refused first, because it is the only one of the four
         that is never the guest's to fix and never becomes bookable: the
         trigger `bookings_never_against_a_demo_listing` refuses the insert
         underneath and always will, so this is purely the sentence, and
         without it the guest was told "something went wrong on our side"
         about a property that was never real.

         A property for sale is not reservable at all: there are no nights to
         hold and no arrival date to hold them for. A tenancy is not reservable
         either, and that refusal has always existed here; what changed is how
         it is detected. `price_period = 'year'` used to say it. Now the honest
         test is whether the listing carries a nightly rate at all: a tenancy
         states rent_amount_minor and leaves rate_minor at zero, and a shortlet
         does the reverse. */
      if (row.is_demo) return fail(SEED_LISTING_MESSAGE);
      if (row.listing_intent === "sale") return fail(SALE_MESSAGE);
      if (row.rate_minor <= 0 || row.rate_period === null) return fail(RENTAL_MESSAGE);
      /* Per head, not per night. A restaurant table is reserved through
         `reservations`, which is its own path with its own row shape, and
         multiplying a head price by a number of nights would invoice somebody
         for a week of dinners they never ordered. */
      if (row.rate_period === "guest") return fail(RESTAURANT_MESSAGE);
      /* ESC-02: the database refuses a stay on a listing that is not live, so
         say it before the insert rather than after it. */
      if (row.status !== "PUBLISHED") return fail(NOT_LIVE_MESSAGE);
      priceMinor = row.rate_minor;
      listingTitle = row.title;
      listingAgentId = row.agent_id;
    }
  }

  if (priceMinor === null) {
    const seed = await getListingRepository().byId(input.listingId);
    if (!seed) return fail(UNKNOWN_LISTING_MESSAGE);
    if (seed.kind === "rental") return fail(RENTAL_MESSAGE);
    return fail(SEED_LISTING_MESSAGE);
  }

  // ------------------------------------------------------ integer money
  const nights = nightsBetween(input.checkIn, input.checkOut);

  /* The host's minimum stay. listings.min_stay_nights has existed with a > 0
     check constraint since listings_core and was read by nothing, so a guest
     could book one night at a three-night property and the host only found out
     when they came to accept it. Name the number, because "those dates do not
     work" leaves the guest guessing which way to move. */
  if (nights < minStayNights) {
    const minimum = countOf(minStayNights, "nights");
    return fail(
      `This place takes bookings of ${minimum} or more. Add ${countOf(minStayNights - nights, "moreNights")} and you are set.`,
      { checkOut: `Minimum stay is ${minimum}.` },
    );
  }

  /* The host's capacity. listings.max_guests is collected at step 5 of the
     listing wizard and was read by nothing on this path, so a party of eight
     could book a two-guest studio and the agent discovered it at the gate.
     Name the number, the same way the minimum stay does, because "those
     guests do not work" leaves the guest guessing which way to move. */
  const party = input.adults + input.children;
  if (maxGuests !== null && party > maxGuests) {
    const capacity = countOf(maxGuests, "guests");
    return fail(
      `This place takes up to ${capacity}, and you have asked for ${party}. Lower the party size, or find a bigger place from search.`,
      { adults: `Up to ${capacity} in total.` },
    );
  }

  const subtotalMinor = priceMinor * nights;
  const totalMinor = subtotalMinor + cleaningMinor + serviceMinor;

  /* ---------------------------------------------- the person arriving
     The payer is often not the guest: a sister in London pays for a cousin
     flying into Lagos. The schema validated the pair already, so by here it is
     either a complete third party or nobody at all. The number is normalised
     to one canonical +234 form, which is also the only shape the check
     constraint on the table accepts. */
  const arrivingName = (input.guestName ?? "").trim();
  const arrivingPhone = normalisePhone((input.guestPhone ?? "").trim());
  const arrivingEmail = (input.guestEmail ?? "").trim().toLowerCase();
  const arriving: ArrivingGuest | null =
    arrivingName.length > 0 && arrivingPhone !== null
      ? { name: arrivingName, phone: arrivingPhone }
      : null;

  // ------------------------------------------------- insert under RLS
  const { data: created, error: insertError } = await session.supabase
    .from("bookings")
    .insert({
      listing_id: input.listingId,
      guest_id: session.user.id,
      check_in: input.checkIn,
      check_out: input.checkOut,
      nights,
      adults: input.adults,
      children: input.children,
      price_per_night_minor: priceMinor,
      cleaning_fee_minor: cleaningMinor,
      service_fee_minor: serviceMinor,
      subtotal_minor: subtotalMinor,
      total_minor: totalMinor,
      status: "PENDING",
      guest_name: arriving?.name ?? null,
      guest_phone: arriving?.phone ?? null,
      guest_email: arriving && arrivingEmail.length > 0 ? arrivingEmail : null,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    if (insertError?.code === "23P01") return fail(DATES_TAKEN_MESSAGE);
    if (insertError?.code === "23503") return fail(UNKNOWN_LISTING_MESSAGE);
    /* The demo trigger raises 23514 with its own words. It is read before
       checkConstraintMessage, which speaks only for the eleven CHECK
       constraints on the table and would otherwise blame our arithmetic for a
       listing that is an example. */
    if (insertError?.code === "23514" && /example/i.test(insertError.message)) {
      return fail(SEED_LISTING_MESSAGE);
    }
    if (insertError?.code === "23514") return fail(checkConstraintMessage(insertError.message));
    /* Probed against live Postgres: a check_out on or before check_in raises
       22000 from the `during` daterange generated column before
       bookings_dates_chk is ever evaluated, so this, not 23514, is the code
       reversed dates actually produce. The input schema catches it first in
       normal use; this is the honest answer if anything ever slips past. */
    if (insertError?.code === "22000") {
      return fail("Check-out has to be after check-in. Pick the dates again.", {
        checkOut: "Check-out has to be after check-in.",
      });
    }
    return fail(GENERIC_RESERVE_MESSAGE);
  }

  // ------------------------------------------------- hold the calendar
  // A PENDING booking is already a real hold: the GiST exclusion constraint
  // refuses a second overlapping stay. The calendar has to say so straight
  // away, or a second guest sees the nights open, fills in the whole form and
  // only then meets the database refusal. Written through the service role
  // because guests hold no write grant on availability, and best effort
  // because the constraint, not this write, is what actually prevents the
  // double booking: a lost calendar row is a cosmetic gap, not an oversell.
  try {
    await writeBookedNights(
      createAdminClient(),
      input.listingId,
      input.checkIn,
      input.checkOut,
    );
  } catch {
    // The hold stands on the database constraint regardless.
  }

  revalidatePath("/bookings");
  revalidatePath(`/listing/${input.listingId}`);

  /* D73: with stays_instant_pay on the database may have accepted the stay
     already (published nightly rate, host ready to be paid). Read only with
     the switch on, so with it off nothing here changes. */
  const outcome = (await flagIsOn(STAYS_INSTANT_PAY_FLAG))
    ? await readInstantOutcome(session.supabase, created.id)
    : { instant: false, payBy: null };

  // ------------------------------------------------------------- email
  // The booking exists. Both sends are best effort from here: the guest gets
  // their request back in writing, the host gets something to act on.
  /* An instant booking is not a request: the "request sent" and "new
     request" emails would be wrong. The database's in-app notices tell both
     sides, and the payment receipt follows settlement as for every stay. */
  if (!outcome.instant) await bestEffortEmail(async () => {
    // "Bookings" on /settings governs this. A guest who switched it off
    // resolves to no recipient at all, so nothing is rendered and nothing is
    // sent; the booking itself is untouched either way.
    const guest = await contactForSelf(session.supabase, session.user, "bookings");
    const stay = {
      listingTitle,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights,
      adults: input.adults,
      children: input.children,
      totalMinor,
      arriving,
    };

    const jobs: Promise<unknown>[] = [];

    if (guest) {
      const message = bookingRequested({ guestName: guest.name, ...stay });
      jobs.push(sendMessage(guest.email, message));
    }

    // The host's address needs the service role. Without it, their email is
    // skipped quietly and the guest's still goes.
    const admin = adminOrNull();
    if (admin && listingAgentId) {
      const host = await contactForAgent(admin, listingAgentId, "bookings");
      if (host) {
        const message = bookingRequestedHost({
          agentName: host.name,
          guestName: guest?.name ?? null,
          ...stay,
        });
        jobs.push(sendMessage(host.email, message));
      }
    }

    await Promise.allSettled(jobs);
  });

  return ok({
    bookingId: created.id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    adults: input.adults,
    children: input.children,
    subtotalMinor,
    cleaningMinor,
    totalMinor,
    arrivingName: arriving?.name ?? null,
    ...outcome,
  });
}

export async function cancel(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("bookings"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(cancelInputSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  // Ownership is proven by reading through the caller's own RLS client AND
  // as the guest. RLS alone also shows the booking to its host and to admins,
  // and the cancel below is service-role work, so without the guest filter a
  // host could cancel through the guest's path (SEC-17).
  const { data: booking, error: readError } = await session.supabase
    .from("bookings")
    .select("id, listing_id, accommodation_id, status, check_in, check_out")
    .eq("id", parsed.data.bookingId)
    .eq("guest_id", session.user.id)
    .maybeSingle();

  if (readError) return fail(SERVICE_DOWN_MESSAGE);
  if (!booking) return fail(NOT_YOURS_MESSAGE);
  // The guest only reached this by tapping Cancel on a row that still looked
  // live, so the page in front of them is out of date. Saying so is the action.
  if (booking.status === "CANCELLED") {
    return fail("This booking is already cancelled. Reload the page to see where it stands.");
  }
  if (booking.check_in <= lagosToday()) {
    return fail("This stay has already started, so it cannot be cancelled here. Contact support and we will sort it out.");
  }

  // A stay that has been paid for is not cancelled by this path, and that is
  // now a policy decision rather than a missing feature. /cancellations says in
  // plain words that once money has moved a cancellation is handled by a person
  // rather than by a button, because a refund is somebody's money and it
  // deserves a name against the decision. That person's surface exists:
  // app/admin/bookings, which prices the refund from the cancellation terms
  // frozen on this booking and sends it back to the card that paid, inside
  // one transaction (lib/admin/bookings-actions.ts). So the refusal below is
  // honest, and the sentence it hands the guest is one the platform can now
  // actually keep. Read through the guest's own client, so it can only ever
  // see their own payments.
  const { data: settled } = await session.supabase
    .from("transactions")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("status", "SUCCESSFUL")
    .limit(1);
  if ((settled?.length ?? 0) > 0) {
    return fail(
      "This stay has already been paid for, so it cannot be cancelled here. Contact support and we will sort out your money with you.",
    );
  }
  /* Ruling 2 (13 October 2026): a shortlet stay may be paid into escrow. Money
     the partner holds is not unwound by a plain cancel (the database refuses
     it, `bookings_00_partner_hold_keeps_the_stay`), so the guest is told what to do
     instead of reading a failed save. Read under the guest's own RLS. */
  const { data: heldAgreements } = await session.supabase
    .from("deal_agreements")
    .select("id")
    .eq("booking_id", booking.id)
    .limit(1);
  const heldAgreementId = (heldAgreements as { id: string }[] | null)?.[0]?.id ?? null;
  if (heldAgreementId) {
    const { data: held } = await (session.supabase as unknown as SupabaseClient)
      .from("provider_arrangements")
      .select("id, status")
      .eq("agreement_id", heldAgreementId)
      .in("status", ["preparing", "unknown", "payment_processing", "protected", "release_requested", "released", "disputed", "split"])
      .limit(1);
    const heldStatus = (held as { status: string }[] | null)?.[0]?.status ?? null;
    /* The database refuses the same (pov05, `bookings_00_partner_hold_keeps_the_stay`):
       a stay is never cancelled while the partner may be taking its money. */
    if (heldStatus === "preparing" || heldStatus === "unknown" || heldStatus === "payment_processing") {
      return fail(
        "Your escrow payment is still being confirmed by the payment partner, so this stay cannot be cancelled yet. Nothing is charged twice; check back in a few minutes.",
      );
    }
    if (heldStatus !== null) {
      return fail(
        "This stay is paid into escrow, so it cannot be cancelled here. Open the agreement to see where your money is held, or contact support and we will sort it out with you.",
      );
    }
  }

  // The transition itself is service-role work: guests hold no UPDATE grant.
  try {
    const admin = createAdminClient();

    const { error: updateError } = await admin
      .from("bookings")
      .update({ status: "CANCELLED" })
      .eq("id", booking.id)
      .in("status", ["PENDING", "CONFIRMED"]);
    if (updateError) return fail(SERVICE_DOWN_MESSAGE);

    // History and calendar cleanup are best effort once the transition has
    // committed: the booking is genuinely cancelled either way, and the
    // notification trigger has already fired on the status change.
    await admin.from("booking_state_events").insert({
      booking_id: booking.id,
      from_status: booking.status,
      to_status: "CANCELLED",
      actor_id: session.user.id,
    });
    await releaseBookedNights(
      admin,
      booking.listing_id,
      booking.check_in,
      booking.check_out,
    );
  } catch {
    return fail(SERVICE_DOWN_MESSAGE);
  }

  // The cancellation has committed. Telling the guest is best effort.
  await bestEffortEmail(async () => {
    const guest = await contactForSelf(session.supabase, session.user, "bookings");
    if (!guest) return;
    const message = bookingCancelled({
      ...(await mailLanguageFor(session.supabase, session.user.id)),
      guestName: guest.name,
      listingTitle: booking.listing_id
        ? await listingTitleFor(booking.listing_id)
        : await stayTitle(session.supabase, booking),
      checkIn: booking.check_in,
      checkOut: booking.check_out,
    });
    await sendMessage(guest.email, message);
  });

  revalidatePath("/bookings");
  return ok(null);
}

/**
 * A listing's title for email copy, with a neutral fallback. Read through the
 * service role because the caller may no longer be able to see the row, and
 * never allowed to fail: an email with a plain "your stay" in it is far better
 * than no email.
 */
async function listingTitleFor(listingId: string): Promise<string> {
  const admin = adminOrNull();
  if (!admin) return "your stay";
  try {
    const { data } = await admin
      .from("listings")
      .select("title")
      .eq("id", listingId)
      .maybeSingle();
    const title = (data?.title ?? "").trim();
    return title.length > 0 ? title : "your stay";
  } catch {
    return "your stay";
  }
}

/**
 * Confirm a pending booking: the service path the host and admin surfaces
 * will call. Exported server actions are public endpoints, so this one
 * authorises hard before touching anything: the caller must be signed in and
 * be either the listing's agent or a platform admin. On success the stay's
 * nights are written to availability as booked, and the notification trigger
 * on the status change tells the guest.
 */
export async function confirm(bookingId: string): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (!(await isFeatureEnabled("bookings"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(cancelInputSchema, { bookingId });
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  try {
    const admin = createAdminClient();

    const { data: booking, error: readError } = await admin
      .from("bookings")
      .select("id, listing_id, guest_id, status, check_in, check_out, nights, total_minor")
      .eq("id", parsed.data.bookingId)
      .maybeSingle();
    if (readError) return fail(CONFIRM_DOWN_MESSAGE);
    if (!booking) {
      return fail("That booking no longer exists. Reload the page to see your current requests.");
    }

    // ------------------------------------------------- authorisation
    // listings.agent_id points at public.agents, whose user_id is the auth
    // user, so the ownership check walks that join.
    const [{ data: listing }, provedAdmin] = await Promise.all([
      /* A hotel room has no listing agent (ROOM BOOKINGS 1): its host answers at /host/bookings. */
      booking.listing_id
        ? admin
            .from("listings")
            .select("agent_id, agents!listings_agent_id_fkey!inner(user_id)")
            .eq("id", booking.listing_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      /* An admin override needs the console's key proof, not the role alone. */
      actsAsProvedAdmin(),
    ]);
    const isAgent = listing?.agents?.user_id === session.user.id;
    const isAdmin = provedAdmin;
    if (!isAgent && !isAdmin) {
      return fail(
        "Only the listing's agent or an administrator can confirm a booking. If this listing is yours, sign in with the account that hosts it.",
      );
    }

    if (booking.status === "CONFIRMED") return ok(null);
    if (booking.status !== "PENDING") {
      return fail(
        "This booking was cancelled, so it cannot be confirmed. Reload the page to see your current requests.",
      );
    }

    const { error: updateError } = await admin
      .from("bookings")
      .update({ status: "CONFIRMED" })
      .eq("id", booking.id)
      .eq("status", "PENDING");
    if (updateError) return fail(CONFIRM_DOWN_MESSAGE);

    await admin.from("booking_state_events").insert({
      booking_id: booking.id,
      from_status: "PENDING",
      to_status: "CONFIRMED",
      actor_id: session.user.id,
    });

    // The nights were already closed at reserve; this is the same upsert over
    // rows that already say the same thing, so it is safe either way.
    await writeBookedNights(admin, booking.listing_id, booking.check_in, booking.check_out);

    // The booking is CONFIRMED in the database. Telling the payer, and the
    // person actually arriving when they are somebody else, is best effort:
    // the confirmation stands whether or not either email leaves.
    await announceConfirmedStay(admin, { bookingId: booking.id });
  } catch {
    return fail(CONFIRM_DOWN_MESSAGE);
  }

  revalidatePath("/bookings");
  return ok(null);
}
