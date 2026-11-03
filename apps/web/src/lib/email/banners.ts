/**
 * THE BANNERS (3 November 2026): wide pictures under the lockup, made from the
 * founder's art. The art arrives 2.5 to 1 with the logo at the top; the logo
 * is cropped off because the lockup band is right above it, leaving 1200x350
 * JPEGs (about 50 KB each) in `public/brand/email/banners/`.
 *
 *   email-banner-1   "Space, without the runaround." every ordinary email
 *   email-banner-2   "Safe from the first tap."      security and sign-in emails
 *   welcome-N        the welcome email
 *   newsletter-N     the newsletter
 *
 * Money and document emails (the paper register) carry none: a receipt is not
 * the place for a picture. A banner is decoration with a real alt, never the
 * words of a message, and it is never a link.
 */
import type { EmailKind } from "./icons";

export const BANNER_DIR = "/brand/email/banners";
export const BANNER_FILE_WIDTH = 1200;
export const BANNER_FILE_HEIGHT = 350;
/** The card's inner width: 600 less 40 of padding each side. */
export const BANNER_SHOWN_WIDTH = 520;
export const BANNER_SHOWN_HEIGHT = Math.round((BANNER_SHOWN_WIDTH * BANNER_FILE_HEIGHT) / BANNER_FILE_WIDTH);

export type BannerFile =
  | "email-banner-1"
  | "email-banner-2"
  | "welcome-2"
  | "welcome-3"
  | "newsletter-1"
  | "newsletter-2"
  | "newsletter-3";

export function bannerFilePath(name: BannerFile): string {
  return `${BANNER_DIR}/${name}.jpg`;
}

export const BANNER_ALT: Readonly<Record<BannerFile, string>> = {
  "email-banner-1": "Vallo. Space, without the runaround.",
  "email-banner-2": "Vallo. Safe from the first tap.",
  "welcome-2": "Two worlds. One account.",
  "welcome-3": "Your first three steps.",
  "newsletter-1": "Why we are here.",
  "newsletter-2": "Where we are going.",
  "newsletter-3": "Ready to serve you.",
};

/** Security and sign-in messages get the "safe" banner; the rest the general one. */
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

export function bannerFor(kind: EmailKind): BannerFile {
  return SECURITY_KINDS.has(kind) ? "email-banner-2" : "email-banner-1";
}
