import { fitPush, PUSH_TITLE_MAX } from "../push/copy";
import { warmTitle } from "../notify/voice";
import { agreementSubmitted } from "./lifecycle-messages";
import { bookingConfirmed, inspectionScheduled, stayArrivalDetails, type ArrivingGuest } from "./messages";

/**
 * "WHAT EVERYONE GETS": THE CONFIRM PANEL'S PREVIEW OF EVERY MESSAGE AN ACTION
 * SENDS (design spec section 15, reference 35).
 *
 * Before somebody accepts a booking, confirms a viewing or signs an agreement,
 * the confirm panel shows one card per person who will be told, holding the
 * exact words they will receive. Those words come from HERE, and here builds
 * them from the real senders, so the preview cannot drift from what is sent:
 *
 *   EMAIL: the subject and preheader of the real builder in this directory,
 *   called with the same data the send site passes.
 *
 *   PUSH AND IN-APP: the title and body the database trigger writes into
 *   `public.notifications` (quoted function by function below; the database
 *   is the sender and this module cannot call it), held to the lock-screen
 *   limits by the same `fitPush` the push drain applies. When a trigger's
 *   copy changes in a migration, the mirror here changes with it;
 *   `everyone-gets.test.ts` pins both halves.
 *
 * Pure: no Supabase, no environment. Safe to import from a client component.
 */

export type PreviewChannel = "Email + app" | "Email" | "App";

export type RecipientPreview = {
  /** Who this card is for, as the panel labels them. */
  role: "Guest" | "Host" | "Arriving guest" | "Tenant" | "Landlord" | "Viewer" | "Lister" | "Renter" | "Owner";
  /** Their display name, when the panel has one. */
  name: string | null;
  channel: PreviewChannel;
  /** The subject in bold and the preheader line, exactly as sent. Null when no email goes. */
  email: { subject: string; preheader: string } | null;
  /** The lock-screen push and the in-app row, exactly as sent. Null when none goes. */
  push: { title: string; body: string } | null;
};

function card(
  role: RecipientPreview["role"],
  name: string | null | undefined,
  email: { subject: string; preheader: string } | null,
  push: { title: string; body: string } | null,
): RecipientPreview {
  const channel: PreviewChannel = email && push ? "Email + app" : email ? "Email" : "App";
  return {
    role,
    name: name?.trim() || null,
    channel,
    email: email ? { subject: email.subject, preheader: email.preheader } : null,
    push: push ? fitPush({ ...push, title: warmTitle(push.title, PUSH_TITLE_MAX) }) : null,
  };
}

/* ------------------------------------------- Postgres to_char, in Lagos */

const LAGOS = "Africa/Lagos";

function lagos(date: Date, options: Intl.DateTimeFormatOptions): string {
  /* en-US: Postgres writes "Sep", where en-GB now writes "Sept". */
  return new Intl.DateTimeFormat("en-US", { timeZone: LAGOS, ...options }).format(date);
}

/** `to_char(date, 'DD Mon')`: "01 Sep". A date column, so read at midday UTC. */
export function pgDayMon(isoDate: string): string {
  const d = new Date(isoDate.slice(0, 10) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${lagos(d, { day: "2-digit" })} ${lagos(d, { month: "short" })}`;
}

/** `to_char(ts at time zone 'Africa/Lagos', 'FMDay DD FMMon, HH24:MI')`: "Saturday 04 Oct, 15:00". */
export function pgSlot(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return isoTimestamp;
  const time = lagos(d, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${lagos(d, { weekday: "long" })} ${lagos(d, { day: "2-digit" })} ${lagos(d, { month: "short" })}, ${time}`;
}

/** A timestamp as the email builders take it: "YYYY-MM-DD" and "HH:MM", in Lagos. */
function lagosDateTime(isoTimestamp: string): { date: string; time: string } {
  const d = new Date(isoTimestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LAGOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/* ------------------------------------------------------ booking accepted */

export type BookingAcceptedPreviewData = {
  guestName?: string | null;
  listingTitle: string;
  /** "YYYY-MM-DD". */
  checkIn: string;
  checkOut: string;
  nights: number;
  totalMinor: number;
  /** When the stay was booked for somebody else, who is arriving. */
  arriving?: ArrivingGuest | null;
};

/**
 * The host accepts a stay request. The guest is told by email
 * (`bookingConfirmed`, sent from `lib/bookings/arrival.ts`) and in the app
 * (`private.notify_booking_change`, status CONFIRMED); somebody arriving on the
 * guest's behalf gets their own email (`stayArrivalDetails`) and no push, as
 * they have no account.
 */
export function bookingAcceptedPreview(data: BookingAcceptedPreviewData): RecipientPreview[] {
  const email = bookingConfirmed({
    guestName: data.guestName ?? null,
    listingTitle: data.listingTitle,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    nights: data.nights,
    totalMinor: data.totalMinor,
    arriving: data.arriving ?? null,
  });
  const out = [
    card("Guest", data.guestName, email, {
      title: "Booking confirmed",
      body: `${data.listingTitle} is confirmed for ${pgDayMon(data.checkIn)}.`,
    }),
  ];
  if (data.arriving) {
    out.push(
      card(
        "Arriving guest",
        data.arriving.name,
        stayArrivalDetails({
          arrivingName: data.arriving.name,
          bookedByName: data.guestName ?? null,
          listingTitle: data.listingTitle,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          nights: data.nights,
        }),
        null,
      ),
    );
  }
  return out;
}

/* ------------------------------------------------------ payment received */

export type PaymentReceivedPreviewData =
  | {
      /** The move-in total on a tenancy (a rent charge). */
      kind: "rent";
      tenantName?: string | null;
      landlordName?: string | null;
      listingTitle: string;
    }
  | ({
      /** A stay paid at checkout; payment is what confirms it. */
      kind: "stay";
      hostName?: string | null;
    } & BookingAcceptedPreviewData);

/**
 * A payment settles. On a tenancy both sides are told in the app
 * (`private.notify_booking_change`, rent branch, status CONFIRMED) and there
 * is no email for it yet. On a stay the payment confirms the booking, so the
 * guest gets exactly the booking-accepted messages.
 */
export function paymentReceivedPreview(data: PaymentReceivedPreviewData): RecipientPreview[] {
  if (data.kind === "stay") return bookingAcceptedPreview(data);
  const tenant = data.tenantName?.trim() || "The tenant";
  return [
    card("Tenant", data.tenantName, null, {
      title: "Rent paid",
      body: `${data.listingTitle}: the move-in total is paid and recorded to the kobo.`,
    }),
    card("Landlord", data.landlordName, null, {
      title: "Rent received",
      body: `${tenant} has paid the move-in total for ${data.listingTitle}.`,
    }),
  ];
}

/* ----------------------------------------------------- viewing confirmed */

export type ViewingConfirmedPreviewData = {
  viewerName?: string | null;
  listerName?: string | null;
  listingTitle: string;
  /** The listing's address; the title stands in when there is none, as the send site does. */
  address?: string | null;
  /** The agreed slot, an ISO timestamp. */
  slotAt: string;
  /**
   * True when the viewer booked an open slot from a viewing window (both
   * sides told "Viewing booked"); false when the lister confirms a request
   * (the viewer told "Inspection confirmed", the lister being the actor).
   */
  fromWindow?: boolean;
};

/**
 * A viewing is confirmed. Both sides get `inspectionScheduled` by email (the
 * outbox template `inspection.scheduled`, which sends no phone number), and
 * the app rows come from `private.notify_inspection_change`.
 */
export function viewingConfirmedPreview(data: ViewingConfirmedPreviewData): RecipientPreview[] {
  const at = lagosDateTime(data.slotAt);
  const slot = pgSlot(data.slotAt);
  const base = {
    listingTitle: data.listingTitle,
    address: data.address?.trim() || data.listingTitle,
    date: at.date,
    time: at.time,
    otherPartyPhone: null,
  };
  const viewerEmail = inspectionScheduled({ ...base, audience: "viewer", name: data.viewerName ?? null, otherPartyName: data.listerName ?? null });
  const listerEmail = inspectionScheduled({ ...base, audience: "lister", name: data.listerName ?? null, otherPartyName: data.viewerName ?? null });
  const asker = data.viewerName?.trim() || "Somebody";
  return [
    card("Viewer", data.viewerName, viewerEmail, {
      title: data.fromWindow ? "Viewing booked" : "Inspection confirmed",
      body: `${data.listingTitle} on ${slot}. The lister is expecting you.`,
    }),
    card(
      "Lister",
      data.listerName,
      listerEmail,
      data.fromWindow
        ? { title: "Viewing booked", body: `${asker} booked ${slot} to see ${data.listingTitle}.` }
        : null,
    ),
  ];
}

/* ------------------------------------------------------- agreement signed */

export type AgreementSignedPreviewData = {
  renterName?: string | null;
  ownerName?: string | null;
  listingTitle: string | null;
  amountMinor: number;
  agreementId: string;
};

/**
 * The second party confirms the same terms, so the agreement goes to Vallo for
 * review. Both parties get `agreementSubmitted` by email (outbox template
 * `agreement.submitted`, written by `private.enqueue_agreement_lifecycle_email`
 * in `supabase/migrations/20260930140311_email_lifecycle_triggers.sql`, applied
 * 30 September 2026). No database trigger writes an app row for this step today.
 */
export function agreementSignedPreview(data: AgreementSignedPreviewData): RecipientPreview[] {
  const shared = { listingTitle: data.listingTitle, amountMinor: data.amountMinor, agreementId: data.agreementId };
  return [
    card("Renter", data.renterName, agreementSubmitted({ ...shared, name: data.renterName ?? null, viewer: "renter" }), null),
    card("Owner", data.ownerName, agreementSubmitted({ ...shared, name: data.ownerName ?? null, viewer: "owner" }), null),
  ];
}
