/**
 * The shape every auth form hands back, in a module of its own.
 *
 * ---------------------------------------------------------------------------
 * WHY IT MOVED OUT OF `actions.ts`, AND IT IS A RULE RATHER THAN A PREFERENCE.
 *
 * `lib/auth/actions.ts` carries `"use server"`. A `"use server"` module may
 * export async functions and NOTHING ELSE, not even a type re-export: every
 * export in such a file becomes a callable server endpoint in the client
 * bundle's eyes, and the compiler is entitled to refuse anything that is not
 * a function. `AuthFormState` and `AuthField` were exported from it and
 * imported by six components, which is the exact shape BUILD_06 ledger 10.7
 * names. It had not broken a build yet; it was a violation waiting for a
 * compiler version that enforces it.
 *
 * A plain module costs nothing and ends it. `actions.ts` imports these types
 * and exports async functions only; the six forms import from here.
 */

export type AuthField =
  | "firstName"
  | "surname"
  | "nickname"
  | "email"
  | "password"
  | "confirmPassword"
  | "hearAbout"
  | "stateCode"
  | "lgaCode"
  | "occupationCode"
  | "referralCode"
  /* The optional mobile number on sign-up, any country (2 November 2026). */
  | "phone"
  /* The six digits from the confirmation email. Part of the same union so the
     verify screen reports a bad code exactly the way every other field on
     every other auth form reports a bad value. */
  | "code"
  /* The current password, asked on /reset-password of any session that was
     not made by the recovery link in the last half hour. */
  | "currentPassword"
  /* The agreement tick on sign-up. It is in the union because the SERVER
     refuses a sign-up that does not carry the current terms version, and a
     server refusal has to be able to land on the control it is about. */
  | "acceptTerms"
  /* The 18-or-over tick on sign-up (STORE-19), refused by the server too. */
  | "ageConfirmed";

export type AuthFormState = {
  ok: boolean;
  /** Where to go once the verifying moment has been on screen long enough. */
  verified?: string;
  /** The first name the account was made with, for "You're in, Ada." on the
      moment after a code is accepted (A17). Absent when none was given. */
  name?: string;
  message?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
  /**
   * ONE WAY OUT, when the sentence alone cannot give it.
   *
   * Almost every auth refusal is answered by doing the same thing again: check
   * the password, open the link, wait a minute. A refusal whose answer is on
   * ANOTHER SCREEN is different, and a paragraph telling somebody to navigate
   * there is a worse control than a link.
   *
   * The case that created this: signing in during the account-deletion grace
   * window. The account is banned in GoTrue on purpose, so the auth layer
   * enforces "deactivated" rather than every screen remembering a flag, and
   * the cost is that the door had nothing to say and nowhere to point. The
   * restore code is in the confirmation email, but the sign-in form is the
   * second place a person looks and it was a dead end.
   *
   * Deliberately ONE action and not a list: a refusal with three ways out is a
   * refusal that has not decided what went wrong.
   */
  action?: { href: string; label: string };
};

/**
 * Whether an address is already registered, and by which method.
 *
 * Here for the same reason as the two above: it was exported from the
 * `"use server"` module. The reasoning about the enumeration oracle this
 * answers, and why the trade is bounded, stays beside the action in
 * `actions.ts`, because that is where the decision lives.
 */
export type EmailStatus = "none" | "email" | "google" | "unknown";

/** The result of following a confirmation link or typing its code. */
export type VerificationOutcome =
  | { ok: true; next: string }
  | { ok: false; reason: "expired" | "invalid" | "unconfigured" | "provider-off" };
