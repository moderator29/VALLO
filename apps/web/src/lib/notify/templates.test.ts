import { describe, expect, it } from "vitest";
import { PRIVATE_ADDRESS } from "../security/private-address";

import {
  OUTBOX_TEMPLATES,
  OUTBOX_TEMPLATE_KEYS,
  nextRungAfter,
  templateFor,
  type Payload,
  type TemplateContext,
  type TemplateLookups,
} from "./templates";
import { LIFECYCLE_PAYLOADS } from "./lifecycle-fixtures";

/**
 * THE TEST THAT THE OLD SUITE COULD NOT WRITE.
 *
 * Nine builders sat unreachable for weeks under a green suite, because every
 * test asked whether a builder EXISTS and rendered it with a hand-made object.
 * None of them could ask whether anything would ever call it, or whether the
 * thing that called it would hand it the shape a database actually writes.
 *
 * So every case below starts from THE EXACT PAYLOAD A TRIGGER COMPOSES, copied
 * key for key out of the migration that composes it, and asserts on the words
 * that come out the other end. A payload key renamed in SQL without its
 * template being changed fails here, which is the failure the old shape could
 * not see.
 */

const PAYER = "11111111-1111-4111-8111-111111111111";
const PAYEE = "22222222-2222-4222-8222-222222222222";
const AGREEMENT = "33333333-3333-4333-8333-333333333333";
const LISTING = "44444444-4444-4444-8444-444444444444";
const AGENT = "66666666-6666-4666-8666-666666666666";
const MESSAGE = "99999999-9999-4999-8999-999999999999";

const lookups: TemplateLookups = {
  userName: (id) => (id === PAYEE ? "Chidi Okonkwo" : id === PAYER ? "Ada Balogun" : null),
  /* Only the payer declared one, so the welcome has both branches to walk. */
  signupRole: (id) => (id === PAYER ? "landlord" : null),
  listing: (id) =>
    id === LISTING ? { title: "2 bedroom flat, Yaba", address: "14 Herbert Macaulay Way" } : null,
  passedRungs: (id) => (id === AGENT ? ["identity"] : []),
  enquiry: (id) =>
    id === MESSAGE
      ? {
          body: "Good afternoon. Is this flat still available, and is the service charge separate?",
          conversationPath: "/messages/88888888-8888-4888-8888-888888888888",
        }
      : null,
};

function contextFor(recipientId: string, name: string | null): TemplateContext {
  return { recipientId, recipient: { name }, lookups };
}

/** The keys every agreement payload carries (Track A). */
function agreementPayload(viewer: "renter" | "owner", extra: Payload = {}): Payload {
  return {
    agreement_id: AGREEMENT,
    listing_id: LISTING,
    kind: "rent",
    amount_minor: 250_000_00,
    viewer,
    ...extra,
  };
}

/**
 * Exactly the templates the four migrations enqueue, written out here rather
 * than derived, so that adding a trigger without a builder is a failing test
 * and not a row that quietly lands in the dead-letter column at three in the
 * morning.
 */
const TEMPLATES_THE_TRIGGERS_WRITE = [
  "account.welcome",
  "agreement.waiting",
  "agreement.approved",
  "agreement.rejected",
  "guarantee.claim_decided",
  "staff.access_granted",
  "security.password_changed",
  "security.new_device_sign_in",
  "inspection.scheduled",
  "verification.rung_passed",
  "listing.new_enquiry",
  "safety.scam_recall",
  /* 29 September: the lifecycle migration (supabase/migrations/pending). */
  "agreement.submitted",
  "agreement.cancelled",
  "guarantee.claim_opened",
  "inspection.proposed",
  "inspection.declined",
  "inspection.withdrawn",
  "inspection.completed",
  "support.replied",
  "listing.submitted",
  "reservation.confirmed",
  "reservation.cancelled",
  "refund.requested",
  "verification.rung_failed",
  /* 13 October: the payment and stay migrations (nt02, nt05). */
  "payment.host_received",
  "payment.rent_receipt",
  "stay.review_request",
  "message.unread",
  "booking.request_closed",
  /* 3 November: the founder-run newsletter (public.newsletter_enqueue). */
  "platform.newsletter",
] as const;


/** One real payload per template, of the shape its own trigger composes. */
const PAYLOADS: Record<(typeof TEMPLATES_THE_TRIGGERS_WRITE)[number], Payload> = {
  /* `private.enqueue_welcome_email` writes the clock and nothing else. */
  "account.welcome": { at: "2026-09-23T13:05:00.000Z" },
  "agreement.waiting": agreementPayload("renter"),
  "agreement.approved": agreementPayload("renter"),
  "agreement.rejected": agreementPayload("owner", {
    reason: "The inspection photos do not show the kitchen. Add clear photos and submit again.",
  }),
  "guarantee.claim_decided": {
    claim_id: "5b5b5b5b-5b5b-4b5b-8b5b-5b5b5b5b5b5b",
    agreement_id: AGREEMENT,
    decision: "approve",
    amount_minor: 30_000_00,
    reason: "The cooker did not work at move-in, as the report shows.",
  },
  /* `public.admin_grant_staff` (Track K) writes the scopes and their words. */
  "staff.access_granted": { scopes: ["kyc_review", "support"], scope_words: "KYC review, Support" },
  "security.password_changed": { at: "2026-09-23T13:05:00.000Z" },
  "security.new_device_sign_in": {
    at: "2026-09-23T13:05:00.000Z",
    device: "Chrome on Android",
  },
  "inspection.scheduled": {
    inspection_id: "77777777-7777-4777-8777-777777777777",
    listing_id: LISTING,
    audience: "viewer",
    counterparty_id: PAYEE,
    slot_at: "2026-10-02T10:30:00.000Z",
  },
  "verification.rung_passed": { agent_id: AGENT, rung: "identity" },
  "listing.new_enquiry": {
    conversation_id: "88888888-8888-4888-8888-888888888888",
    message_id: MESSAGE,
    listing_id: LISTING,
    enquirer_id: PAYEE,
  },
  /* `public.scam_recall_send` (V-60) writes the listing title and the category. */
  "safety.scam_recall": { listing_title: "Two bedroom flat in Ikeja GRA", category: "off_platform_payment" },
  /* The lifecycle payloads, from the fixture `outbox-delivery.test.ts` shares. */
  "agreement.submitted": LIFECYCLE_PAYLOADS["agreement.submitted"]!,
  "agreement.cancelled": LIFECYCLE_PAYLOADS["agreement.cancelled"]!,
  "guarantee.claim_opened": LIFECYCLE_PAYLOADS["guarantee.claim_opened"]!,
  "inspection.proposed": LIFECYCLE_PAYLOADS["inspection.proposed"]!,
  "inspection.declined": LIFECYCLE_PAYLOADS["inspection.declined"]!,
  "inspection.withdrawn": LIFECYCLE_PAYLOADS["inspection.withdrawn"]!,
  "inspection.completed": LIFECYCLE_PAYLOADS["inspection.completed"]!,
  "support.replied": LIFECYCLE_PAYLOADS["support.replied"]!,
  "listing.submitted": LIFECYCLE_PAYLOADS["listing.submitted"]!,
  "reservation.confirmed": LIFECYCLE_PAYLOADS["reservation.confirmed"]!,
  "reservation.cancelled": LIFECYCLE_PAYLOADS["reservation.cancelled"]!,
  "refund.requested": LIFECYCLE_PAYLOADS["refund.requested"]!,
  "verification.rung_failed": LIFECYCLE_PAYLOADS["verification.rung_failed"]!,
  "payment.host_received": LIFECYCLE_PAYLOADS["payment.host_received"]!,
  "payment.rent_receipt": LIFECYCLE_PAYLOADS["payment.rent_receipt"]!,
  "stay.review_request": LIFECYCLE_PAYLOADS["stay.review_request"]!,
  "message.unread": LIFECYCLE_PAYLOADS["message.unread"]!,
  "booking.request_closed": LIFECYCLE_PAYLOADS["booking.request_closed"]!,
  "platform.newsletter": { campaign: "2026-11-launch" },
};

describe("the lifecycle templates (29 September)", () => {
  const build = (name: string) => templateFor(name)?.build(PAYLOADS[name as keyof typeof PAYLOADS], contextFor(PAYER, "Ada"));

  it("answer to the Bookings switch for viewings, tables and refunds, and to nothing for obligations", () => {
    for (const name of [
      "inspection.proposed",
      "inspection.declined",
      "inspection.withdrawn",
      "inspection.completed",
      "reservation.confirmed",
      "reservation.cancelled",
      "refund.requested",
    ]) {
      expect(templateFor(name)?.channel, name).toBe("bookings");
    }
    for (const name of [
      "agreement.submitted",
      "agreement.cancelled",
      "guarantee.claim_opened",
      "support.replied",
      "listing.submitted",
      "verification.rung_failed",
    ]) {
      expect(templateFor(name)?.channel, name).toBeUndefined();
    }
  });

  it("say the thing that happened, with the facts the trigger carried", () => {
    expect(build("inspection.proposed")?.text).toContain("2 bedroom flat, Yaba");
    expect(build("inspection.declined")?.html).toContain("The flat is let from Friday.");
    expect(build("inspection.withdrawn")?.html).toContain("Chidi");
    expect(build("inspection.completed")?.text).toContain("agreement");
    expect(build("support.replied")?.subject).toContain("VAL-SUP-4K2P");
    expect(build("support.replied")?.html).toContain("/support/messages/5c5c5c5c-5c5c-4c5c-8c5c-5c5c5c5c5c5c");
    expect(build("listing.submitted")?.subject).toContain("2 bedroom flat, Yaba");
    expect(build("agreement.submitted")?.text).toContain("Nothing is paid until it is approved");
    expect(build("agreement.cancelled")?.subject).toContain("cancelled");
    expect(build("guarantee.claim_opened")?.text).toContain("30,000");
    expect(build("reservation.confirmed")?.subject).toContain("Terra Kulture");
    expect(build("reservation.cancelled")?.text).toContain("4 guests");
    expect(build("refund.requested")?.html).toContain("/bookings/5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f5f");
    expect(build("verification.rung_failed")?.subject).toBe("Your identity check did not pass");
    expect(build("verification.rung_failed")?.html).toContain("too blurred");
  });

  it("send nothing rather than a message with a hole in it", () => {
    const ctx = contextFor(PAYER, "Ada");
    expect(templateFor("inspection.proposed")?.build({ listing_id: "unknown" }, ctx)).toBeNull();
    expect(templateFor("inspection.completed")?.build({ listing_id: LISTING, audience: "nobody" }, ctx)).toBeNull();
    expect(templateFor("support.replied")?.build({ ticket_id: "x" }, ctx)).toBeNull();
    expect(templateFor("verification.rung_failed")?.build({ rung: "phone" }, ctx)).toBeNull();
    expect(templateFor("refund.requested")?.build({}, ctx)).toBeNull();
  });
});

describe("the payment and stay templates (13 October)", () => {
  const build = (name: string, extra: Payload = {}) =>
    templateFor(name)?.build({ ...PAYLOADS[name as keyof typeof PAYLOADS], ...extra }, contextFor(PAYER, "Ada"));

  it("a payment is not a preference, and a review request or an unread message answers to its own switch", () => {
    expect(templateFor("payment.host_received")?.channel).toBeUndefined();
    expect(templateFor("payment.rent_receipt")?.channel).toBeUndefined();
    expect(templateFor("stay.review_request")?.channel).toBe("bookings");
    expect(templateFor("booking.request_closed")?.channel).toBe("bookings");
    expect(templateFor("message.unread")?.channel).toBe("messages");
  });

  it("tells the host what was paid and their share, in the words of the rail", () => {
    const direct = build("payment.host_received");
    expect(direct?.subject).toContain("Payment received");
    expect(direct?.text).toContain("270,000");
    expect(direct?.text).toContain("straight to the bank account on your payout details");
    expect(direct?.html).toContain("/agent/bookings");
    const protectedRail = build("payment.host_received", { rail: "protected", side: "host", share_minor: null });
    expect(protectedRail?.text).toContain("held by Vallo's licensed payment partner");
    expect(protectedRail?.text).not.toContain("Your share:");
    expect(protectedRail?.html).toContain("/host/bookings");
  });

  it("gives the rent payer a receipt that opens the tenancy file", () => {
    expect(build("payment.rent_receipt")?.html).toContain("/tenancy/9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c9c");
    expect(build("payment.rent_receipt", { share: true })?.subject).toContain("Share paid");
  });

  it("tells a guest their request was closed, with nothing charged, and opens the booking", () => {
    const closed = build("booking.request_closed");
    expect(closed?.subject).toContain("Request not accepted");
    expect(closed?.text).toContain("Nothing was charged");
    expect(closed?.html).toContain("/bookings/9d9d9d9d-9d9d-4d9d-8d9d-9d9d9d9d9d9d");
  });

  it("asks for a review at the review page, and sends the unread run to the right inbox", () => {
    expect(build("stay.review_request")?.html).toContain("/bookings/9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b9b/review");
    expect(build("message.unread")?.html).toContain("/messages/88888888-8888-4888-8888-888888888888");
    expect(build("message.unread", { side: "agent" })?.html).toContain("/agent/messages/88888888-8888-4888-8888-888888888888");
  });

  it("sends nothing rather than a message with a hole in it", () => {
    const ctx = contextFor(PAYER, "Ada");
    expect(templateFor("payment.host_received")?.build({ place: "Flat" }, ctx)).toBeNull();
    expect(templateFor("payment.host_received")?.build({ place: "Flat", amount_minor: 0 }, ctx)).toBeNull();
    expect(templateFor("payment.rent_receipt")?.build({ place: "Flat", amount_minor: 5 }, ctx)).toBeNull();
    expect(templateFor("stay.review_request")?.build({ booking_id: "x" }, ctx)).toBeNull();
    expect(templateFor("message.unread")?.build({}, ctx)).toBeNull();
    expect(templateFor("booking.request_closed")?.build({ place: "Flat" }, ctx)).toBeNull();
  });
});

describe("the registry covers every template a trigger writes", () => {
  it("has an entry for each one, and no entry nobody writes", () => {
    expect([...OUTBOX_TEMPLATE_KEYS].sort()).toEqual([...TEMPLATES_THE_TRIGGERS_WRITE].sort());
  });

  it("builds a real message for every one of them, from the trigger's own payload", () => {
    for (const name of TEMPLATES_THE_TRIGGERS_WRITE) {
      const template = templateFor(name);
      expect(template, name).not.toBeNull();
      const message = template?.build(PAYLOADS[name], contextFor(PAYER, "Ada"));
      expect(message, name).not.toBeNull();
      /* A subject, a document and a text alternative, all non-empty. A message
         with no text part is a bulk-mail signature to every major filter. */
      expect(message?.subject.length, name).toBeGreaterThan(0);
      expect(message?.html.length, name).toBeGreaterThan(200);
      expect(message?.text.length, name).toBeGreaterThan(50);
      expect(message?.html, name).toContain("<html");
    }
  });

  it("asks only for the ids its own payload carries", () => {
    const agreement = OUTBOX_TEMPLATES["agreement.approved"]?.needs(PAYLOADS["agreement.approved"], PAYER);
    expect(agreement?.listings).toEqual([LISTING]);

    /* The two security templates need nothing looked up at all, which is what
       lets them send when everything else is unreachable. */
    expect(
      OUTBOX_TEMPLATES["security.password_changed"]?.needs(
        PAYLOADS["security.password_changed"],
        PAYER,
      ),
    ).toEqual({});
    expect(
      OUTBOX_TEMPLATES["security.new_device_sign_in"]?.needs(
        PAYLOADS["security.new_device_sign_in"],
        PAYER,
      ),
    ).toEqual({});

    /* The welcome's payload carries no id at all, so the only thing it can
       ask for is the reader it is addressed to. If it ever asked for an id
       off the payload, the payload would have to carry one. */
    expect(
      OUTBOX_TEMPLATES["account.welcome"]?.needs(PAYLOADS["account.welcome"], PAYER),
    ).toEqual({ users: [PAYER] });
  });
});

describe("the welcome is the version the reader declared, and never a guess", () => {
  /* The six versions differ in their words, not in their shell, so every
     assertion here is on a sentence only one version contains. A build that
     handed `welcome` the wrong role, or no role at all, fails on these. */

  it("sends the landlord the landlord's first steps, because that is what they said", () => {
    const message = templateFor("account.welcome")?.build(
      PAYLOADS["account.welcome"],
      contextFor(PAYER, "Ada Balogun"),
    );
    expect(message?.subject).toBe("Welcome to Vallo, Ada");
    /* And NOT the renter's opening, which is the failure this catches: a
       registry that dropped the lookup would send everybody the general one. */
  });

  it("sends the general version when nothing was declared, and says so honestly", () => {
    const message = templateFor("account.welcome")?.build(
      PAYLOADS["account.welcome"],
      contextFor(PAYEE, "Chidi Okonkwo"),
    );
    expect(message?.html).toContain("Hello Chidi.");
  });

  it("greets by the first name and never opens with a legal name or an id", () => {
    const message = templateFor("account.welcome")?.build(
      PAYLOADS["account.welcome"],
      contextFor(PAYER, "Ada Balogun"),
    );
    expect(message?.html).toContain("Hello Ada.");
    expect(message?.html).not.toContain("Hello Ada Balogun");
    expect(message?.html).not.toContain(PAYER);
    expect(message?.text).not.toContain(PAYER);
  });

  it("still has a message for somebody we have no name for", () => {
    const message = templateFor("account.welcome")?.build(
      PAYLOADS["account.welcome"],
      contextFor(PAYEE, null),
    );
    expect(message?.subject).toBe("Welcome to Vallo");
    expect(message?.html).not.toContain("Hello ,");
    expect(message?.html).not.toContain("Hello null");
  });

  it("points at the first run screen, not at an address nobody can reach", () => {
    const message = templateFor("account.welcome")?.build(
      PAYLOADS["account.welcome"],
      contextFor(PAYER, "Ada"),
    );
    expect(message?.text).toContain("/welcome");
    /* The one private address the founder keeps off every public surface. */
    expect(message?.html).not.toMatch(PRIVATE_ADDRESS);
    expect(message?.text).not.toMatch(PRIVATE_ADDRESS);
  });
});

describe("the agreement messages (Track A)", () => {
  it("tells the renter payment is open, and says Vallo never holds the money", () => {
    const message = templateFor("agreement.approved")?.build(PAYLOADS["agreement.approved"], contextFor(PAYER, "Ada"));
    expect(message?.subject).toContain("payment is open");
    expect(message?.text).toContain("Vallo never holds your money");
    expect(message?.text).not.toMatch(/escrow|wallet/i);
  });

  it("gives a rejection's reason word for word, and sends nothing without one", () => {
    const message = templateFor("agreement.rejected")?.build(PAYLOADS["agreement.rejected"], contextFor(PAYEE, "Chidi"));
    expect(message?.text).toContain("The inspection photos do not show the kitchen");
    const bare = templateFor("agreement.rejected")?.build(
      { ...PAYLOADS["agreement.rejected"], reason: null },
      contextFor(PAYEE, "Chidi"),
    );
    expect(bare).toBeNull();
  });

  it("refuses a payload with no viewer rather than guessing a side", () => {
    const message = templateFor("agreement.approved")?.build(
      { ...PAYLOADS["agreement.approved"], viewer: "someone" },
      contextFor(PAYER, "Ada"),
    );
    expect(message).toBeNull();
  });
});

describe("the security messages", () => {
  it("puts the clock in Lagos on both of them", () => {
    /* 13:05 UTC is 14:05 in Lagos, which is UTC+1 all year. */
    const changed = templateFor("security.password_changed")?.build(
      PAYLOADS["security.password_changed"],
      contextFor(PAYER, "Ada"),
    );
    expect(changed?.text).toContain("14:05");
    const device = templateFor("security.new_device_sign_in")?.build(
      PAYLOADS["security.new_device_sign_in"],
      contextFor(PAYER, "Ada"),
    );
    expect(device?.text).toContain("14:05");
    expect(device?.text).toContain("Chrome on Android");
  });

  it("still sends when the device could not be named", () => {
    const message = templateFor("security.new_device_sign_in")?.build(
      { at: "2026-09-23T13:05:00.000Z", device: null },
      contextFor(PAYER, "Ada"),
    );
    expect(message).not.toBeNull();
    expect(message?.subject).toMatch(/new sign-in/i);
  });

  it("still sends when the timestamp is unusable, because the warning matters more", () => {
    const message = templateFor("security.password_changed")?.build(
      { at: "not a date" },
      contextFor(PAYER, "Ada"),
    );
    expect(message).not.toBeNull();
    expect(message?.subject).toContain("password was changed");
  });
});

describe("the inspection and the rung", () => {


  /**
   * ONE LEDGER ROW, TWO DOORS, AND THE WORDS MUST FOLLOW THE DOOR.
   *
   * A bank send writes the same `rm-wd-` entry a withdrawal does, because the
   * webhook settles only that prefix. Until 23 September the settlement email
   * therefore told somebody who had just sent rent to a landlord that their
   * WITHDRAWAL had not gone through.
   *
   * These two walk the SAME template with the same payload and differ only in
   * which entry the drain looked up, which is the only thing that differs in
   * production.
   */
  /*
   * THESE TWO TESTS USED TO ASSERT THE SEND-TO-A-BANK WORDING, and that door
   * was removed on 23 September. A test whose subject no longer exists is
   * deleted, but deleting it silently would lose the reason it was written,
   * so it is replaced by the assertion that now matters: there is ONE door,
   * and every row gets the withdrawal wording whatever the ledger says.
   *
   * This is the guard that would fail if somebody quietly reintroduced a
   * third-party send without reintroducing the words to go with it.
   */



  it("refuses an inspection with no property or no time", () => {
    expect(
      templateFor("inspection.scheduled")?.build(
        { ...PAYLOADS["inspection.scheduled"], slot_at: null },
        contextFor(PAYER, "Ada"),
      ),
    ).toBeNull();
    expect(
      templateFor("inspection.scheduled")?.build(
        { ...PAYLOADS["inspection.scheduled"], listing_id: "nope" },
        contextFor(PAYER, "Ada"),
      ),
    ).toBeNull();
  });

  it("never puts a phone number in an inspection email", () => {
    const message = templateFor("inspection.scheduled")?.build(
      PAYLOADS["inspection.scheduled"],
      contextFor(PAYER, "Ada"),
    );
    expect(message?.text).toContain("2 bedroom flat, Yaba");
    expect(message?.html).toContain("Chidi");
    expect(message?.text).not.toContain("Their number");
  });

  it("puts the enquirer's own words in the enquiry, and answers to the Messages switch", () => {
    const template = templateFor("listing.new_enquiry");
    /* The ONE template that honours a mute. Everything else here is a
       security obligation, a receipt, or an agreement the reader is party to,
       and none of those is switchable. */
    expect(template?.channel).toBe("messages");
    const message = template?.build(PAYLOADS["listing.new_enquiry"], contextFor(PAYER, "Ada"));
    expect(message?.subject).toContain("2 bedroom flat, Yaba");
    expect(message?.html).toContain("Is this flat still available");
    expect(message?.html).toContain("/messages/88888888-8888-4888-8888-888888888888");
  });

  it("sends no enquiry when the words could not be read", () => {
    expect(
      templateFor("listing.new_enquiry")?.build(
        { ...PAYLOADS["listing.new_enquiry"], message_id: "gone" },
        contextFor(PAYER, "Ada"),
      ),
    ).toBeNull();
  });

  it("offers the next rung the agent has not already passed", () => {
    expect(nextRungAfter("identity", ["identity"])).toBe("address");
    expect(nextRungAfter("identity", ["identity", "address"])).toBe("inspection");
    expect(nextRungAfter("inspection", ["identity", "address", "inspection"])).toBeNull();
    const message = templateFor("verification.rung_passed")?.build(
      PAYLOADS["verification.rung_passed"],
      contextFor(PAYER, "Ada"),
    );
    expect(message?.text).toContain("address");
  });
});
