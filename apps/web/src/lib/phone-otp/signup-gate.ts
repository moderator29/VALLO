/**
 * A NEW ACCOUNT CONFIRMS A MOBILE NUMBER BEFORE IT USES VALLO (29 October
 * 2026, the founder: "on sign up the phone number verification should be
 * included, must").
 *
 * The rule, pure so the edge and the pages read one answer:
 *
 *   - only accounts made on or after `SIGNUP_PHONE_FROM` owe it, so nobody who
 *     already uses Vallo is stopped at a door they never agreed to;
 *   - it is owed only while a code can actually ARRIVE: the confirmation switch
 *     is on and an SMS vendor is wired. Asking for a code that cannot be sent
 *     would lock every new member out, so with no vendor the step simply does
 *     not appear, and the day the vendor's keys are set it starts to;
 *   - the two QA accounts are never asked (founder's ruling, 13 October);
 *   - a number already confirmed on the account settles it.
 */
export const SIGNUP_PHONE_FROM = "2026-10-29T00:00:00Z";

/** Where the step lives. Inside `(auth)`, so no app shell or passcode lock. */
export const SIGNUP_PHONE_PATH = "/sign-up/phone";

export function signupPhoneOwed(facts: {
  createdAt: string | null | undefined;
  confirmed: boolean;
  flagOn: boolean;
  transportReady: boolean;
  qa: boolean;
}): boolean {
  if (facts.qa || facts.confirmed || !facts.flagOn || !facts.transportReady) return false;
  const made = facts.createdAt ? Date.parse(facts.createdAt) : Number.NaN;
  if (!Number.isFinite(made)) return false;
  return made >= Date.parse(SIGNUP_PHONE_FROM);
}
