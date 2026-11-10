/**
 * THE BANNERS (3 November 2026): the wide picture at the top of the card, made
 * from the founder's art and shown WHOLE (logo included, never cropped). It
 * takes the place of the small lockup band, so there is one logo, not two.
 * 1200x480 JPEGs (60 to 90 KB each) in `public/brand/email/banners/`.
 *
 *   email-banner-1   "Space, without the runaround." every ordinary email
 *   email-banner-2   "Safe from the first tap."      security and sign-in emails
 *   welcome-N        the welcome email
 *   newsletter-N     the newsletter
 *
 * Every email carries one, receipts and agreements included (4 November 2026,
 * the founder: no small logo bar anywhere). A banner is decoration with a real alt, never the
 * words of a message, and it is never a link.
 */
import type { EmailKind } from "./icons";

export const BANNER_DIR = "/brand/email/banners";
export const BANNER_FILE_WIDTH = 1200;
export const BANNER_FILE_HEIGHT = 480;
/** The card's inner width: 600 less 40 of padding each side. */
export const BANNER_SHOWN_WIDTH = 520;
export const BANNER_SHOWN_HEIGHT = Math.round((BANNER_SHOWN_WIDTH * BANNER_FILE_HEIGHT) / BANNER_FILE_WIDTH);
/** The card is 600 wide and the banner runs edge to edge. */
export const BANNER_SHOWN_WIDTH_FULL = 598;
export const BANNER_SHOWN_HEIGHT_FULL = Math.round((BANNER_SHOWN_WIDTH_FULL * BANNER_FILE_HEIGHT) / BANNER_FILE_WIDTH);

export type BannerFile =
  | "email-banner-1"
  | "email-banner-2"
  | "welcome-1"
  | "welcome-2"
  | "welcome-3"
  | "newsletter-1"
  | "newsletter-2"
  | "newsletter-3"
  | "listing-review"
  | "listing-live"
  | "verification"
  | "viewing"
  | "stay"
  | "table"
  | "support"
  | "message";

export function bannerFilePath(name: BannerFile): string {
  return `${BANNER_DIR}/${name}.jpg`;
}

export const BANNER_ALT: Readonly<Record<BannerFile, string>> = {
  "email-banner-1": "Vallo. Space, without the runaround.",
  "email-banner-2": "Vallo. A notice about your account.",
  "welcome-1": "Vallo. Welcome to Vallo.",
  "welcome-2": "Two worlds. One account.",
  "welcome-3": "Your first three steps.",
  "newsletter-1": "Why we are here.",
  "newsletter-2": "Where we are going.",
  "newsletter-3": "Ready to serve you.",
  "listing-review": "Vallo. Your listing is in review.",
  "listing-live": "Vallo. Your listing is live.",
  verification: "Vallo. Your verification, step by step.",
  viewing: "Vallo. See it before you commit.",
  stay: "Vallo. Your stay, sorted.",
  table: "Vallo. Your table is waiting.",
  support: "Vallo. We have your message.",
  message: "Vallo. You have a new message.",
};

/** Security and sign-in messages get the "safe" banner. */
const SECURITY_KINDS = new Set<string>([
  "verificationCode",
  "passwordReset",
  "passwordChanged",
  "emailRecoveryOpened",
  "emailRecoveryCompleted",
  "newDeviceSignIn",
  "paymentInstrumentChanged:card",
  "paymentInstrumentChanged:bank",
  "deletionStarted",
  "deletionCompleted",
  "scamRecall",
  "staffAccessGranted",
]);

const BY_KIND: Readonly<Record<string, BannerFile>> = {
  listingApproved: "listing-live",
  listingSubmitted: "listing-review",
  listingPassedReview: "listing-review",
  listingChangesRequested: "listing-review",
  listingRejected: "listing-review",
  agentApplicationApproved: "verification",
  agentApplicationRejected: "verification",
  agentApplicationNeedsMore: "verification",
  verificationRungPassed: "verification",
  verificationRungFailed: "verification",
  inspectionScheduled: "viewing",
  inspectionProposed: "viewing",
  inspectionDeclined: "viewing",
  inspectionWithdrawn: "viewing",
  inspectionCompleted: "viewing",
  bookingRequested: "stay",
  bookingRequestedHost: "stay",
  bookingConfirmed: "stay",
  stayArrivalDetails: "stay",
  bookingCancelled: "stay",
  bookingRefunded: "stay",
  refundRequested: "stay",
  bookingRequestClosed: "stay",
  stayReviewRequest: "stay",
  reservationConfirmed: "table",
  reservationCancelled: "table",
  newEnquiry: "support",
  supportTicketFiled: "support",
  supportReplied: "support",
  unreadMessages: "message",
  dealUpdate: "message",
};

/** Every email carries one: its own family's banner, the "safe" one for security, else the general one. */
export function bannerFor(kind: EmailKind): BannerFile {
  if (SECURITY_KINDS.has(kind)) return "email-banner-2";
  return BY_KIND[kind] ?? "email-banner-1";
}
