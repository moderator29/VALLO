import { withNext } from "./next-link";

/**
 * A SIGN-IN REFUSED BECAUSE THE ADDRESS IS NOT CONFIRMED YET (22 November 2026).
 *
 * THE DEFECT THIS ENDS. A real estate agent made an account with a business
 * development officer beside him, then tried to sign in. GoTrue refused with
 * "Email not confirmed", and the screen said "Confirm your email first. Open
 * the link we sent you, then sign in." The email he had was the one the Send
 * Email Hook sends (`app/api/auth/email-hook`, `verificationCode`): a code and
 * nothing to click, by the founder's brief of 29 October. So the sentence sent
 * him to look for a link that did not exist, and the sign-in screen had no box
 * for the code he was holding. That held two people for hours.
 *
 * So the refusal is not a sentence any more. `signInWithEmail` remembers the
 * address, sends a fresh code (an hour old one has expired) and goes straight
 * to the code screen for that address, which also offers a resend.
 *
 * WHY THIS IS NOT AN ENUMERATION ORACLE. GoTrue checks the password BEFORE it
 * says "Email not confirmed", so only somebody who typed the right password
 * for the address ever reaches the code screen this way. A stranger still gets
 * the neutral "do not match" sentence.
 *
 * Pure, in a plain module, so the rule is a unit test and the `"use server"`
 * actions module exports only async functions.
 */
export function isUnconfirmedEmailError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === "email_not_confirmed") return true;
  return typeof message === "string" && /email not confirmed/i.test(message);
}

/** The `?from=` value the code screen reads to say why the person is there. */
export const FROM_SIGN_IN = "sign-in";

/**
 * The code screen for an address that tried to sign in before confirming,
 * keeping where the person was going. `next` goes through the one return-path
 * guard (`withNext`), so this can never become an open redirect.
 */
export function unconfirmedVerifyHref(next: string | null | undefined): string {
  const base = withNext("/sign-up/verify", next);
  return `${base}${base.includes("?") ? "&" : "?"}from=${FROM_SIGN_IN}`;
}
