import type { Icon3DName } from "@/components/ui/icon-3d";

/**
 * THE OBJECT IN EVERY EMAIL'S HEADER, AND THE GLYPHS IN ITS ROWS (north star
 * 16.5 and D23).
 *
 * THE FOUNDER'S ORIGINAL 3D OBJECTS. Each message carries one of the founder's
 * 30 September 3D objects (royal blue clay, one orange accent), the same art
 * `Icon3D` draws in the product, chosen per message for what the message is
 * about (an envelope for a code, a contract for an agreement), the way an app
 * icon sits beside a notification. For a few days on 6 October 2026 these
 * were swapped for the matte "tier B" set; the founder asked for the original
 * 3D icons back, so they are back.
 *
 * PNG, NEVER WEBP. The site serves the cutouts as webp, which classic Outlook,
 * older Apple Mail and several webmails do not draw. The email copies are PNGs
 * in `public/brand/3d/email/<name>.png` (128px, drawn at 64, so every screen
 * gets 2x) beside `<name>@2x.png` (256px), cut from the same sources as the
 * webp files (`icon3dEmailSrc` in `components/ui/icon-3d.ts`).
 *
 * THE RECEIPT IS NEVER USED HERE: it carries a "$" coin, and Vallo's mail is
 * in naira.
 *
 * THE ALT IS THE FAMILY, A WORD (north star 16.5: "every image carries alt
 * text and a sensible fallback"). With images off the reader sees "Payment"
 * or "Account" in quiet type where the object would be, in a box of the
 * object's size, and the headline under it does the rest. A family word and
 * not the headline, so a screen reader does not read the subject twice.
 *
 * THE LINE GLYPHS in the key-value rows are the product's own UiIcon line
 * tier (stroke on a 24 grid, the family blue), rendered once to PNG at 3x
 * and drawn at 16px. They are decorative beside a label that says the same
 * thing, so their alt is empty: with images off the row is its words.
 *
 * The five Supabase auth templates (`scripts/build-auth-emails.mjs`, not this
 * module) carry the same 3D marks from `public/brand/3d/email/`.
 */

/**
 * THE QUIET LAYOUT (13 October 2026, the email redesign). One layout for every
 * message: the lockup, one headline, a short body, one button, a quiet details
 * block and the footer. The two decorations below are switched OFF so the page
 * has one thing to look at; the art, the mapping and the rendering code are all
 * kept, so putting either back is changing one of these two flags and nothing
 * else.
 *
 *   EMAIL_SHOWS_OBJECT      the founder's 3D object above the headline
 *   EMAIL_SHOWS_ROW_GLYPHS  the 16px line glyph before a details row's label
 */
export const EMAIL_SHOWS_OBJECT = false;
export const EMAIL_SHOWS_ROW_GLYPHS = false;

/** Every 3D object an email carries. Each has a PNG pair on disk (icons.test.ts). */
export const EMAIL_OBJECTS = [
  "envelope",
  "passcode-lock",
  "card-secure",
  "bank",
  "report-flag",
  "id-check",
  "rent",
  "buy",
  "keys",
  "home-small",
  "city",
  "explore",
  "clock",
  "celebrate",
  "list",
  "home-verified",
  "verified",
  "local-talks",
  "support",
  "calendar-booked",
  "calendar-pending",
  "contract",
  "shield",
  "bell",
  "pay",
  "earnings",
  "restaurant",
] as const satisfies readonly Icon3DName[];

export type EmailObject = (typeof EMAIL_OBJECTS)[number];

/** Every message the product sends, by the name its builder goes by. */
export type EmailKind =
  // Account and security
  | "verificationCode"
  | "passwordReset"
  | "passwordChanged"
  | "emailRecoveryOpened"
  | "emailRecoveryCompleted"
  | "newDeviceSignIn"
  | "paymentInstrumentChanged:card"
  | "paymentInstrumentChanged:bank"
  | "deletionStarted"
  | "deletionCompleted"
  | "scamRecall"
  | "staffAccessGranted"
  // Welcome, by the role somebody signed up as
  | "welcome:renter"
  | "welcome:buyer"
  | "welcome:landlord"
  | "welcome:seller"
  | "welcome:agent"
  | "welcome:unstated"
  // Listings, agents and verification
  | "listingSubmitted"
  | "listingApproved"
  | "listingRejected"
  | "listingPassedReview"
  | "listingChangesRequested"
  | "agentApplicationApproved"
  | "agentApplicationRejected"
  | "agentApplicationNeedsMore"
  | "verificationRungPassed"
  | "verificationRungFailed"
  // Enquiries and support
  | "newEnquiry"
  | "supportTicketFiled"
  | "supportReplied"
  // Viewings
  | "inspectionScheduled"
  | "inspectionProposed"
  | "inspectionDeclined"
  | "inspectionWithdrawn"
  | "inspectionCompleted"
  // Agreements and the guarantee
  | "agreementSubmitted"
  | "agreementWaiting"
  | "agreementApproved"
  | "agreementRejected"
  | "agreementCancelled"
  | "guaranteeClaimOpened"
  | "guaranteeClaimDecided"
  // Stays
  | "bookingRequested"
  | "bookingRequestedHost"
  | "bookingConfirmed"
  | "stayArrivalDetails"
  | "bookingCancelled"
  | "bookingRefunded"
  | "refundRequested"
  | "bookingRequestClosed"
  | "paymentHostReceived"
  | "paymentRentReceipt"
  | "stayReviewRequest"
  // Messages
  | "unreadMessages"
  // Offers and the Deal Room
  | "dealUpdate"
  // Tables
  | "reservationConfirmed"
  | "reservationCancelled"
  // Payments and receipts
  | "cryptoPayment"
  | "paymentReceipt";

/**
 * The families, each with the word that stands in for its object when images
 * are off, and the register its mail is drawn in (render.ts):
 *
 *   paper   money and documents, and every receipt: the white sheet stays
 *           white even in a dark-mode client (D23, D28.1)
 *   shell   notification and lifecycle: white here, the product's night in
 *           a dark-mode client
 */
export type EmailFamily =
  | "account"
  | "welcome"
  | "listing"
  | "message"
  | "support"
  | "viewing"
  | "agreement"
  | "stay"
  | "table"
  | "payment";

export type EmailRegister = "paper" | "shell";

export const FAMILY: Readonly<Record<EmailFamily, { alt: string; register: EmailRegister }>> = {
  account: { alt: "Account", register: "shell" },
  welcome: { alt: "Welcome", register: "shell" },
  listing: { alt: "Listing", register: "shell" },
  message: { alt: "Message", register: "shell" },
  support: { alt: "Support", register: "shell" },
  viewing: { alt: "Viewing", register: "shell" },
  agreement: { alt: "Agreement", register: "paper" },
  stay: { alt: "Stay", register: "shell" },
  table: { alt: "Table", register: "shell" },
  payment: { alt: "Payment", register: "paper" },
};

type Plan = { family: EmailFamily; object: EmailObject };
const p = (family: EmailFamily, object: EmailObject): Plan => ({ family, object });

/**
 * Which object and family each message carries. The object names what the
 * message is ABOUT and never claims more than its words: a submission waits
 * (the clock or the pending calendar), and only a passed check carries the
 * verified mark.
 */
export const EMAIL_PLAN: Readonly<Record<EmailKind, Plan>> = {
  verificationCode: p("account", "envelope"),
  passwordReset: p("account", "passcode-lock"),
  passwordChanged: p("account", "passcode-lock"),
  emailRecoveryOpened: p("account", "envelope"),
  emailRecoveryCompleted: p("account", "envelope"),
  newDeviceSignIn: p("account", "passcode-lock"),
  "paymentInstrumentChanged:card": p("account", "card-secure"),
  /* A payout account change (display only; nothing about payouts changes here). */
  "paymentInstrumentChanged:bank": p("account", "bank"),
  deletionStarted: p("account", "passcode-lock"),
  deletionCompleted: p("account", "passcode-lock"),
  /* The recall follows a report upheld against an account. */
  scamRecall: p("account", "report-flag"),
  staffAccessGranted: p("account", "id-check"),

  "welcome:renter": p("welcome", "rent"),
  "welcome:buyer": p("welcome", "buy"),
  "welcome:landlord": p("welcome", "keys"),
  "welcome:seller": p("welcome", "home-small"),
  "welcome:agent": p("welcome", "city"),
  "welcome:unstated": p("welcome", "explore"),

  /* Waiting on review. */
  listingSubmitted: p("listing", "clock"),
  /* The listing is live. */
  listingApproved: p("listing", "celebrate"),
  listingRejected: p("listing", "list"),
  listingPassedReview: p("listing", "home-verified"),
  listingChangesRequested: p("listing", "list"),
  agentApplicationApproved: p("listing", "verified"),
  agentApplicationRejected: p("listing", "id-check"),
  agentApplicationNeedsMore: p("listing", "id-check"),
  verificationRungPassed: p("account", "verified"),
  verificationRungFailed: p("account", "id-check"),

  newEnquiry: p("message", "local-talks"),
  supportTicketFiled: p("support", "support"),
  supportReplied: p("support", "support"),

  inspectionScheduled: p("viewing", "calendar-booked"),
  inspectionProposed: p("viewing", "calendar-pending"),
  inspectionDeclined: p("viewing", "calendar-pending"),
  inspectionWithdrawn: p("viewing", "calendar-pending"),
  inspectionCompleted: p("viewing", "home-verified"),

  agreementSubmitted: p("agreement", "contract"),
  agreementWaiting: p("agreement", "contract"),
  agreementApproved: p("agreement", "contract"),
  agreementRejected: p("agreement", "contract"),
  agreementCancelled: p("agreement", "contract"),
  /* A claim on the guarantee is money under protection: the shield. */
  guaranteeClaimOpened: p("payment", "shield"),
  guaranteeClaimDecided: p("payment", "shield"),

  bookingRequested: p("stay", "calendar-pending"),
  /* A host with a request waiting on them: the bell. */
  bookingRequestedHost: p("stay", "bell"),
  bookingConfirmed: p("stay", "calendar-booked"),
  stayArrivalDetails: p("stay", "keys"),
  bookingCancelled: p("stay", "pay"),
  /* Money coming back to somebody: the open hand with the naira coin. */
  bookingRefunded: p("payment", "earnings"),
  refundRequested: p("payment", "earnings"),
  /* Money reaching a host: the open hand with the naira coin. */
  bookingRequestClosed: p("stay", "calendar-pending"),
  paymentHostReceived: p("payment", "earnings"),
  paymentRentReceipt: p("payment", "pay"),
  stayReviewRequest: p("stay", "calendar-booked"),
  dealUpdate: p("message", "envelope"),
  unreadMessages: p("message", "local-talks"),

  reservationConfirmed: p("table", "restaurant"),
  reservationCancelled: p("table", "restaurant"),

  /* The plain coin reads as a blank disc at 64px; the wallet says payment. */
  cryptoPayment: p("payment", "pay"),
  /* Not the receipt object: it carries a "$" coin beside a naira sum. */
  paymentReceipt: p("payment", "pay"),
};

/** The object a message carries, or null for a kind this module does not know. */
export function emailObjectFor(kind: EmailKind): EmailObject | null {
  return (EMAIL_PLAN[kind] as Plan | undefined)?.object ?? null;
}

/** The family a message belongs to, or null for a kind this module does not know. */
export function emailFamilyOf(kind: EmailKind): EmailFamily | null {
  return (EMAIL_PLAN[kind] as Plan | undefined)?.family ?? null;
}

/** Paper for money and documents, the shell for everything else. */
export function emailRegisterOf(kind: EmailKind): EmailRegister {
  const family = emailFamilyOf(kind);
  return family ? FAMILY[family].register : "shell";
}

/** Site path of an object's 128px PNG (the founder's original 3D art). */
export function emailObjectPath(name: EmailObject): string {
  return `/brand/3d/email/${name}.png`;
}

/** The drawn size of the header object, in CSS pixels. The 128px file gives 2x. */
export const EMAIL_OBJECT_SIZE = 64;

/**
 * The line glyphs a key-value row may carry, by what the row is about, each
 * a UiIcon line glyph (render it with the build script to add one).
 */
export const EMAIL_GLYPHS = {
  calendar: "calendar-booking",
  people: "users",
  home: "home",
  place: "location",
  money: "banknote",
  receipt: "file-check",
  time: "clock",
  check: "circle-check",
  card: "credit-card",
  shield: "shield-check",
  key: "key",
  document: "file-text",
  bank: "bank",
  info: "info",
  status: "hourglass",
  phone: "phone",
} as const;

export type EmailGlyph = keyof typeof EMAIL_GLYPHS;

/** Site path of a glyph's PNG (48px, drawn at 16, so 3x). */
export function emailGlyphPath(glyph: EmailGlyph): string {
  return `/brand/email/glyphs/${glyph}.png`;
}

export const EMAIL_GLYPH_SIZE = 16;
