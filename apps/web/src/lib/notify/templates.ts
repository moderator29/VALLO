import {
  agreementApproved,
  agreementRejected,
  agreementWaiting,
  guaranteeClaimDecided,
  type AgreementEmailData,
} from "../email/agreement-messages";
import { staffAccessGranted } from "../email/staff-messages";
import { isStaffPosition } from "../admin/staff-positions";
import {
  inspectionScheduled,
  newDeviceSignIn,
  newEnquiry,
  passwordChanged,
  verificationRungPassed,
  welcome,
  type EmailMessage,
  type SignupRole,
  type VerificationRung,
} from "../email/messages";
import {
  agreementCancelled,
  agreementSubmitted,
  bookingRequestClosed,
  guaranteeClaimOpened,
  inspectionCompleted,
  inspectionDeclined,
  inspectionProposed,
  inspectionWithdrawn,
  listingSubmitted,
  paymentHostReceived,
  paymentRentReceipt,
  refundRequested,
  reservationCancelled,
  reservationConfirmed,
  stayReviewRequest,
  supportReplied,
  unreadMessages,
  verificationRungFailed,
  type AgreementChangeData,
  type ReservationData,
} from "../email/lifecycle-messages";
import type { EmailChannel } from "../email/recipients";
import type { MailLanguage } from "../email/messages";
import { scamRecall } from "../email/safety-messages";
import { platformNewsletter } from "../email/newsletter-message";

/**
 * WHAT A ROW IN THE OUTBOX MEANS, AND THE ONLY PLACE THAT DECIDES.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS MODULE IS PURE, WHICH IS THE WHOLE POINT OF IT.
 *
 * Nine builders sat unreachable under a passing suite for weeks. The suite was
 * not weak: it rendered every one of them, asserted their subjects, walked
 * their blocks. What it could not do was tell anybody whether a person would
 * ever receive one, because a test that a builder exists and a test that a
 * builder is reached are different tests and only the first one was being
 * written.
 *
 * So the registry below is a VALUE, not a switch statement inside the drain.
 * Every template is an entry in one object, keyed by exactly the string a
 * database trigger writes into `email_outbox.template`. That makes two things
 * checkable that were not checkable before:
 *
 *   EVERY TEMPLATE A TRIGGER CAN WRITE HAS AN ENTRY. The test walks the keys
 *   against the list of templates the migrations enqueue, and a trigger that
 *   writes a template nobody built fails the suite rather than filling the
 *   dead-letter column in production.
 *
 *   EVERY ENTRY RENDERS A REAL MESSAGE FROM A REAL PAYLOAD. The test drives
 *   `build` with the exact payload shape the trigger writes, and asserts on the
 *   subject and the body that come out, not on the existence of a function.
 *
 * There is no Supabase client in this file and there must never be one. The
 * drain does the reading; this decides what the words are.
 *
 * ---------------------------------------------------------------------------
 * TWO PHASES, AND WHY THE READS ARE DECLARED RATHER THAN PERFORMED.
 *
 * Several of these messages need a fact the queue deliberately does not carry:
 * the counterparty's name, the property's title and address, which bank a
 * withdrawal went to. Those are facts about a person, and the outbox holds ids
 * so that a row read out of it describes an event without describing anybody.
 *
 * A template therefore DECLARES what it needs (`needs`) and the drain gathers
 * all of it for the whole batch in a handful of queries, then hands each
 * template a set of lookups. Fifty rows is four reads, not a hundred. A
 * template that asks for a fact the drain could not find gets null from the
 * lookup and says something true without it, which every builder here already
 * supports: "the other person" rather than a name, no property row rather than
 * an empty one.
 */

/** The reader, as `lib/email/recipients.ts` resolves them. Never an address. */
export type TemplateRecipient = {
  /** Their display name, when we have one worth greeting them by. */
  name: string | null;
  /**
   * The language they chose (A11), looked up only for a template marked
   * `localized`. Absent means English, which is also what a builder writes
   * for any string its translation lacks.
   */
  language?: MailLanguage;
};

/** A property, as an email prints it. */
export type ListingFacts = {
  title: string | null;
  address: string | null;
};

/** What somebody wrote, and where the reply goes. */
export type EnquiryFacts = {
  /** Their words, as they wrote them. Truncated by the builder, never edited. */
  body: string | null;
  /** Where in the application the reply is written. */
  conversationPath: string;
};

/** What the drain must read before a batch of rows can be built. */
export type TemplateNeeds = {
  /** Display names for these accounts. */
  users?: readonly string[];
  /** Title and address for these listings. */
  listings?: readonly string[];
  /** Which verification rungs these agents have passed. */
  agents?: readonly string[];
  /** The words in these messages. */
  messages?: readonly string[];
};

/** What the drain hands back, once it has read it. */
export type TemplateLookups = {
  userName: (id: string) => string | null;
  /**
   * What this account said it came here to do, or null.
   *
   * Read at send time rather than carried in the row, and that is a rule
   * rather than a convenience: a declared role is a statement a person made
   * about themselves, and the queue holds ids so that a row read out of it
   * describes an event without describing anybody. Reading it late is also
   * simply more correct, because somebody who confirms and then answers the
   * first run question before the drain next runs gets the version that
   * matches what they said.
   */
  signupRole: (id: string) => SignupRole | null;
  listing: (id: string) => ListingFacts | null;
  /** The `agent_verification_checks.kind` values at `passed`, mapped to rungs. */
  passedRungs: (agentId: string) => readonly VerificationRung[];
  enquiry: (messageId: string) => EnquiryFacts | null;
};

export type TemplateContext = {
  /**
   * The account this row belongs to.
   *
   * Present so a template can answer "was it you", which three of the escrow
   * messages turn on: `raisedByYou` and `withdrawnByYou` are the difference
   * between "we have your objection" and "the other person has objected", and
   * getting them the wrong way round would tell somebody they did a thing they
   * did not do. Never an address: the address is the drain's business and
   * never reaches this module.
   */
  recipientId: string;
  recipient: TemplateRecipient;
  lookups: TemplateLookups;
};

export type OutboxTemplate = {
  /**
   * The /settings switch this template answers to, when it answers to one.
   *
   * ALMOST NOTHING HERE DOES, and that is the decision rather than an
   * omission. A security notice, a receipt for money that moved and the state
   * of an agreement somebody is a party to are none of the four channels that
   * screen offers, and honouring a mute for them would silence a message the
   * product has promised to send. `listing.new_enquiry` is the exception: an
   * enquiry IS a message, the Messages switch says in as many words that
   * turning it off stops message email, and a promise on a settings card that
   * the code quietly ignores is worse than no switch.
   */
  channel?: EmailChannel;
  /**
   * True when the builder writes the reader's own language (A11), so the
   * drain reads their setting for this row. Only the templates whose builder
   * takes a language say so; every other one is English and costs no read.
   */
  localized?: true;
  /**
   * The ids this template needs looked up.
   *
   * Read off its own payload, and off the row's recipient, which is the one
   * id every row carries and the payload therefore never repeats. The welcome
   * is the template that wants it: the only thing it looks up is a fact about
   * the person it is addressed to.
   */
  needs: (payload: Payload, recipientId: string) => TemplateNeeds;
  /**
   * The message, or null when this payload cannot make one.
   *
   * Null is not an error and is not a retry. It means the event is real and
   * there is no honest email for it, which the drain records as DROPPED rather
   * than queueing five more attempts at the same impossibility.
   */
  build: (payload: Payload, context: TemplateContext) => EmailMessage | null;
};

export type Payload = Record<string, unknown>;

/* -------------------------------------------------------------- payload reads */

/*
 * A jsonb payload is untyped by the time it reaches here, and it arrived from
 * a trigger rather than from a caller, so these are narrowing rather than
 * validation. Each one answers with null instead of throwing: a malformed
 * payload should cost one email and a line in `last_error`, never a drain.
 */

function str(payload: Payload, key: string): string | null {
  const value = payload[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function num(payload: Payload, key: string): number | null {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  /* Postgres sends a bigint over PostgREST as a JSON number, but a jsonb
     round trip through a client that widens it can arrive as a string. Money
     is integer kobo and must not become NaN on the way. */
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function ids(...values: (string | null)[]): string[] {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0);
}

/* ------------------------------------------------------------------- clock */

/**
 * Africa/Lagos, always, on both halves of a security email.
 *
 * `newDeviceSignIn` and `passwordChanged` both document their `date` and
 * `time` as "already resolved to the reader's own time zone by the caller",
 * and this is the caller. We do not know a reader's time zone and will not
 * guess one from a header; this product has one market and the reader is in
 * it, which is the same ruling `lib/security/when.ts` made for the devices
 * screen and for the same reason. A security email whose clock disagrees with
 * the screen beside it is a security email somebody stops trusting on exactly
 * the day they most need to.
 */
const LAGOS = "Africa/Lagos";

function lagosParts(iso: string | null): { date: string | null; time: string | null } {
  if (!iso) return { date: null, time: null };
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: null, time: null };
  try {
    /* en-CA gives YYYY-MM-DD, which is what every builder's `date` expects. */
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: LAGOS,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: LAGOS,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
    return { date, time };
  } catch {
    return { date: null, time: null };
  }
}

/* -------------------------------------------------------------- agreements */

/** What every agreement email reads off its payload (Track A). */
function agreementData(payload: Payload, context: TemplateContext): AgreementEmailData | null {
  const agreementId = str(payload, "agreement_id");
  const amountMinor = num(payload, "amount_minor");
  const viewer = str(payload, "viewer");
  const kind = str(payload, "kind");
  if (!agreementId || amountMinor === null) return null;
  if (viewer !== "renter" && viewer !== "owner") return null;
  const listingId = str(payload, "listing_id");
  return {
    name: context.recipient.name,
    viewer,
    kind: kind === "stay" ? "stay" : "rent",
    listingTitle: listingId ? (context.lookups.listing(listingId)?.title ?? null) : null,
    amountMinor,
    agreementId,
    reason: str(payload, "reason"),
  };
}

function agreementTemplate(render: (data: AgreementEmailData) => EmailMessage | null): OutboxTemplate {
  return {
    needs: (payload) => ({ listings: ids(str(payload, "listing_id")) }),
    build: (payload, context) => {
      const data = agreementData(payload, context);
      return data ? render(data) : null;
    },
  };
}

/** The agreement lifecycle payloads carry the same keys as `agreementData`'s. */
function agreementChange(render: (data: AgreementChangeData) => EmailMessage): OutboxTemplate {
  return agreementTemplate((data) =>
    render({
      name: data.name,
      viewer: data.viewer,
      listingTitle: data.listingTitle,
      amountMinor: data.amountMinor,
      agreementId: data.agreementId,
    }),
  );
}

/* -------------------------------------------------------- lifecycle reads */

/** The property title an inspection payload names, or null (and then no email). */
function inspectionTitle(payload: Payload, context: TemplateContext): string | null {
  const listingId = str(payload, "listing_id");
  return listingId ? (context.lookups.listing(listingId)?.title ?? null) : null;
}

function inspectionTemplate(
  render: (payload: Payload, context: TemplateContext, title: string) => EmailMessage | null,
): OutboxTemplate {
  return {
    channel: "bookings",
    needs: (payload) => ({
      users: ids(str(payload, "counterparty_id")),
      listings: ids(str(payload, "listing_id")),
    }),
    build: (payload, context) => {
      const title = inspectionTitle(payload, context);
      return title ? render(payload, context, title) : null;
    },
  };
}

function reservationData(payload: Payload, context: TemplateContext): ReservationData {
  const listingId = str(payload, "listing_id");
  const at = lagosParts(str(payload, "reserved_for"));
  return {
    name: context.recipient.name,
    /* A restaurant's table carries the business's own name (a trading name,
       public on its page); a table on a listing carries the listing title. */
    placeName:
      str(payload, "place_name") ??
      (listingId ? context.lookups.listing(listingId)?.title : null) ??
      "the restaurant",
    date: at.date,
    time: at.time,
    partySize: num(payload, "party_size"),
  };
}

/** The verification step, in the words the verification page uses. */
const STEP_NAME: Record<string, string> = {
  identity: "Identity",
  address: "Address",
  inspection: "In-person",
  payout: "Payout account",
};

/* ------------------------------------------------------------- the registry */

/**
 * Every template a trigger can write, and nothing else.
 *
 * The keys are the exact strings the migrations compose. The escrow and
 * wallet templates are gone with the custody they described (Track A): Vallo
 * holds no money, so there is no hold, release or withdrawal to announce.
 */
export const OUTBOX_TEMPLATES: Readonly<Record<string, OutboxTemplate>> = {
  /* -------------------------------------------------------------- account */

  /**
   * The first thing Vallo ever sends somebody unprompted.
   *
   * WRITTEN BY `users_enqueue_welcome_email_on_insert` AND
   * `..._on_confirm`, both on `auth.users`, at the moment the address stops
   * being a claim and becomes a fact. Not at sign-up: mailing an unconfirmed
   * address makes this platform the delivery mechanism for somebody else's
   * abuse.
   *
   * NO `channel`, DELIBERATELY. The four switches on `/settings` are Bookings,
   * Messages, Wallet and Marketing, and this is none of them. It is the one
   * message that explains what the account somebody just opened actually is,
   * and it carries the link to those switches: muting it behind a switch the
   * reader has not been shown yet would be silencing the letter that tells
   * them the switches exist.
   *
   * THE ROLE IS READ AND NEVER GUESSED. `welcome` writes six versions and
   * `profiles.signup_role` carries the one the person declared. Null is an
   * ordinary state, not a lesser one: it means they were never asked or they
   * skipped, and the general version names both sides of the platform rather
   * than inferring a role from anything else about them, which would be
   * inventing a fact about a person.
   */
  "account.welcome": {
    needs: (_payload, recipientId) => ({ users: [recipientId] }),
    build: (_payload, context) =>
      welcome({
        name: context.recipient.name,
        role: context.lookups.signupRole(context.recipientId),
      }),
  },

  /**
   * The platform newsletter, one row per member.
   *
   * WRITTEN BY `public.newsletter_enqueue(campaign)`, run by hand by the
   * founder from the SQL editor. NEVER BY A TRIGGER OR A CRON: nothing sends
   * this automatically. Its channel is `marketing`, so the drain refuses a
   * member who switched marketing off and adds the List-Unsubscribe headers.
   */
  "platform.newsletter": {
    channel: "marketing",
    needs: (_payload, recipientId) => ({ users: [recipientId] }),
    build: (_payload, context) => platformNewsletter({ name: context.recipient.name }),
  },

  /* ----------------------------------------------------------- agreements */

  /* Written by private.agreement_tell_both when an agreement is drawn up and
     when Vallo decides it (Track A). Both parties get their own row. */
  "agreement.waiting": agreementTemplate((data) => agreementWaiting(data)),
  "agreement.approved": agreementTemplate((data) => agreementApproved(data)),
  "agreement.rejected": agreementTemplate((data) => (data.reason ? agreementRejected(data) : null)),

  /* Written by private.enqueue_agreement_lifecycle_email (29 September) when
     both parties have confirmed the same terms (status becomes in_review) and
     when an agreement is cancelled. Both parties get their own row. */
  "agreement.submitted": agreementChange((data) => agreementSubmitted(data)),
  "agreement.cancelled": agreementChange((data) => agreementCancelled(data)),

  /* Written by private.enqueue_guarantee_claim_email when a claim is filed. */
  "guarantee.claim_opened": {
    needs: () => ({}),
    build: (payload, context) => {
      const agreementId = str(payload, "agreement_id");
      if (!agreementId) return null;
      return guaranteeClaimOpened({
        name: context.recipient.name,
        agreementId,
        requestedMinor: num(payload, "requested_minor"),
      });
    },
  },

  /* Written by public.admin_decide_guarantee_claim. */
  "guarantee.claim_decided": {
    needs: () => ({}),
    build: (payload, context) => {
      const agreementId = str(payload, "agreement_id");
      const decision = str(payload, "decision");
      if (!agreementId || (decision !== "approve" && decision !== "reject")) return null;
      return guaranteeClaimDecided({
        name: context.recipient.name,
        decision,
        amountMinor: num(payload, "amount_minor"),
        reason: str(payload, "reason"),
        agreementId,
      });
    },
  },

  /* ---------------------------------------------------------------- staff */

  /* Written by public.admin_grant_staff (Track K). Names the exact access. */
  "staff.access_granted": {
    needs: () => ({}),
    build: (payload, context) => {
      const scopeWords = str(payload, "scope_words");
      if (!scopeWords) return null;
      const position = str(payload, "position");
      return staffAccessGranted({
        name: context.recipient.name,
        scopeWords,
        position: isStaffPosition(position) ? position : null,
      });
    },
  },

  /* ------------------------------------------------------------- security */

  "security.password_changed": {
    localized: true,
    needs: () => ({}),
    build: (payload, context) => {
      const when = lagosParts(str(payload, "at"));
      return passwordChanged({
        ...context.recipient.language,
        name: context.recipient.name,
        date: when.date,
        time: when.time,
      });
    },
  },

  "security.new_device_sign_in": {
    localized: true,
    needs: () => ({}),
    build: (payload, context) => {
      const when = lagosParts(str(payload, "at"));
      return newDeviceSignIn({
        ...context.recipient.language,
        name: context.recipient.name,
        date: when.date,
        time: when.time,
        /* Already words from a fixed list by the time it was queued, and
           never the raw header. A device we could not name is absent from
           the rows rather than described as "unknown", which reads to a
           person as a finding rather than as a gap. */
        device: str(payload, "device"),
        /*
         * NO PLACE, DELIBERATELY. The builder takes one and the queue has
         * none, because turning an IP into a city needs a geolocation service
         * this platform does not have, and a guess printed beside "was this
         * you" is worse than a blank: somebody in Abuja told the sign-in was
         * from Lagos will either panic about themselves or ignore a real one.
         */
        place: null,
      });
    },
  },

  /* ----------------------------------------------------------- inspection */

  "inspection.scheduled": {
    needs: (payload) => ({
      users: ids(str(payload, "counterparty_id")),
      listings: ids(str(payload, "listing_id")),
    }),
    build: (payload, context) => {
      const rawAudience = str(payload, "audience");
      const audience = rawAudience === "lister" ? "lister" : rawAudience === "viewer" ? "viewer" : null;
      const when = lagosParts(str(payload, "slot_at"));
      const listingId = str(payload, "listing_id");
      const listing = listingId ? context.lookups.listing(listingId) : null;
      /*
       * THE WHOLE MESSAGE IS WHERE TO BE AND WHEN. Without a time there is
       * nothing to send, and without a property there is nothing to name, so
       * either missing means no email rather than an email with a hole in it.
       * Both sides are about to travel across a Nigerian city to meet somebody
       * they have not met; a half-filled one is worse than none.
       */
      if (!audience || !when.date || !when.time || !listing?.title) return null;

      const counterpartyId = str(payload, "counterparty_id");
      return inspectionScheduled({
        audience,
        name: context.recipient.name,
        listingTitle: listing.title,
        /* The address the listing carries, or the title again rather than an
           empty row. A blank "Address" reads as "there is no address". */
        address: listing.address ?? listing.title,
        date: when.date,
        time: when.time,
        otherPartyName: counterpartyId ? context.lookups.userName(counterpartyId) : null,
        /*
         * NO NUMBER. The builder offers a row for it and this does not fill
         * it. A phone number is a personal datum and nobody on this platform
         * has agreed to have theirs posted to the other party's inbox; the
         * conversation in the app is the channel both sides already consented
         * to and the email's button goes to it.
         */
        otherPartyPhone: null,
      });
    },
  },

  /*
   * THE REST OF A VIEWING'S LIFE (29 September), written by
   * private.enqueue_inspection_change_email on each state change the in-app
   * notification already announces. They answer to the Bookings switch, as
   * the Bookings card promises for everything about a booking or a viewing;
   * `inspection.scheduled` above predates the switch being honoured here and
   * is left as it was.
   */
  "inspection.proposed": inspectionTemplate((payload, context, title) => {
    const at = lagosParts(str(payload, "slot_at"));
    return inspectionProposed({ name: context.recipient.name, listingTitle: title, date: at.date, time: at.time });
  }),
  "inspection.declined": inspectionTemplate((payload, context, title) =>
    inspectionDeclined({ name: context.recipient.name, listingTitle: title, note: str(payload, "note") }),
  ),
  "inspection.withdrawn": inspectionTemplate((payload, context, title) => {
    const at = lagosParts(str(payload, "slot_at"));
    const counterpartyId = str(payload, "counterparty_id");
    return inspectionWithdrawn({
      name: context.recipient.name,
      listingTitle: title,
      date: at.date,
      time: at.time,
      otherPartyName: counterpartyId ? context.lookups.userName(counterpartyId) : null,
    });
  }),
  "inspection.completed": inspectionTemplate((payload, context, title) => {
    const audience = str(payload, "audience");
    if (audience !== "viewer" && audience !== "lister") return null;
    const counterpartyId = str(payload, "counterparty_id");
    return inspectionCompleted({
      audience,
      name: context.recipient.name,
      listingTitle: title,
      otherPartyName: counterpartyId ? context.lookups.userName(counterpartyId) : null,
    });
  }),

  /* ------------------------------------------------------ support, listings */

  /* Written by private.enqueue_support_reply_email when staff reply. The
     reply's words are not carried: the button opens them in the app. */
  "support.replied": {
    needs: () => ({}),
    build: (payload, context) => {
      const ticketId = str(payload, "ticket_id");
      const reference = str(payload, "reference");
      if (!ticketId || !reference) return null;
      return supportReplied({ name: context.recipient.name, reference, ticketId, preview: null });
    },
  },

  /* Written by private.enqueue_listing_submitted_email when a listing enters
     review. A receipt: the decision emails are sent by the admin actions. */
  "listing.submitted": {
    needs: (payload) => ({ listings: ids(str(payload, "listing_id")) }),
    build: (payload, context) => {
      const listingId = str(payload, "listing_id");
      const title = listingId ? context.lookups.listing(listingId)?.title : null;
      return title ? listingSubmitted({ name: context.recipient.name, listingTitle: title }) : null;
    },
  },

  /* ---------------------------------------------- reservations and refunds */

  "reservation.confirmed": {
    channel: "bookings",
    needs: (payload) => ({ listings: ids(str(payload, "listing_id")) }),
    build: (payload, context) => reservationConfirmed(reservationData(payload, context)),
  },
  "reservation.cancelled": {
    channel: "bookings",
    needs: (payload) => ({ listings: ids(str(payload, "listing_id")) }),
    build: (payload, context) => reservationCancelled(reservationData(payload, context)),
  },
  "refund.requested": {
    channel: "bookings",
    needs: () => ({}),
    build: (payload, context) => {
      const bookingId = str(payload, "booking_id");
      if (!bookingId) return null;
      return refundRequested({ name: context.recipient.name, bookingId, dueBy: lagosParts(str(payload, "due_by")).date });
    },
  },

  /*
   * PAYMENT EMAILS. `payment.received` and `payment.receipt` stay reserved for
   * the crypto payment work. The two below are written by migration nt02
   * (`private.tell_payment_received`) when a card charge settles: the host is
   * told money reached them, and the payer of a rent charge gets a receipt.
   * Neither answers to a switch: money that moved is not a preference. The
   * guest of a stay is not here because `announceConfirmedStay` already sends
   * the booking confirmation.
   */
  "payment.host_received": {
    needs: () => ({}),
    build: (payload, context) => {
      const place = str(payload, "place");
      const amount = num(payload, "amount_minor");
      if (!place || amount === null || amount <= 0) return null;
      return paymentHostReceived({
        name: context.recipient.name,
        place,
        checkIn: str(payload, "check_in"),
        checkOut: str(payload, "check_out"),
        amountMinor: amount,
        shareMinor: num(payload, "share_minor"),
        rail: str(payload, "rail") === "protected" ? "protected" : "direct",
        side: str(payload, "side") === "host" ? "host" : "agent",
      });
    },
  },
  "payment.rent_receipt": {
    needs: () => ({}),
    build: (payload, context) => {
      const place = str(payload, "place");
      const amount = num(payload, "amount_minor");
      const rentPaymentId = str(payload, "rent_payment_id");
      if (!place || amount === null || amount <= 0 || !rentPaymentId) return null;
      return paymentRentReceipt({
        name: context.recipient.name,
        place,
        amountMinor: amount,
        share: payload.share === true,
        rentPaymentId,
      });
    },
  },

  /* Written by migration nt06 (`private.tell_booking_request_closed`) when a
     stay request is closed by somebody other than the guest. The Bookings
     switch governs it, like every other stay mail. */
  "booking.request_closed": {
    channel: "bookings",
    needs: () => ({}),
    build: (payload, context) => {
      const place = str(payload, "place");
      const bookingId = str(payload, "booking_id");
      if (!place || !bookingId) return null;
      return bookingRequestClosed({
        name: context.recipient.name,
        place,
        checkIn: str(payload, "check_in"),
        checkOut: str(payload, "check_out"),
        bookingId,
      });
    },
  },

  /* ----------------------------------------- stays and messages (nt05) */

  /* Written by `private.tell_stay_event` the day after check-out, once, while
     no review exists. The Bookings switch governs it, like the other stay mail. */
  "stay.review_request": {
    channel: "bookings",
    needs: () => ({}),
    build: (payload, context) => {
      const place = str(payload, "place");
      const bookingId = str(payload, "booking_id");
      if (!place || !bookingId) return null;
      return stayReviewRequest({ name: context.recipient.name, place, bookingId });
    },
  },
  /* Written by `private.send_unread_message_emails` for a run of messages left
     unread for two hours. The words are not carried: the button opens them.
     The Messages switch governs it. */
  "message.unread": {
    channel: "messages",
    needs: (payload) => ({ users: ids(str(payload, "sender_id")) }),
    build: (payload, context) => {
      const conversationId = str(payload, "conversation_id");
      if (!conversationId) return null;
      const senderId = str(payload, "sender_id");
      return unreadMessages({
        name: context.recipient.name,
        senderName: senderId ? context.lookups.userName(senderId) : null,
        count: Math.max(0, num(payload, "count") ?? 0),
        conversationPath:
          str(payload, "side") === "agent" ? `/agent/messages/${conversationId}` : `/messages/${conversationId}`,
      });
    },
  },

  /* ------------------------------------------------------------ enquiries */

  "listing.new_enquiry": {
    /* The one template that answers to a switch; see `channel` above. */
    channel: "messages",
    needs: (payload) => ({
      users: ids(str(payload, "enquirer_id")),
      listings: ids(str(payload, "listing_id")),
      messages: ids(str(payload, "message_id")),
    }),
    build: (payload, context) => {
      const listingId = str(payload, "listing_id");
      const listing = listingId ? context.lookups.listing(listingId) : null;
      const messageId = str(payload, "message_id");
      const enquiry = messageId ? context.lookups.enquiry(messageId) : null;
      /*
       * The preview is the whole reason this email is worth more than the
       * in-app row it accompanies: "you have a new message" makes somebody
       * open an application to find out whether it mattered. Without the words
       * or without the property there is nothing here the bell does not
       * already do, so there is no email.
       */
      if (!listing?.title || !enquiry?.body) return null;
      const enquirerId = str(payload, "enquirer_id");
      return newEnquiry({
        listerName: context.recipient.name,
        enquirerName: enquirerId ? context.lookups.userName(enquirerId) : null,
        listingTitle: listing.title,
        preview: enquiry.body,
        conversationPath: enquiry.conversationPath,
      });
    },
  },

  /* --------------------------------------------------------------- safety */

  /*
   * V-60, WRITTEN BY `public.scam_recall_send`: staff recalled a stop for
   * fraud and this person talked to the stopped account. No `channel`: a
   * safety notice is not a switchable kind of mail. The payload carries the
   * listing title the recipient talked about and the category, and nothing
   * about the stopped account.
   */
  "safety.scam_recall": {
    needs: () => ({}),
    build: (payload, context) => {
      const category = str(payload, "category");
      if (category !== "off_platform_payment" && category !== "scam") return null;
      return scamRecall({
        name: context.recipient.name,
        listingTitle: str(payload, "listing_title"),
        category,
      });
    },
  },

  /* --------------------------------------------------------- verification */

  /* Written by private.enqueue_verification_rung_email's companion,
     private.enqueue_verification_failed_email, when a step is marked failed. */
  "verification.rung_failed": {
    needs: () => ({}),
    build: (payload, context) => {
      const rung = str(payload, "rung");
      const stepName = rung ? STEP_NAME[rung] : undefined;
      if (!stepName) return null;
      return verificationRungFailed({ name: context.recipient.name, stepName, note: str(payload, "note") });
    },
  },

  "verification.rung_passed": {
    needs: (payload) => ({ agents: ids(str(payload, "agent_id")) }),
    build: (payload, context) => {
      const raw = str(payload, "rung");
      const rung = RUNG_LADDER.find((r) => r === raw) ?? null;
      if (!rung) return null;
      const agentId = str(payload, "agent_id");
      const passed = agentId ? context.lookups.passedRungs(agentId) : [];
      return verificationRungPassed({
        name: context.recipient.name,
        rung,
        nextRung: nextRungAfter(rung, passed),
      });
    },
  },
};

/**
 * The ladder, in the order the email climbs it.
 *
 * `phone` is first in the email's vocabulary and has no row in
 * `agent_verification_checks`, so it is never a rung this path can announce as
 * passed and never a rung it can offer as next. That is a gap in the table
 * rather than in the message, and it is named here so the next person finds it
 * stated rather than inferring it from an absence.
 */
const RUNG_LADDER: readonly VerificationRung[] = ["phone", "identity", "address", "inspection"];

/** The next rung this agent has NOT passed, or null at the top. */
export function nextRungAfter(
  rung: VerificationRung,
  passed: readonly VerificationRung[],
): VerificationRung | null {
  const from = RUNG_LADDER.indexOf(rung);
  if (from < 0) return null;
  for (let i = from + 1; i < RUNG_LADDER.length; i += 1) {
    const candidate = RUNG_LADDER[i];
    if (candidate && !passed.includes(candidate)) return candidate;
  }
  return null;
}

/** Every template key the registry answers to, for the coverage test. */
export const OUTBOX_TEMPLATE_KEYS: readonly string[] = Object.keys(OUTBOX_TEMPLATES);

/** Is this a template we can build at all? The drain's first question. */
export function templateFor(name: string): OutboxTemplate | null {
  return OUTBOX_TEMPLATES[name] ?? null;
}
