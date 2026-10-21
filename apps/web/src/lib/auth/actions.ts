"use server";

import { safeReturnPath } from "@/lib/security/return-path";
import { withNext } from "./next-link";
import { emailFromQuery } from "@/components/auth/auth-intent";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordChangeProof } from "./password-change-proof";
import { reauthenticate } from "@/lib/account-deletion/reauthenticate";
import { createClientWithAgent } from "@/lib/security/agent-client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consume,
  ipFromHeaders,
  subjectForEmail,
  subjectForIp,
} from "@/lib/security/rate-limit";
import { recordAlert } from "@/lib/alerts";
import { recordTermsAcceptance } from "@/lib/legal/acceptance";
import { TERMS_VERSION } from "@/lib/legal/versions";
import { ageConfirmed, ageRefusal, termsRefusal } from "./terms-gate";
import { welcomeOnce } from "@/lib/notify/welcome";
import { authOrigin } from "@/lib/site";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@vallo/i18n";
import type { Dictionary } from "@vallo/i18n/core";
import {
  getProviderStates,
  providerAllowed,
  resolveProviderStates,
  socialProviderOfSession,
  surfaceFromUserAgent,
} from "./providers";
import { HEAR_ABOUT_VALUES, REFERRAL_CODE_RE } from "./signup-options";
import { CONFIRMATION_CODE_LENGTH, CONFIRMATION_CODE_RE } from "./confirmation-code";
import {
  deactivatedAccountNotice,
  isDeactivatedAccountError,
} from "./deactivated-notice";
import { isGlobalDoneFlag } from "@/lib/ui/success-moments";
import { rememberSuccess } from "@/lib/ui/success-cookie";
import { doneFlagForLinkType } from "./link-moment";
import { finishSetupHref, SETUP_DONE_CLAIM } from "./finish-setup";
import { setupOnRecord, setupStillOwed } from "./finish-setup-server";
import { contentRefusal } from "@/lib/safety/content-refusal";
import { claimInviteFromCookie, inviteCodeFromCookie } from "@/lib/referral/server";
import { recordFunnelStep } from "@/lib/funnel/record";
import type {
  AuthField,
  AuthFormState,
  EmailStatus,
  VerificationOutcome,
} from "./form-state";

/*
 * THE TWO TYPES THIS FILE USED TO EXPORT NOW LIVE IN `./form-state`.
 *
 * A `"use server"` module may export async functions and nothing else, not
 * even a type re-export (BUILD_06 ledger 10.7). These were exported from here
 * and imported by six components. Moving them costs nothing and ends a
 * violation that had not bitten yet.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Two letters. `public.states` is keyed by code, and Lagos is LA. */
const STATE_CODE_RE = /^[A-Z]{2}$/;
/** `<state>_<name>`, lower cased, for example `la_ikeja`. */
const LGA_CODE_RE = /^[a-z]{2}_[a-z0-9_]{2,60}$/;
const OCCUPATION_CODE_RE = /^[a-z0-9_]{2,60}$/;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/**
 * Server side validation for the email flows.
 *
 * Validation is real and runs on the server, because client validation is a
 * convenience and never a control (Master Rule 48 applied to input generally).
 * When the auth backend is not configured the action says so plainly instead of
 * pretending the account was created.
 */
type Refusals = Dictionary["experienceEntry"]["refusals"];

/**
 * THE WORDS OF A REFUSAL ARE THE DICTIONARY'S (U1, 6 October): each one says
 * what went wrong and the single next action (`experienceEntry.refusals`).
 * Read in the reader's language; outside a request (a unit test calling an
 * action directly) there is no cookie to read, and English answers.
 */
async function refusals(): Promise<Refusals> {
  let locale: Awaited<ReturnType<typeof getLocale>> | undefined;
  try {
    locale = await getLocale();
  } catch {
    locale = undefined;
  }
  return getDictionary(locale ?? "en").experienceEntry.refusals;
}

function validateCredentials(
  formData: FormData,
  w: Refusals,
  purpose: "sign-in" | "sign-up" = "sign-up",
): Partial<Record<AuthField, string>> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");

  const errors: Partial<Record<AuthField, string>> = {};

  if (!email) errors.email = w.emailMissing;
  else if (email.length > 254) errors.email = w.emailTooLong;
  else if (!EMAIL_RE.test(email)) errors.email = w.emailInvalid;

  if (!password) errors.password = w.passwordMissing;
  /* UX-28: the length rule is a sign-up rule. On sign-in a short password is
     simply a wrong one, and the server says so in the same words as any other. */
  else if (purpose === "sign-up" && password.length < 8) errors.password = w.passwordShort;
  else if (password.length > 200) errors.password = w.passwordTooLong;

  return errors;
}

function validateSignUp(formData: FormData, w: Refusals): Partial<Record<AuthField, string>> {
  const errors = validateCredentials(formData, w);

  const firstName = field(formData, "firstName").trim();
  const surname = field(formData, "surname").trim();
  const nickname = field(formData, "nickname").trim();
  const confirmPassword = field(formData, "confirmPassword");
  const hearAbout = field(formData, "hearAbout");
  const stateCode = field(formData, "stateCode").trim().toUpperCase();
  const lgaCode = field(formData, "lgaCode").trim().toLowerCase();
  const occupationCode = field(formData, "occupationCode").trim().toLowerCase();
  const referralCode = field(formData, "referralCode").trim();

  if (!firstName) errors.firstName = "Enter your first name.";
  else if (firstName.length > 80) errors.firstName = "That first name is too long.";

  if (!surname) errors.surname = "Enter your surname.";
  else if (surname.length > 80) errors.surname = "That surname is too long.";

  // Nickname is optional; only its length is bounded when supplied.
  if (nickname.length > 40) errors.nickname = "Keep your nickname under 40 characters.";

  /* A1 (30 September): sign up is one screen, and the second password
     field is gone (show and hide, and the reset flow, cover the typo it
     guarded against). A post that still carries one is held to it. */
  if (!errors.password && confirmPassword && confirmPassword !== field(formData, "password")) {
    errors.confirmPassword = w.passwordsDiffer;
  }

  /* The English value, never the translated label. The select posts the one
     and shows the other, so this check is the same in all four languages. */
  /*
   * NO ACCOUNT WITHOUT AN AGREEMENT, AND THE SERVER DECIDES IT.
   *
   * This was enforced in the browser alone. `EmailAuthForm` called
   * `preventDefault()` when the tick was missing, `AcceptTerms` rendered the
   * hidden `termsVersion` only once it was ticked, and the form carries
   * `noValidate`, so there was not even a native `required` behind the
   * JavaScript. A request assembled by hand, or a browser running no script,
   * arrived here with no version and THE ACCOUNT WAS CREATED, with null
   * recorded where the agreement should be. The comment at the metadata was
   * honest about recording nothing rather than a falsehood, which is right,
   * and it answered the wrong question: the fault was not how an absent
   * agreement is recorded, it is that an account existed without one.
   *
   * The test that was supposed to cover this asserted that
   * `EmailAuthForm.tsx` CONTAINS the string `setAcceptError(true)`. It would
   * pass with the submit never stopped. That is a mirror, and this is the
   * behaviour it was standing in front of.
   *
   * The VERSION is checked and not the tick, because a tick says only that
   * something was agreed and a version says what. A stale one is refused too:
   * somebody sitting on a form opened before the documents changed has not
   * agreed to the documents we would then record against their name.
   */
  /* The rule itself lives in `lib/auth/terms-gate.ts` so a test can CALL it.
     It cannot be exported from here: this is a "use server" module and may
     export nothing that is not an async function, which is why the test that
     stood in front of it was reading markup as text. */
  const refusal = termsRefusal(field(formData, "termsVersion"));
  if (refusal) errors.acceptTerms = refusal;
  const underAge = ageRefusal(field(formData, "ageConfirmed"));
  if (underAge) errors.ageConfirmed = underAge;

  /* A1: optional, and asked after the account exists (the interests step
     on /welcome). Supplied, it must be one of the listed answers. */
  if (hearAbout && !HEAR_ABOUT_VALUES.includes(hearAbout))
    errors.hearAbout = "Choose one of the listed options.";

  /* Codes, not names. `profiles.state_code` and `profiles.lga_code` are keyed
     to `public.states` and `public.local_governments`, and the signup trigger
     checks both against those tables before writing either, so the shape check
     here is only about catching a mangled post early. */
  /* A1: where somebody stays is asked after the account exists, like the
     rest; supplied here (an older form), it is still checked. */
  if (stateCode !== "" && !STATE_CODE_RE.test(stateCode))
    errors.stateCode = "Choose the state you stay in.";
  if (lgaCode !== "" && !LGA_CODE_RE.test(lgaCode))
    errors.lgaCode = "Choose a local government from the list.";
  if (lgaCode !== "" && stateCode === "")
    errors.stateCode = "Choose your state before your local government.";
  if (occupationCode !== "" && !OCCUPATION_CODE_RE.test(occupationCode))
    errors.occupationCode = "Choose what you do from the list.";

  // Referral code is optional; when supplied it must at least look like one.
  if (referralCode && !REFERRAL_CODE_RE.test(referralCode))
    errors.referralCode = "Referral codes are 4 to 24 letters, numbers or hyphens.";

  return errors;
}

function emailConfigured(): boolean {
  return getProviderStates().some((p) => p.id === "email" && p.configured);
}

/* "We cannot reach accounts right now", now `refusals.notConnected`. */

/**
 * Translate a Supabase auth error into something a person can act on.
 *
 * Supabase deliberately keeps sign-in failures vague to avoid confirming which
 * email addresses exist, and that is the right behaviour to preserve, so the
 * credentials case stays deliberately non-specific about which half was wrong.
 */
function authMessage(raw: string, w: Refusals): string {
  const text = raw.toLowerCase();
  if (text.includes("invalid login credentials")) {
    /* One neutral sentence whether or not an account uses the address (F-08):
       the password step never says which it was. */
    return w.credentials;
  }
  if (text.includes("email not confirmed")) {
    return w.unconfirmed;
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return w.taken;
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return w.rateLimited;
  }
  if (text.includes("password")) {
    return w.passwordRefused;
  }
  return w.generic;
}

/* -------------------------------------------------------------- throttling */

/**
 * The door, counted.
 *
 * Supabase applies its own limits at the auth endpoint, and they are the last
 * line rather than the first: they are shared across the whole project, tuned
 * for its own protection rather than this platform's, and they are not reached
 * at all by an attempt this file refuses on validation. These three actions are
 * the ones worth counting here, because each is reachable with no session and
 * each one costs something real: a sign-in attempt is a password guess, a
 * sign-up writes a row and sends mail, a reset sends mail to an address the
 * request chose.
 *
 * WHY A RESET IS COUNTED BY ADDRESS. It protects the owner of that address
 * from having their inbox used as a weapon, and costs them nothing, because a
 * throttled reset never stops them signing in normally.
 *
 * SIGN-IN IS COUNTED BOTH WAYS, AND THE SECOND COUNT WAS ADDED ON 22 SEPTEMBER
 * 2026 AFTER A MEASUREMENT. This comment used to argue that sign-in must NEVER
 * be counted per address, because anybody who knows somebody's email could
 * spend the allowance on purpose and hold them out of their own account. That
 * argument is correct about a TIGHT per-address limit and it left a hole the
 * per-connection count cannot cover: ten guesses a minute from one place is
 * ten guesses a minute from EACH place, so a botnet had UNLIMITED guesses
 * against any one account on a platform that holds people's wallet balances.
 * Unlimited guessing is the larger of the two harms, and it is the one an
 * attacker can act on without knowing anything about the victim except their
 * address, which they already needed for the denial.
 *
 * So the address ceiling is set where no person can reach it and a guessing
 * run hits it immediately: SIXTY attempts an hour. A person signing in sixty
 * times in an hour from one address does not exist; a stuffing run spends that
 * in seconds. The denial it creates is real and it is bounded to the window,
 * it is recorded as a risk alert the moment it trips so nobody has to guess
 * why somebody cannot get in, and it is smaller than the denial the reset
 * limiter three lines down has always accepted.
 *
 * THIS IS A TRADE AND IT IS THE FOUNDER'S TO REVERSE. Both halves are written
 * out here rather than one of them being quietly chosen, because the previous
 * decision went the other way and a reader deserves to know that.
 */
/**
 * How many sign-in attempts one email address may make in an hour, from
 * anywhere at all. Set where no person reaches it and a guessing run hits it
 * at once. See the argument above.
 */
const SIGN_IN_PER_ADDRESS_HOURLY = 60;

async function throttle(
  bucket: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<AuthFormState | null> {
  const verdict = await consume({ bucket, subject, limit, windowSeconds });
  if (verdict.allowed) return null;
  return {
    ok: false,
    message: (await refusals()).tooMany.replace("{when}", verdict.retryIn),
  };
}

async function callerIp(): Promise<string> {
  return ipFromHeaders(await headers());
}


/**
 * Where to land after signing in.
 *
 * The middleware sends somebody who reached a product address without a
 * session to /sign-in with `next` carrying where they were going, and this is
 * the half that honours it. Without this every sign-in landed on /home, so a
 * person who followed a link to a listing signed in and lost the listing.
 *
 * Re-validated here rather than trusted from the query string, because the
 * value crosses a form and a form is an endpoint anybody can post to. Only a
 * path is accepted: no scheme, no protocol-relative `//host`, and no
 * backslash, which the URL parser treats as a path separator and which is
 * exactly how `/\evil.example` became an open redirect in the auth callback.
 */
function landingAfterAuth(formData: FormData): string {
  const raw = formData.get("next");
  if (typeof raw !== "string" || raw.length === 0) return "/home";
  /* One implementation, in `lib/security/return-path.ts`, with unit tests. This
     used to be a third hand-rolled copy of the same three checks, and it was
     the copy that mattered most, because this is where an attacker-supplied
     `next` is actually acted on. All three copies missed TAB, LF and CR, which
     a URL parser strips before resolving, so `/<TAB>/evil.example` passed every
     one of them and then left the origin. */
  return safeReturnPath(raw, "") ?? "/home";
}

export async function signInWithEmail(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const w = await refusals();
  const fieldErrors = validateCredentials(formData, w, "sign-in");
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  if (!emailConfigured()) return { ok: false, message: w.notConnected };

  // Ten guesses a minute from one place is far more than a person mistyping a
  // password and far less than a stuffing run is worth mounting.
  const paced = await throttle("sign_in", subjectForIp(await callerIp()), 10, 60);
  if (paced) return paced;

  /* And the ceiling on one account, whatever it is guessed from. Sixty an
     hour, for the reasons argued in full above the throttle helper. */
  const email = field(formData, "email").trim();
  const address = subjectForEmail(email);
  const perAddress = await consume({
    bucket: "sign_in_address",
    subject: address,
    limit: SIGN_IN_PER_ADDRESS_HOURLY,
    windowSeconds: 3_600,
  });
  if (!perAddress.allowed) {
    /* One alert per address per dedup window, so a sustained run is one row on
       the desk rather than thousands. The subject is the SHA-256 the limiter
       counts by, never the address itself: rule 16. */
    await recordAlert({
      kind: "auth.sign_in.address_ceiling",
      severity: "warning",
      detail: {
        ceiling: SIGN_IN_PER_ADDRESS_HOURLY,
        window_seconds: 3_600,
        retry_after_seconds: perAddress.retryAfterSeconds,
      },
      subjectId: address,
      subjectKind: "auth_address",
    });
    return {
      ok: false,
      message: (await refusals()).tooMany.replace("{when}", perAddress.retryIn),
    };
  }

  const supabase = await createClientWithAgent(); // V-19: GoTrue records the browser, not Node
  const landing = landingAfterAuth(formData);
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: field(formData, "password"),
  });

  if (error) {
    /* Checked before the general mapper, because a deactivated account is the
       one refusal here that a person cannot answer by trying again. */
    if (isDeactivatedAccountError(error.message)) {
      return { ok: false, ...deactivatedAccountNotice() };
    }
    return { ok: false, message: authMessage(error.message, w) };
  }

  // The session cookies are set. Drop every cached render so the shell picks
  // up the real identity instead of the signed out view.
  (await cookies()).delete(CHOOSER_EMAIL_COOKIE);
  revalidatePath("/", "layout");
  redirect(landing);
}

export async function signUpWithEmail(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const w = await refusals();
  const fieldErrors = validateSignUp(formData, w);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  if (!emailConfigured()) return { ok: false, message: w.notConnected };

  // An account and a confirmation email per attempt, so this is the cheapest
  // of the three to abuse and the tightest of the three to allow. A household
  // or an office behind one address can still make five in an hour.
  const paced = await throttle("sign_up", subjectForIp(await callerIp()), 5, 3_600);
  if (paced) return paced;

  const firstName = field(formData, "firstName").trim();
  const surname = field(formData, "surname").trim();
  const nickname = field(formData, "nickname").trim();

  const email = field(formData, "email").trim();

  const supabase = await createClient();
  // The metadata here is what the database signup trigger reads into the
  // profile row, so nothing the person typed has to be asked for twice.
  const { data, error } = await supabase.auth.signUp({
    email,
    password: field(formData, "password"),
    options: {
      /* UX-02: the email link lands where the form was going, as the code does. */
      emailRedirectTo: `${await authOrigin()}/auth/callback?next=${encodeURIComponent(landingAfterAuth(formData))}`,
      data: {
        first_name: firstName,
        surname,
        nickname: nickname.length > 0 ? nickname : null,
        state_code: field(formData, "stateCode").trim().toUpperCase(),
        lga_code: field(formData, "lgaCode").trim().toLowerCase() || null,
        occupation_code: field(formData, "occupationCode").trim().toLowerCase() || null,
        display_name: nickname.length > 0 ? nickname : [firstName, surname].join(" ").trim(),
        hear_about: field(formData, "hearAbout") || null,
        /* A11: the language this form was read in, so the confirmation code
           email arrives in it before the person has a setting of their own. */
        locale: await getLocale(),
        /* A5: the form's field is gone (A1), so the code the /join/<code>
           door left in this browser is what records who invited them. */
        referral_code: field(formData, "referralCode").trim() || (await inviteCodeFromCookie()) || null,
        /*
         * WHAT THEY ACCEPTED, AND WHEN, RECORDED RATHER THAN ASSUMED.
         *
         * The sign-up form carries a required tick and a hidden version
         * string. `handle_new_user` writes `profiles.terms_accepted_at` with
         * the SERVER's clock, and only when a version arrived, so a request
         * assembled by hand without this field records no acceptance instead
         * of a false one. Null here is therefore a real answer and it means
         * exactly what it says: we cannot show that this person agreed.
         */
        terms_version: field(formData, "termsVersion").trim() || null,
      },
    },
  });

  if (error) return { ok: false, message: authMessage(error.message, w) };

  /*
   * THE ADDRESS ALREADY HAS AN ACCOUNT, and Supabase will not say so.
   *
   * A repeated sign-up answers 200 with a user object that looks real and an
   * EMPTY `identities` array, and it sends no email. That is deliberate on
   * their side: telling a stranger which addresses are registered is an
   * enumeration oracle. It is also the exact shape of a silent dead end, and
   * it happened on the first real sign-up this platform ever had. An account
   * was made with Google, the same address was then used on the email form,
   * Supabase answered 200, no email was ever sent, and the person was handed a
   * code screen to wait on for a code that did not exist and never would.
   *
   * So it is caught here and answered honestly, without confirming anything a
   * stranger could not already have guessed by trying to sign in: the sentence
   * is about what to do next rather than about whether the address is known.
   */
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      ok: false,
      message:
        "That address cannot be signed up again. If it is yours, sign in instead, and use Continue with Google if that is how you made it.",
      fieldErrors: { email: "Try signing in with this address." },
    };
  }

  /*
   * THE RECEIPT, AND IT IS WRITTEN HERE BECAUSE IT WAS WRITTEN NOWHERE.
   *
   * `terms_version` is passed into the auth metadata above, and the comment
   * beside it said the sign-up trigger wrote `profiles.terms_accepted_at` from
   * it. Measured on 22 September 2026: that column does not exist, nor does
   * `profiles.terms_version`, and `handle_new_user` does not mention terms.
   * Every acceptance this platform has ever taken was dropped.
   *
   * It is recorded now, against the account that was just created, with the
   * version the form actually carried checked against the version this build
   * serves. A mismatch means somebody submitted a hand-assembled request
   * naming a version they were not shown, so no receipt is written: a wrong
   * receipt is worse than a missing one, and the missing one raises an alert.
   */
  if (data.user) {
    const submitted = field(formData, "termsVersion").trim();
    if (submitted === TERMS_VERSION) {
      await recordTermsAcceptance(data.user.id, "signup_email", {
        ageConfirmed: ageConfirmed(field(formData, "ageConfirmed")),
      });
    }
  }

  /*
   * With email confirmation switched on in Supabase there is no session yet.
   *
   * This used to end here, with "check your email, then sign in", and that
   * sentence was the whole problem. The confirmation email carries a link AND
   * a six digit code, and the code had nowhere to go: no screen on this
   * platform ever asked for one. Somebody who read the code instead of tapping
   * the link was simply stuck, and somebody who did tap the link was then told
   * to sign in a second time for an account they had just made.
   *
   * So the signup carries straight on to the code screen. The address is put
   * in a short-lived cookie rather than the URL, because an email address in a
   * query string is in the address bar, in history and in any referrer that
   * leaves the page.
   */
  if (!data.session) {
    await rememberPendingEmail(email);
    redirect(`/sign-up/verify?next=${encodeURIComponent(landingAfterAuth(formData))}`);
  }

  revalidatePath("/", "layout");
  /* The account exists and is signed in: "Welcome to Vallo" on arrival, by
     a one-shot HttpOnly cookie rather than a forgeable `?done=`
     (lib/ui/success-cookie.ts, `SuccessFlagHost`). */
  await rememberSuccess("account-created");
  redirect(landingAfterAuth(formData));
}

/**
 * The address a signup is waiting on, held between the form and the code
 * screen.
 *
 * httpOnly so no script can read it, thirty minutes because that is longer
 * than any confirmation code lives, and lax rather than strict so the cookie
 * survives arriving back from an email client.
 */
const PENDING_EMAIL_COOKIE = "nf_pending_email";
const PENDING_EMAIL_MAX_AGE = 30 * 60;

async function rememberPendingEmail(email: string): Promise<void> {
  const store = await cookies();
  store.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_EMAIL_MAX_AGE,
  });
}

/** The address the code screen should be asking about, if we still know it. */
export async function pendingSignUpEmail(): Promise<string> {
  const store = await cookies();
  return store.get(PENDING_EMAIL_COOKIE)?.value ?? "";
}

async function forgetPendingEmail(): Promise<void> {
  const store = await cookies();
  store.delete(PENDING_EMAIL_COOKIE);
}

/**
 * The address typed on the chooser, carried to the email step.
 *
 * It used to travel as `?email=` on a GET, which put somebody's address in
 * the address bar, in history and in any referrer that left the page. It rides
 * a cookie now, the same shape as the pending-signup one above but its own
 * name, so a sign-in chooser can never pre-fill the sign-up code screen. The
 * email pages still read `?email=` too, for links that carry it on purpose
 * (the sign-up form's "sign in instead" and older bookmarks).
 */
const CHOOSER_EMAIL_COOKIE = "nf_chooser_email";
const CHOOSER_EMAIL_MAX_AGE = 10 * 60;

export async function continueWithEmail(formData: FormData): Promise<void> {
  /* B-1: sign-in is one screen now (email and password together), so a
     sign-in post from an old page lands back on `/sign-in` with the address
     filled in from the same cookie. */
  const route = formData.get("mode") === "sign-up" ? "/sign-up/email" : "/sign-in";
  const email = emailFromQuery(field(formData, "email"));
  const store = await cookies();
  if (email) {
    store.set(CHOOSER_EMAIL_COOKIE, email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CHOOSER_EMAIL_MAX_AGE,
    });
  } else {
    store.delete(CHOOSER_EMAIL_COOKIE);
  }
  redirect(withNext(route, field(formData, "next") || null));
}

/** The address the chooser handed forward, if it is still fresh. */
export async function chooserEmail(): Promise<string> {
  const store = await cookies();
  return emailFromQuery(store.get(CHOOSER_EMAIL_COOKIE)?.value);
}

/*
 * THE LENGTH IS NOT WRITTEN HERE. It was, as `/^\d{6}$/`, beside two sentences
 * of copy that also said six and an input that truncated at six, and then the
 * Supabase project was set to issue EIGHT. The field cut the last two digits
 * off in silence, this regex refused what was left, and the person was told
 * their code was wrong while looking at the right code in their email. One
 * number in `./confirmation-code`, read by the regex, the copy and the input.
 */

/**
 * Turn the code from the confirmation email into a session, and go inside.
 *
 * This is the half of sign-up that did not exist. `verifyOtp` with type
 * "signup" both confirms the address and issues a session, so there is no
 * second sign-in and no dead end: the person types the code and is in the
 * product on the next paint. The server client writes the session cookies, the
 * same ones the middleware reads, which is why this cannot be done from the
 * browser.
 *
 * A wrong code must not say whether the address is known. It says the code did
 * not match, which is true either way, and the throttle underneath is what
 * stops a short code being guessed.
 */
export async function verifySignUpCode(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim().toLowerCase();
  const token = field(formData, "code").replace(/\s+/g, "");

  const w = await refusals();
  const fieldErrors: Partial<Record<AuthField, string>> = {};
  if (!EMAIL_RE.test(email)) fieldErrors.email = w.signUpEmail;
  if (!CONFIRMATION_CODE_RE.test(token)) {
    fieldErrors.code = w.codeShape.replace("{count}", String(CONFIRMATION_CODE_LENGTH));
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  if (!emailConfigured()) return { ok: false, message: w.notConnected };

  /* Ten a minute per address and twenty a minute per connection. A million
     codes against one address is the attack, and a person mistyping the code
     three times is the case that must not be caught by it. */
  const pacedEmail = await throttle("sign_up_verify", subjectForEmail(email), 10, 60);
  if (pacedEmail) return pacedEmail;
  const pacedIp = await throttle("sign_up_verify_ip", subjectForIp(await callerIp()), 20, 60);
  if (pacedIp) return pacedIp;

  const supabase = await createClientWithAgent(); // V-19: GoTrue records the browser, not Node
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });

  if (error || !data.session) {
    return {
      ok: false,
      /* The whole code is refused, never a digit (the server cannot say
         which one), and the field selects it for typing again (`CodeInput`). */
      fieldErrors: { code: w.codeWrong },
    };
  }

  await forgetPendingEmail();
  /* D85: the sign-up carried the invite in its metadata; this only clears the kept code. */
  await claimInviteFromCookie();
  /*
   * THE FIRST EMAIL THIS PLATFORM SENDS, at the first moment the address is a
   * fact rather than a claim.
   *
   * THIS IS THE SECOND OF TWO PATHS AND IT CANNOT MAKE A SECOND EMAIL.
   * `verifyOtp` has just written `auth.users.email_confirmed_at`, and
   * `users_enqueue_welcome_email_on_confirm` put the row in `email_outbox` in
   * the SAME TRANSACTION. This queues the same key, `account:welcome:<user
   * id>`, which is UNIQUE, so it is told `already` and writes nothing. It is
   * here because the trigger lives in a schema that is not ours, and because
   * this call site is cheap. It cannot fail this action.
   */
  if (data.user) await welcomeOnce(data.user.id);
  // The session cookies are set. Drop every cached render so the shell picks
  // the signed-in tree rather than the anonymous one it rendered a moment ago.
  revalidatePath("/", "layout");
  /*
   * Handed back rather than redirected from here.
   *
   * A server redirect would take somebody from the code field to the inside of
   * the platform in one frame, and the link path does not do that: it holds a
   * "Verifying your email" moment for two seconds first. Two ways into the same
   * account should not feel like two different products, so the code path shows
   * the same moment, and the only way to show anything after this succeeds is
   * to let the screen navigate rather than the server.
   */
  /* The account now exists: "Welcome to Vallo" on the next screen, by the
     one-shot cookie (lib/ui/success-cookie.ts). */
  await rememberSuccess("account-created");
  /* The name the sign-up gave, for the moment on screen (A17); never more
     than a first name, and nothing when the metadata holds none. */
  const given = data.user?.user_metadata?.first_name;
  const name = typeof given === "string" && given.trim() ? given.trim().slice(0, 40) : undefined;
  return { ok: true, verified: landingAfterAuth(formData), ...(name ? { name } : {}) };
}

/**
 * Is this address already signed up, and if so, how?
 *
 * Called as the email field loses focus, so somebody is told before they fill
 * in a password, a state, a local government and an occupation. The old
 * behaviour was to find out on submit, after all of it, and the first real
 * sign-up on this platform hit exactly that: an account made with Google, the
 * same address typed into the email form, and Supabase answering 200 while
 * sending nothing.
 *
 * "google" is the answer worth having. "You already have an account" is not
 * actionable; "use Continue with Google, that is how you made it" is, and it
 * is the difference between somebody getting in and somebody resetting a
 * password that does not exist.
 *
 * This tells a caller whether an address is registered, which is an
 * enumeration oracle, and that is a deliberate trade rather than an oversight.
 * It is bounded: the database function is executable by the service role and
 * by nothing else, so this action is the only door; the door is rate limited
 * per connection; and the answer is never more than which button to press. It
 * reveals nothing that trying to sign in would not.
 */
export async function signUpMethodForEmail(email: string): Promise<EmailStatus> {
  const address = email.trim().toLowerCase();
  if (!EMAIL_RE.test(address)) return "unknown";
  if (!emailConfigured()) return "unknown";

  /* Sixty an hour is far more than a person mistyping their own address and
     far less than a list is worth walking. A refusal answers "unknown", which
     the form treats as no answer rather than as good news. */
  const verdict = await consume({
    bucket: "signup_email_probe",
    subject: subjectForIp(await callerIp()),
    limit: 60,
    windowSeconds: 3_600,
  });
  if (!verdict.allowed) return "unknown";

  try {
    const { data, error } = await createAdminClient().rpc("signup_method_for_email", {
      p_email: address,
    });
    if (error) return "unknown";
    return data === "google" || data === "email" ? data : "none";
  } catch {
    /* No service role key in this environment. Saying "unknown" leaves the
       form exactly as it was before this existed, which is the right failure. */
    return "unknown";
  }
}

/** The `sub` of an access token, read only to compare, never trusted. */
function tokenSubject(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * Finish an email confirmation, whichever shape the link arrived in.
 *
 * Supabase sends one of three things depending on how the project is set up
 * and which flow the client is on, and a confirmation that only handles one of
 * them is a confirmation that works until somebody changes a setting:
 *
 *   `code`         the PKCE authorisation code. Exchanged for a session. Needs
 *                  the verifier cookie the sign-up left behind, so it only
 *                  works in the browser the account was made in.
 *   `token_hash`   the hashed one-time token. Verified outright, with no
 *                  verifier needed, so this is the shape that survives opening
 *                  the email on a different device.
 *   access/refresh the implicit flow, which puts the tokens in the URL
 *                  FRAGMENT. A server never sees a fragment, which is why this
 *                  runs as an action called from the browser rather than as a
 *                  route handler: the handler was structurally incapable of
 *                  reading this case and quietly sent those people to
 *                  "link-expired".
 *
 * A server action rather than a route handler for the other half of that
 * reason too: only an action or a handler may write cookies, and only an
 * action can be called from a screen that is already showing the reader what
 * is happening.
 *
 * Returns the path to go to, so the caller navigates rather than this throwing
 * a redirect through a fetch. `next` is re-validated here and never trusted.
 */
export async function completeEmailVerification(input: {
  code?: string | undefined;
  tokenHash?: string | undefined;
  type?: string | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  next?: string | undefined;
}): Promise<VerificationOutcome> {
  if (!emailConfigured()) return { ok: false, reason: "unconfigured" };

  const next = landingFromPath(input.next);
  const supabase = await createClientWithAgent(); // V-19: GoTrue records the browser, not Node

  if (input.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(input.code);
    if (error) return { ok: false, reason: "expired" };
  } else if (input.tokenHash) {
    /* The type decides what is being confirmed. Anything we do not recognise
       is treated as a signup, which is the only one that reaches this screen
       without a type in practice.

       `email_change` IS DELIBERATELY NOT IN THIS LIST, 23 September. An email
       address is permanent on this platform, by the founder's ruling, because
       an account cannot be merged or corrected afterwards and the link between
       an account and its underlying mailbox has to mean something. Nothing in
       the product initiates a change, and this is the other half of that:
       even a token minted outside the product cannot be redeemed here. An
       unrecognised type falls through to "signup", which fails against an
       email-change token rather than confirming one.

       THE ONE PLACE AN ADDRESS IS EVER REWRITTEN is `scrubAuth` in
       `lib/account-deletion/service.ts`, which replaces it with a
       `deleted.invalid` pseudonym during a purge. That is erasure, not a
       change, it runs as the service role in a job, and no signed-in person
       can reach it. `email-immutable.test.ts` holds both halves as a check. */
    const type = ["signup", "email", "recovery", "invite", "magiclink"].includes(input.type ?? "")
      ? (input.type as "signup" | "email" | "recovery" | "invite" | "magiclink")
      : "signup";
    /* LOGIN CSRF, THE LINK HALF. A `token_hash` link is not tied to this
       browser either: anybody can ask for a magic link to their OWN account
       and send the callback address on. Verifying it would silently swap a
       signed-in member into the stranger's account. Who was signed in is
       read first; a link that answers with a different account ends the
       session it just made (local scope: only that one) and is refused. */
    const { data: before } = await supabase.auth.getUser();
    const { data: verified, error } = await supabase.auth.verifyOtp({ token_hash: input.tokenHash, type });
    if (error) return { ok: false, reason: "expired" };
    if (before?.user && verified?.user && verified.user.id !== before.user.id) {
      await supabase.auth.signOut({ scope: "local" });
      return { ok: false, reason: "invalid" };
    }
  } else if (input.accessToken && input.refreshToken) {
    /* LOGIN CSRF. Tokens in a fragment are not tied to this browser: anybody
       can mint a link carrying their own. So they never replace a session
       that is already signed in as somebody else; the person would otherwise
       be switched silently into a stranger's account. */
    const { data: current } = await supabase.auth.getUser();
    if (current?.user && tokenSubject(input.accessToken) !== current.user.id) {
      return { ok: false, reason: "invalid" };
    }
    const { error } = await supabase.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });
    if (error) return { ok: false, reason: "expired" };
  } else {
    return { ok: false, reason: "invalid" };
  }

  /* STORE-02 / STORE-03: A PROVIDER THE PLATFORM HAS SWITCHED OFF IS REFUSED
     HERE, NOT ONLY LEFT UNDRAWN. Somebody can still build the Supabase
     authorize URL for Google by hand, and the dashboard will honour it until
     the provider is switched off there too; the session it produces is
     ended before it is used, whatever the screens drew. */
  const refused = await refuseSwitchedOffProvider(supabase);
  if (refused) return refused;

  await forgetPendingEmail();
  /* D85: an invite the sign-up could not carry (Google, Apple, a phone code) is claimed now, for a new account only. */
  await claimInviteFromCookie();
  /* The link half of the same moment. Same key, same unique index, so two taps
     on one email and the trigger's own row are still one welcome. */
  const { data: confirmed } = await supabase.auth.getUser();
  if (confirmed.user) await welcomeOnce(confirmed.user.id);
  /* B-2: a Google or Apple account that has not yet agreed to the terms or
     said it is 18 or over goes to the step that asks, carrying `next`. The
     "Welcome to Vallo" moment waits for that step, which sets it. */
  if (confirmed.user && (await setupStillOwed(supabase, confirmed.user))) {
    revalidatePath("/", "layout");
    return { ok: true, next: finishSetupHref(next) };
  }
  /* A sign-up or address-change link earns its moment (`doneFlagForLinkType`),
     by the one-shot cookie; a magic-link sign-in and a recovery earn none. */
  const moment = doneFlagForLinkType(input.type);
  if (isGlobalDoneFlag(moment)) await rememberSuccess(moment);
  // The session cookies are set. Drop every cached render so the shell picks
  // the signed-in tree rather than the anonymous one behind this screen.
  revalidatePath("/", "layout");
  return { ok: true, next };
}

async function refuseSwitchedOffProvider(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<VerificationOutcome | null> {
  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);
  const provider = socialProviderOfSession(
    sessionData.session?.access_token,
    userData.user?.identities ?? [],
  );
  if (provider === null) return null;
  /* The callback runs in a web view or a browser; its surface is read from
     the same header the sign-in screen used. */
  const states = await resolveProviderStates(surfaceFromUserAgent((await headers()).get("user-agent")));
  if ((provider === "google" || provider === "apple") && providerAllowed(states, provider)) return null;
  await supabase.auth.signOut({ scope: "local" });
  return { ok: false, reason: "provider-off" };
}

/**
 * The same rule `landingAfterAuth` applies, for a value that arrives as a
 * string rather than on a form. A `next` that accepts an absolute address is
 * an open redirect, and the two leading slashes matter as much as the scheme
 * because `//evil.example` is protocol-relative and a browser reads it as a
 * host. A backslash matters too: the URL parser treats it as a separator, so
 * `/\evil.example` resolves off-origin.
 */
function landingFromPath(raw: string | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) return "/home";
  /* Same single implementation as `landingAfterAuth` above. See the note there
     for the control-character bypass all three copies shared. */
  return safeReturnPath(raw, "") ?? "/home";
}

/**
 * Send another confirmation code to the same address.
 *
 * Deliberately quiet about whether the address has an account waiting. The
 * answer is the same sentence either way, because the difference is worth
 * something to somebody enumerating addresses and nothing to the person who
 * has just typed their own.
 */
export async function resendSignUpCode(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, fieldErrors: { email: (await refusals()).signUpEmail } };
  }
  if (!emailConfigured()) return { ok: false, message: (await refusals()).notConnected };

  /* One email per attempt, so this is metered like the sign-up it follows. */
  const paced = await throttle("sign_up_resend", subjectForEmail(email), 3, 900);
  if (paced) return paced;
  /* And per connection, so one place cannot spend three mails on each of a
     list of addresses: the same ten an hour as a password reset. */
  const pacedIp = await throttle("sign_up_resend_ip", subjectForIp(await callerIp()), 10, 3_600);
  if (pacedIp) return pacedIp;

  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${await authOrigin()}/auth/callback?next=${encodeURIComponent(landingAfterAuth(formData))}`,
    },
  });

  await rememberPendingEmail(email);
  /* A6: a resend is a step in the funnel (never throws, never blocks on
     anything the person needs). */
  await recordFunnelStep("code_resent");
  return {
    ok: true,
    message: (await refusals()).resendSent,
  };
}

/**
 * Begin an OAuth handshake. Returns the provider URL for the client to visit,
 * rather than redirecting here, so the caller can report a refusal in place.
 */
/**
 * Form-action wrappers.
 *
 * A `<form action={...}>` hands the action a FormData argument, so the bare
 * startOAuth signature cannot be bound to a form directly. These two exist so
 * the provider is fixed on the server rather than being submitted by the
 * browser, which means a crafted form cannot ask for a provider we never
 * enabled.
 */
/* A `<form action={...}>` hands the action its FormData, which is how the
   hidden `next` field reaches the provider round trip. */
export async function startGoogleOAuth(formData: FormData): Promise<void> {
  await startOAuth("google", formData);
}

export async function startAppleOAuth(formData: FormData): Promise<void> {
  await startOAuth("apple", formData);
}

export async function startOAuth(
  provider: "google" | "apple",
  formData: FormData = new FormData(),
): Promise<AuthFormState> {
  /* THE SERVER'S ANSWER, for THIS surface. A form posted by hand from a page
     that never drew the button reaches here and is refused the same way. */
  const surface = surfaceFromUserAgent((await headers()).get("user-agent"));
  const states = await resolveProviderStates(surface);
  /* The redirect cannot complete inside a native shell (STORE-03), so even an
     allowed provider is refused there; the iOS shell signs in with Apple
     through `signInWithAppleIdToken` instead. */
  if (surface !== "web" || !providerAllowed(states, provider)) {
    return {
      ok: false,
      message: "That sign-in method is not switched on yet. Use your email address for now.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      /* The provider round trip loses everything except this URL, so where
         the person was going has to travel inside it, and so does which door
         they came through. The callback re-checks `next` against its own
         origin before using it; `intent` only ever chooses a form of words,
         so it is compared to one literal and otherwise ignored.

         Without `intent`, both doors landed on the same screen and that screen
         said "Verifying your email" to a person who had held an account for a
         month and simply tapped Continue with Google to sign in. */
      redirectTo: `${await authOrigin()}/auth/callback?next=${encodeURIComponent(
        landingAfterAuth(formData),
      )}&intent=${formData.get("intent") === "sign-in" ? "sign-in" : "sign-up"}`,
    },
  });

  if (error || !data.url) return { ok: false, message: authMessage(error?.message ?? "", await refusals()) };
  redirect(data.url);
}

/**
 * Sign in with Apple from the iOS shell's native sheet (STORE-02).
 *
 * The sheet hands the page an identity token signed by Apple; Supabase checks
 * that signature and the nonce and issues the session, and the cookies are
 * written here, in the same jar the web view uses. Refused unless Supabase
 * reports the Apple provider enabled and the policy allows it on this surface.
 */
export async function signInWithAppleIdToken(input: {
  idToken: string;
  nonce: string;
  next?: string | undefined;
}): Promise<{ ok: true; next: string } | { ok: false; message: string }> {
  const surface = surfaceFromUserAgent((await headers()).get("user-agent"));
  const states = await resolveProviderStates(surface);
  if (surface !== "ios-native" || !providerAllowed(states, "apple")) {
    return { ok: false, message: "That sign-in method is not switched on yet. Use your email address for now." };
  }
  if (typeof input.idToken !== "string" || input.idToken.length < 20 || input.idToken.length > 8192) {
    return { ok: false, message: "Apple did not send a usable answer. Try again." };
  }
  if (typeof input.nonce !== "string" || input.nonce.length < 16 || input.nonce.length > 128) {
    return { ok: false, message: "Apple did not send a usable answer. Try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: input.idToken,
    nonce: input.nonce,
  });
  if (error) return { ok: false, message: authMessage(error.message, await refusals()) };
  const { data } = await supabase.auth.getUser();
  if (data.user) await welcomeOnce(data.user.id);
  /* D85: an invite the sign-up could not carry (Google, Apple, a phone code) is claimed now, for a new account only. */
  await claimInviteFromCookie();
  revalidatePath("/", "layout");
  /* B-2: a new Apple account agrees to the terms and says it is 18 or over
     before it goes in. */
  if (data.user && (await setupStillOwed(supabase, data.user))) {
    return { ok: true, next: finishSetupHref(landingFromPath(input.next)) };
  }
  return { ok: true, next: landingFromPath(input.next) };
}

/* ------------------------------------------------------- finish setting up */

/**
 * Record the terms and the 18+ statement for a Google or Apple account, then
 * go where the person was going with "Welcome to Vallo".
 *
 * THE SAME RULES AS THE EMAIL SIGN-UP, ON THE SERVER. The current terms
 * version (`termsRefusal`) and `ageConfirmed=18+` (`ageRefusal`) are both
 * required, whatever the browser did; the receipt is written by the same
 * `recordTermsAcceptance` into the same table, with the source
 * `signup_oauth`. The user id is the one the server resolved, never a field.
 *
 * THE RECEIPT IS READ BACK BEFORE MOVING ON. `recordTermsAcceptance` is best
 * effort (it alerts rather than throws), and moving on without the rows
 * would only bounce the person back here from the edge gate. So a missing
 * receipt is said plainly, with the answers kept, and nothing moves.
 */
export async function finishSocialSetup(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fieldErrors: Partial<Record<AuthField, string>> = {};
  const firstName = field(formData, "firstName").trim();
  const surname = field(formData, "surname").trim();
  if (!firstName) fieldErrors.firstName = "Enter your first name.";
  else if (firstName.length > 80) fieldErrors.firstName = "That first name is too long.";
  if (!surname) fieldErrors.surname = "Enter your surname.";
  else if (surname.length > 80) fieldErrors.surname = "That surname is too long.";
  const refusal = termsRefusal(field(formData, "termsVersion"));
  if (refusal) fieldErrors.acceptTerms = refusal;
  const underAge = ageRefusal(field(formData, "ageConfirmed"));
  if (underAge) fieldErrors.ageConfirmed = underAge;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  if (!emailConfigured()) return { ok: false, message: (await refusals()).notConnected };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect(withNext("/sign-in", finishSetupHref(landingAfterAuth(formData))));

  /* The name, through the member's own client, so RLS and the profile guard
     (the SEC-05 name scanner, "no name speaks for Vallo") decide exactly as
     they do in Settings. `display_name` follows from a trigger. */
  const { error: nameError } = await supabase
    .from("profiles")
    .update({ first_name: firstName, surname })
    .eq("id", user.id);
  if (nameError) {
    const refused = contentRefusal(nameError);
    if (refused) return { ok: false, message: refused, fieldErrors: { firstName: refused } };
    return { ok: false, message: "We could not save that just now. Please try again in a moment." };
  }

  await recordTermsAcceptance(user.id, "signup_oauth", { ageConfirmed: true });
  if ((await setupOnRecord(supabase, user.id)) !== true) {
    return {
      ok: false,
      message: "We could not record that just now. Nothing you ticked was lost. Please try again in a moment.",
    };
  }
  /* D85: an invite the sign-up could not carry (Google, Apple, a phone code) is claimed now, for a new account only. */
  await claimInviteFromCookie();

  /* The edge gate's shortcut: once the receipt is on file, a flag in
     `app_metadata` (service role only) lets `proxy.ts` decide from the token
     without reading the table. Best effort: without it the gate reads the
     table, finds the receipt, and lets the person through. */
  try {
    await createAdminClient().auth.admin.updateUserById(user.id, {
      app_metadata: { [SETUP_DONE_CLAIM]: true },
    });
    await supabase.auth.refreshSession();
  } catch {
    /* The receipt is what matters, and it is on file. */
  }

  /* The welcome email was already queued at the callback (`welcomeOnce`). */
  revalidatePath("/", "layout");
  /* "Welcome to Vallo" on arrival, by the one-shot HttpOnly cookie, exactly
     as the email sign-up does (lib/ui/success-cookie.ts). */
  await rememberSuccess("account-created");
  redirect(landingAfterAuth(formData));
}

/* ------------------------------------------------------------ password reset */

/**
 * The same answer whether or not the address has an account.
 *
 * This is the whole security property of a reset flow. "No account with that
 * email" turns the form into an account-existence oracle: anybody can paste a
 * list of addresses through it and learn which of your users are real, which
 * is the first step of a credential-stuffing run and, on a platform where
 * people's homes are listed, a privacy leak in its own right. So the sentence
 * below is returned for a match, for no match, and for a Supabase refusal
 * alike, and it is worded so it stays true in every one of those cases.
 */

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();
  const w = await refusals();

  if (!email) return { ok: false, fieldErrors: { email: w.emailMissing } };
  if (email.length > 254) return { ok: false, fieldErrors: { email: w.emailTooLong } };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, fieldErrors: { email: w.emailInvalid } };
  }

  if (!emailConfigured()) return { ok: false, message: w.notConnected };

  /*
   * Counted twice, and both counts are spent before Supabase is asked
   * anything, so neither one can become an account-existence oracle: the
   * allowance for an address that has no account is spent exactly as fast as
   * the allowance for one that does.
   */
  const byIp = await throttle("password_reset_ip", subjectForIp(await callerIp()), 10, 3_600);
  if (byIp) return byIp;
  const byEmail = await throttle("password_reset_email", subjectForEmail(email), 3, 3_600);
  if (byEmail) return byEmail;

  const supabase = await createClient();
  /*
   * The link lands on the same callback every other Supabase route uses. It
   * exchanges the recovery code for a session and forwards to
   * /reset-password, which is the only screen that can then set a new
   * password - and it can only do so because that exchange happened.
   */
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await authOrigin()}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  /*
   * A rate limit is the one refusal worth surfacing, because it is about the
   * request and not about the account: telling somebody to wait a minute helps
   * them and reveals nothing. Everything else - including "user not found" -
   * returns the same sentence as success.
   */
  if (error && /rate limit|too many/i.test(error.message)) {
    return { ok: false, message: w.resetBusy };
  }

  return { ok: true, message: w.resetSent };
}

/**
 * The reset code, for a reset email opened somewhere other than where it was
 * asked for.
 *
 * The link in the email is a PKCE link: the callback can only exchange it in
 * the browser that holds the matching verifier, so opened in a mail app's own
 * browser, on a second device or in another browser it reads as expired. The
 * same email carries the one-time recovery code (the Send Email Hook renders
 * it where GoTrue hands the hook the token), and `verifyOtp` with the address
 * and that code needs no verifier. It makes a session whose `amr` is the
 * recovery proof, which is what `passwordChangeProof` accepts for half an
 * hour, so /reset-password then sets the new password without the old one,
 * exactly as it does after the link.
 *
 * NEUTRAL, AND COUNTED BEFORE SUPABASE IS ASKED. A wrong code, a spent code
 * and an address with no account all get the same sentence, so this screen is
 * not an account-existence oracle. Ten an hour per address and twenty per
 * connection in ten minutes: a person mistyping twice never meets it, and a
 * six digit code cannot be walked through it.
 */
export async function verifyPasswordResetCode(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim().toLowerCase();
  const token = field(formData, "code").replace(/\s+/g, "");

  const w = await refusals();
  const fieldErrors: Partial<Record<AuthField, string>> = {};
  if (!email) fieldErrors.email = w.emailMissing;
  else if (email.length > 254 || !EMAIL_RE.test(email)) {
    fieldErrors.email = w.emailInvalid;
  }
  if (!CONFIRMATION_CODE_RE.test(token)) {
    fieldErrors.code = w.resetCodeShape.replace("{count}", String(CONFIRMATION_CODE_LENGTH));
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  if (!emailConfigured()) return { ok: false, message: w.notConnected };

  /* The connection first, so one place walking many addresses is stopped
     without spending each address's own allowance. */
  const pacedIp = await throttle("password_reset_code_ip", subjectForIp(await callerIp()), 20, 600);
  if (pacedIp) return pacedIp;
  const pacedEmail = await throttle("password_reset_code", subjectForEmail(email), 10, 3_600);
  if (pacedEmail) return pacedEmail;

  const supabase = await createClientWithAgent(); // V-19: GoTrue records the browser, not Node
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });

  if (error || !data.session) {
    return {
      ok: false,
      /* The same sentence as every refused code (`CodeInput` selects it). */
      fieldErrors: { code: w.codeWrong },
    };
  }

  // The recovery session's cookies are set; drop the signed-out renders.
  revalidatePath("/", "layout");
  redirect("/reset-password");
}

/**
 * Set the new password.
 *
 * `updateUser` acts on whoever the cookies say is signed in, so the question
 * is which sessions may do it. A session made by the recovery link (or an
 * emailed code) in the last half hour may: that is exactly the proof the
 * forgot-password email exists to give. ANY OTHER SESSION must type the
 * current password first. Before, any signed-in session could set a new
 * password, and because a new password ends every other session, somebody
 * holding a stolen session could lock the owner out (the devices screen's
 * "this was not me" even linked here). See `password-change-proof.ts`.
 */
export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = field(formData, "password");
  const confirmPassword = field(formData, "confirmPassword");

  const w = await refusals();
  const fieldErrors: Partial<Record<AuthField, string>> = {};
  if (!password) fieldErrors.password = w.newPasswordMissing;
  else if (password.length < 8) fieldErrors.password = w.passwordShort;
  else if (password.length > 200) fieldErrors.password = w.passwordTooLong;
  if (password && confirmPassword !== password) {
    fieldErrors.confirmPassword = w.passwordsDiffer;
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  if (!emailConfigured()) return { ok: false, message: w.notConnected };

  /* The recovery session is the authorisation, and it is a real one, so this
     is the lightest of the four doors. It is still a door: every submit is a
     Supabase call, and a link that has been opened can be submitted against
     until the session expires. Ten an hour from one place. */
  const pacedReset = await throttle("password_update_ip", subjectForIp(await callerIp()), 10, 3_600);
  if (pacedReset) return pacedReset;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      ok: false,
      message: w.resetLinkSpent,
    };
  }

  const proof = await passwordChangeProof(supabase, userData.user);
  if (proof === "link-only") {
    return {
      ok: false,
      message: w.resetLinkOnly,
    };
  }
  if (proof === "current-password") {
    const currentPassword = field(formData, "currentPassword");
    if (!currentPassword) {
      return { ok: false, fieldErrors: { currentPassword: w.currentMissing } };
    }
    const itIsThem = await reauthenticate(userData.user, { password: currentPassword });
    if (!itIsThem) {
      return { ok: false, fieldErrors: { currentPassword: w.currentWrong } };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: authMessage(error.message, w) };

  /*
   * SEC-08: a new password ends every OTHER session. A reset is what somebody
   * does after losing a phone, and the thief's session used to keep working
   * after it. `scope: 'others'` revokes every refresh token but this one, so
   * those devices cannot mint a new access token. A failure here does not undo
   * the password change; the devices screen can still end them one by one.
   */
  const { error: othersError } = await supabase.auth.signOut({ scope: "others" });
  if (othersError) console.warn("[auth] password changed; ending other sessions failed:", othersError.message);

  // The password changed under the session the link created, so every cached
  // render of the signed-out shell has to go.
  revalidatePath("/", "layout");
  /* "Password changed" on arrival, by the one-shot cookie: set only here,
     after `updateUser` succeeded (lib/ui/success-cookie.ts). */
  await rememberSuccess("password-changed");
  redirect("/home");
}

// Signing out lives in lib/profile/actions.ts, which the settings screen
// already calls. One session-ending path, one place.
