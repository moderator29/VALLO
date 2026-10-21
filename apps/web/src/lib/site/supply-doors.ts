import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { PhotoName } from "@/lib/site/photos";
import { VERIFICATION_ORDER } from "@/lib/trust/verification";
import { STAYS_DOORS } from "@/lib/host/doors";
import {
  WHO_PAYS_SENTENCE,
  HOST_PAYOUT_STEP,
  NO_CUSTODY_SENTENCE,
  NO_INSPECTION_FEE,
  PAYMENT_GATE_SENTENCE,
  PAYOUT_ANSWER,
} from "@/lib/money/copy";

/**
 * A9. THE FRONT DOOR FOR SUPPLY, AS DATA: `/for-agents`, `/for-hosts` and
 * `/for-landlords`.
 *
 * "Become an agent" used to redirect a stranger to a sign-in wall with no
 * word about what listing costs, what is looked at, or how payouts arrive.
 * These three pages say it, and every fact is read from the module that
 * enforces it rather than written again:
 *
 *   the steps        `lib/supply/registration.ts` (the four screens per role)
 *                    and `lib/host/doors.ts` (the three stays doors);
 *   what is looked at  `lib/trust/verification.ts` (the four rungs, with the
 *                    evidence a reviewer looks at);
 *   money            `lib/money/copy.ts`, the one source for every sentence
 *                    about money, and the live rates (`lister-fees.ts`);
 *   stays refunds    the host's preset (`lib/host/cancellation-presets.ts`).
 *
 * English only for now, like `/safety` and `/standards`; the three languages
 * follow when the public site gets its locale paths (A10).
 *
 * THE CLAIMS RULE. No page says a person is "verified" by signing up: the
 * ladder is described as what a reviewer looks at, and what Vallo does NOT do
 * is stated beside it.
 */

export type SupplyRole = "agent" | "host" | "landlord";

export type SupplyStep = { icon: UiIconName; title: string; body: string };

export type SupplyDoor = {
  role: SupplyRole;
  path: `/for-${"agents" | "hosts" | "landlords"}`;
  plate: PhotoName;
  chip: string;
  title: string;
  lede: string;
  metaDescription: string;
  /** Where the setup lives; the Start buttons carry it through sign-up as `next`. */
  setupPath: string;
  steps: SupplyStep[];
  payout: string[];
  checks: string[];
  notDone: string[];
  example: { title: string; sub: string; value: string }[];
  /** Three short facts under the head's buttons, each a sentence below in short. */
  facts: [string, string, string];
  /** The questions, each answered by a sentence the product enforces. */
  faq: { q: string; a: string }[];
};

const LADDER_LINES = VERIFICATION_ORDER.map((rung) => `${rung.label}: ${rung.evidence}`);

const LISTING_REVIEW = "A person at Vallo reviews each listing before it goes live, and can send it back with a reason.";

const ONE_ACCOUNT = "Yes. It is one account for renting, staying and listing, with one inbox. You switch sides from your profile.";

/*
 * ONE NO-CUSTODY SENTENCE PER CARD (C6, the route sweep). Each door's payout
 * card used to print PAYOUT_ANSWER and then NO_CUSTODY_SENTENCE, which is the
 * payer's sentence ("When you pay, the owner's or agent's share goes...") read
 * by the person being paid; and "what Vallo does not do" said it a third time,
 * in a sentence written here rather than in lib/money/copy.ts. PAYOUT_ANSWER
 * already says Vallo never holds the share and there is nothing to withdraw,
 * so the card prints it alone and the third sentence is gone. The question
 * "Does Vallo hold the money?" still answers with NO_CUSTODY_SENTENCE.
 */

const NO_CAP =
  "Vallo does not set or cap your fees. It prints the fees you state on the listing, beside the published rule where a state has one, so renters can compare.";

export const SUPPLY_DOORS: Record<SupplyRole, SupplyDoor> = {
  agent: {
    role: "agent",
    path: "/for-agents",
    plate: "tower-entrance-dusk",
    chip: "For agents",
    title: "List on Vallo as an agent",
    lede: "Renters on Vallo see the move-in total before they call you, and anybody can check your Vallo code before they pay. Here is how it works, what it costs and how you are paid.",
    metaDescription:
      "How agents list on Vallo: the steps, what it costs, how payouts arrive, and what Vallo looks at before your profile goes up the ladder.",
    setupPath: "/profile/setup/agent",
    steps: [
      { icon: "user", title: "Create your account", body: "With your email, Google or Apple. It is one account for renting, staying and listing." },
      {
        icon: "id-card",
        title: "Set up your agent profile",
        body: "Four short screens: who you are, your identity (NIN or a government ID), the fees you charge, and a summary to confirm.",
      },
      {
        icon: "shield-check",
        title: "Go up the ladder",
        body: "Four steps, each decided by a person at Vallo: identity, address, a payout account in your own name, and meeting in person. Each one shows on your profile once it is passed.",
      },
      { icon: "house", title: "List your properties", body: `Add the rent, every fee and the move-in total. ${LISTING_REVIEW}` },
      {
        icon: "chat-bubble",
        title: "Get enquiries and inspections",
        body: `Renters message you inside Vallo and book an inspection. ${NO_INSPECTION_FEE}`,
      },
      { icon: "banknote", title: "Get paid", body: `${PAYMENT_GATE_SENTENCE} Then the renter pays through Vallo and your share goes to your bank.` },
    ],
    payout: [PAYOUT_ANSWER],
    checks: [...LADDER_LINES, LISTING_REVIEW],
    notDone: [
      NO_CAP,
      "Passing a step says what a reviewer looked at on that date. It is not a promise about every deal you do.",
    ],
    example: [
      { title: "Enquiry: 2 bedroom flat, Yaba", sub: "Asked about the move-in total", value: "New" },
      { title: "Inspection: Saturday 10:00", sub: "Mini flat, Surulere", value: "Booked" },
      { title: "Agreement: 3 bedroom duplex", sub: "Waiting for the renter to confirm", value: "Draft" },
    ],
    facts: ["No inspection fee for renters", "Paid straight to your bank", "A person reviews each listing"],
    faq: [
      { q: "When do I get paid?", a: PAYOUT_ANSWER },
      { q: "Does Vallo hold the money?", a: NO_CUSTODY_SENTENCE },
      { q: "Do renters pay to inspect?", a: NO_INSPECTION_FEE },
      { q: "Does Vallo set my agency fee?", a: NO_CAP },
      { q: "Can I rent or book stays with the same account?", a: ONE_ACCOUNT },
    ],
  },

  host: {
    role: "host",
    path: "/for-hosts",
    plate: "resort-pool-deck",
    chip: "For hosts",
    title: "Host stays on Vallo",
    lede: "Hotels, shortlets and restaurants take bookings on Vallo with the same account and the same inbox guests already use. Here is how it works and how you are paid.",
    metaDescription:
      "How hotels, shortlet hosts and restaurants take bookings on Vallo: the steps, what it costs, how payouts arrive and how cancellations work.",
    setupPath: "/profile/setup?side=stays",
    steps: [
      { icon: "user", title: "Create your account", body: "With your email, Google or Apple. It is one account for renting, staying and hosting." },
      {
        icon: "building-hotel",
        title: "Choose your door",
        body: STAYS_DOORS.map((door) => `${door.title}: ${door.meaning}`).join(" "),
      },
      {
        icon: "picture",
        title: "Add your place",
        body: `Photos, rooms or tables, rates and your cancellation terms. ${LISTING_REVIEW}`,
      },
      {
        icon: "calendar-check",
        title: "Accept bookings",
        body: "A guest asks for dates. When you accept, the agreement is drawn up from your own rates, and the guest pays through Vallo.",
      },
      { icon: "banknote", title: "Get paid", body: HOST_PAYOUT_STEP },
    ],
    payout: [PAYOUT_ANSWER],
    checks: [...LADDER_LINES, LISTING_REVIEW],
    notDone: [
      "You pick Flexible, Moderate, Firm or Strict, and every guest sees its refund steps before they book. The refund follows the policy on the booking, counted in Lagos time from your check-in time.",
    ],
    example: [
      { title: "Booking request: 2 nights", sub: "Deluxe room, Victoria Island", value: "New" },
      { title: "Arriving today", sub: "Studio apartment, Lekki", value: "Confirmed" },
      { title: "Table for 4, Friday 19:30", sub: "Reservation request", value: "New" },
    ],
    facts: ["Bookings in the inbox guests use", "Paid straight to your bank", "A person reviews each listing"],
    faq: [
      { q: "When do I get paid?", a: PAYOUT_ANSWER },
      { q: "Does Vallo hold the money?", a: NO_CUSTODY_SENTENCE },
      {
        q: "What happens when a guest cancels?",
        a: "You pick Flexible, Moderate, Firm or Strict, and every guest sees its refund steps before they book. The refund follows the policy on the booking, counted in Lagos time from your check-in time.",
      },
      { q: "What does a guest pay?", a: WHO_PAYS_SENTENCE },
      { q: "Can I rent or book stays with the same account?", a: ONE_ACCOUNT },
    ],
  },

  landlord: {
    role: "landlord",
    path: "/for-landlords",
    plate: "villa-exterior-gate",
    chip: "For landlords",
    title: "Let your property on Vallo",
    lede: "List your own property, with or without an agent, and let renters see the whole move-in cost before they call. Here is how it works and how you are paid.",
    metaDescription:
      "How property owners let on Vallo: the steps, the documents you can add, what it costs, how rent arrives and what Vallo looks at.",
    setupPath: "/profile/setup/owner",
    steps: [
      { icon: "user", title: "Create your account", body: "With your email, Google or Apple. It is one account for renting, staying and letting." },
      {
        icon: "location",
        title: "Tell us about you and the property",
        body: "Four short screens: you, where the property is, what you hold on it, and a summary to confirm.",
      },
      {
        icon: "certificate",
        title: "Add a document if you have one",
        body: "A Certificate of Occupancy, a Deed of Assignment, a Governor's Consent, a survey plan or a utility bill. If you hold none of these, \"I have none of these\" is an answer that still lets you list.",
      },
      { icon: "house", title: "List the property", body: `Add the rent, every fee and the move-in total. ${LISTING_REVIEW}` },
      {
        icon: "chat-bubble",
        title: "Meet renters",
        body: `Renters message you inside Vallo, inspect, and submit an inspection report. ${NO_INSPECTION_FEE}`,
      },
      { icon: "banknote", title: "Get paid", body: `${PAYMENT_GATE_SENTENCE} Then the renter pays through Vallo and your share goes to your bank.` },
    ],
    payout: [PAYOUT_ANSWER],
    checks: [...LADDER_LINES, LISTING_REVIEW],
    notDone: [
      "Without a title document your listing still goes up, but it never carries an ownership mark. Nothing else changes.",
      NO_CAP,
    ],
    example: [
      { title: "Enquiry: 3 bedroom flat, Gwarinpa", sub: "Asked to inspect this week", value: "New" },
      { title: "Inspection report submitted", sub: "8 items with photographs", value: "Ready" },
      { title: "Agreement: yearly tenancy", sub: "Waiting for Vallo's approval", value: "Review" },
    ],
    facts: ["No inspection fee for renters", "Paid straight to your bank", "List with or without an agent"],
    faq: [
      { q: "When do I get paid?", a: PAYOUT_ANSWER },
      { q: "Does Vallo hold the money?", a: NO_CUSTODY_SENTENCE },
      {
        q: "Can I list without a title document?",
        a: "Yes. Without a title document your listing still goes up, but it never carries an ownership mark. Nothing else changes.",
      },
      { q: "Does Vallo set the fees?", a: NO_CAP },
      { q: "Can I rent or book stays with the same account?", a: ONE_ACCOUNT },
    ],
  },
};

export const SUPPLY_ROLES: readonly SupplyRole[] = ["agent", "host", "landlord"];
