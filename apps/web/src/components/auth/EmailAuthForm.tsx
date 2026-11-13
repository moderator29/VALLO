"use client";
import "@/app/css/auth.css";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { AcceptTerms } from "./AcceptTerms";
import { withNext } from "@/lib/auth/next-link";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import type { AuthFormState, EmailStatus } from "@/lib/auth/form-state";
import type { SignInSurface } from "@/lib/auth/providers";
import { Field, PasswordField, StrengthMeter } from "./fields";
import { EmailTakenNotice } from "./EmailTakenNotice";
import { SocialDoors } from "./SocialDoors";
import { AuthPillButton } from "./slate";
import { signUpMethodForEmail, startGoogleOAuth } from "@/lib/auth/actions";
import { BannerOnArrival } from "@/components/ui/BannerOnArrival";
import { useAuthBanner } from "./use-auth-banner";
import { showSuccess } from "@/lib/ui/success-moments";
import { ReferralField } from "./ReferralField";
import { lookupReferrer } from "@/lib/referral/lookup-action";

const EMPTY: AuthFormState = { ok: false };

/* The same shape the server checks (`lib/auth/actions.ts`); the server is
   still the judge, this only stops a submit with an obvious gap. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * THE DRAFT (A1, A4). The names typed on sign up are kept for this tab
 * (sessionStorage), so "Wrong address? Change it" on the code screen comes
 * back to a form that still has them. Never the password, never anything
 * but the two names and the address.
 */
const SIGNUP_DRAFT_KEY = "vallo_signup_draft";

type SignUpErrors = Partial<Record<"firstName" | "surname" | "email" | "password", string>>;

/**
 * The email form, on its own screen, in the Slate dress.
 *
 * SIGN IN is the reference screen itself, ON ONE SCREEN (B-1, the founder,
 * 29 September; refs 12 and 14): the big title, the email and password cards
 * together, "Forgot password?" on the right, the pill, the "Or" rule, the
 * round Google and Apple doors and the line to sign up. It is what `/sign-in`
 * draws; the old second step, `/sign-in/email`, now forwards here. Nothing
 * about the door's safety moved with it: the same `signInWithEmail` action,
 * its two rate limits, its one neutral refusal, its `next` check.
 *
 * SIGN UP IS ONE SCREEN TOO (A1, 30 September; it was two steps). Only what
 * an account needs: first name and surname, the email, one password with
 * show and hide and its strength, and the two ticks the law and the store
 * require (the terms, and 18 or over), then Create account. Everything else
 * the old second step asked (nickname, where you stay and what you do, how
 * you heard of Vallo, a referral code) is asked after the account exists, on
 * the interests step of `/welcome`, or lives in Settings. The confirmation
 * password is gone: show and hide, and the reset flow, cover its typo.
 *
 * IT IS STILL ONE FORM POSTING ONE ACTION (`signUpWithEmail`); the server
 * checks everything again, including both ticks.
 *
 * Every word either mode draws comes out of the dictionary under `signUp` or
 * `auth`.
 */
export function EmailAuthForm({
  mode,
  t,
  action,
  next,
  initialEmail = "",
  accountMethod = "unknown",
  googleReady = false,
  appleReady = false,
  surface = "web",
  initialState = EMPTY,
  notice,
  emailReady = true,
  invite,
}: {
  mode: "sign-in" | "sign-up";
  t: Dictionary;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  /** Where to land afterwards. Re-validated in the action, never trusted. */
  next?: string | undefined;
  /**
   * The address typed on the chooser, carried here in a short-lived cookie
   * (`continueWithEmail`, or `?email=` on a link that carries it) so the
   * email-first flow holds: nobody types their email twice. Anything not
   * shaped like an address is ignored.
   */
  initialEmail?: string;
  /**
   * Sign-in only: how the address typed on the chooser signs in, read on the
   * server by the page. "google" means there is no password to ask for, so
   * the screen says so and offers the Google door instead of a password field
   * that can only ever answer "do not match". "none" draws the same password
   * step as "unknown", so the screen never says whether an account exists.
   * "unknown" (the default, and the answer whenever the lookup is refused or
   * unavailable) draws the ordinary password step.
   */
  accountMethod?: EmailStatus;
  /** Whether the Google door is switched on, from `resolveProviderStates`. */
  googleReady?: boolean;
  /** Whether the Apple door is switched on for this surface. */
  appleReady?: boolean;
  /** Which surface the server rendered for (the doors differ inside a shell). */
  surface?: SignInSurface;
  /** The form's state before any submit. Only the preview harness passes it,
      to draw a refusal without a live account. */
  initialState?: AuthFormState;
  /**
   * Sign-in only: a sentence from the callback, the wall or the passcode lock
   * (`?notice=` looked up in the dictionary by the page, own keys only), drawn
   * under the title as a status.
   */
  notice?: string | undefined;
  /** False when accounts cannot be reached at all: the pill gives way to
      the sentence that says so, as the chooser used to. */
  emailReady?: boolean;
  /** Sign-up only: the invite link that brought this person here (the code and
      the referrer's first name), shown as "Referred by X" in the optional field. */
  invite?: { code: string; firstName: string | null } | null;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  useAuthBanner(state);
  /*
   * SIGNED IN, SAID AT ONCE (13 November 2026). The action answers as soon as
   * the password is accepted (`signInWithEmail`), instead of after the next
   * page has been built on the server. "Signed in. Welcome back." goes up in
   * the same frame, the pill keeps its spinner, and the page loads where the
   * person was going. A whole-page load, so nothing from the signed-out
   * screens is kept.
   */
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!state.ok || !state.next) return;
    setLeaving(true);
    showSuccess("signed-in");
    window.location.replace(state.next);
  }, [state]);
  const isSignUp = mode === "sign-up";
  /*
   * F-12: A REFUSED SUBMIT PUTS THE CURSOR ON THE FIRST THING TO FIX. Every
   * field marks itself `aria-invalid` when it carries an error, so the first
   * one showing is the one to fix first; focusing it also scrolls it into
   * view and has a screen reader read it. The request is held in a ref and
   * served after the render that draws the error.
   */
  const formRef = useRef<HTMLFormElement>(null);
  const focusWanted = useRef(false);
  const [refusedLocally, setRefusedLocally] = useState(0);
  useEffect(() => {
    const refusedByServer =
      state !== initialState && Object.keys(state.fieldErrors ?? {}).length > 0;
    if (!refusedByServer && refusedLocally === 0) return;
    focusWanted.current = true;
  }, [state, initialState, refusedLocally]);
  useEffect(() => {
    if (!focusWanted.current) return;
    focusWanted.current = false;
    const scope = formRef.current?.closest(".nf-auth__screen") ?? formRef.current;
    scope?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
  /*
   * EVERY TEXT FIELD IS CONTROLLED, AND IT HAS TO BE.
   *
   * React RESETS AN UNCONTROLLED FORM WHEN THE ACTION PASSED TO `<form
   * action>` COMPLETES, on failure exactly as on success, which wiped answers
   * that were already correct. So the values live here, the inputs read from
   * this state, and nothing a person typed is thrown away by a message
   * telling them to fix one thing.
   *
   * PASSWORDS ARE NOT IN THIS OBJECT. They have their own state below and are
   * kept out of the generic bag deliberately, so that anything added later
   * which logs, serialises or inspects `values` cannot reach them.
   */
  const [values, setValues] = useState<Record<string, string>>(
    initialEmail ? { email: initialEmail } : {},
  );
  const [localErrors, setLocalErrors] = useState<SignUpErrors>({});
  const bind = (field: "firstName" | "surname" | "email") => ({
    value: values[field] ?? "",
    onChange: (next: string) => {
      setValues((v) => ({ ...v, [field]: next }));
      if (localErrors[field]) setLocalErrors((e) => ({ ...e, [field]: undefined }));
    },
  });

  /* The draft (see SIGNUP_DRAFT_KEY): names typed a moment ago come back
     when the code screen sends somebody here to change their address. */
  useEffect(() => {
    if (!isSignUp) return;
    try {
      const raw = window.sessionStorage.getItem(SIGNUP_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { firstName?: unknown; surname?: unknown };
      const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 80) : "");
      setValues((v) => ({
        ...v,
        firstName: v.firstName || text(draft.firstName),
        surname: v.surname || text(draft.surname),
      }));
    } catch {
      /* Storage refused or a mangled draft: the form is simply empty. */
    }
  }, [isSignUp]);

  const [password, setPassword] = useState("");
  /*
   * THE ACCEPTANCE, AND WHY IT IS STATE RATHER THAN A `required` ATTRIBUTE.
   *
   * The form is `noValidate`, deliberately, because every other refusal on
   * this screen is a sentence this product wrote rather than a browser
   * bubble. So the tick is held here, the submit is refused here, and the
   * sentence comes from the dictionary like every other sentence.
   */
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState(false);
  const [adult, setAdult] = useState(false);
  const [adultError, setAdultError] = useState(false);

  /* The early checks for sign up, before anything is sent. The address is
     read from the form because its field is owned by `EmailTakenNotice`. */
  function signUpErrors(form: HTMLFormElement): SignUpErrors {
    const email = String(new FormData(form).get("email") ?? "").trim();
    const errors: SignUpErrors = {};
    if (!(values.firstName ?? "").trim()) errors.firstName = t.signUp.firstNameRequired;
    if (!(values.surname ?? "").trim()) errors.surname = t.signUp.surnameRequired;
    if (!email) errors.email = t.signUp.emailRequired;
    else if (!EMAIL_SHAPE.test(email)) errors.email = t.signUp.emailInvalid;
    if (password.length < 8) errors.password = t.signUp.passwordShort;
    return errors;
  }

  const fieldError = (field: keyof SignUpErrors) => localErrors[field] ?? state.fieldErrors?.[field];

  return (
    <div className={isSignUp ? "nf-auth__screen nf-auth__screen--form" : "nf-auth__screen"}>
      <div className="nf-slate-stagger">
        <h1 className="nf-auth__title">{isSignUp ? t.common.signUp : t.common.signIn}</h1>

        {/* The arrival sentence (`?notice=`) is said by the one banner (founder, 7 November 2026). */}
        <BannerOnArrival message={!isSignUp && notice ? notice : null} tone="info" />

        {!isSignUp && accountMethod === "google" && (
          <div className="nf-auth__notice" role="status">
            <p>{googleReady ? t.auth.accountUsesGoogle : t.auth.accountUsesGoogleOff}</p>
            {googleReady && (
              <form action={startGoogleOAuth} className="mt-sm">
                {next ? <input type="hidden" name="next" value={next} /> : null}
                <input type="hidden" name="intent" value="sign-in" />
                <AuthPillButton type="submit">{t.auth.continueWithGoogle}</AuthPillButton>
              </form>
            )}
          </div>
        )}
        {/* No "no account uses this address" notice here any more (F-08): it
            contradicted the "do not match" refusal and told anyone which
            addresses have accounts. "none" draws the plain password step. */}
      </div>

      <form
        action={formAction}
        ref={formRef}
        onKeyDown={(e) => {
          /* THE RETURN KEY SAYS "NEXT", SO IT GOES TO THE NEXT FIELD. On a
             phone the keyboard's return key is labelled by `enterKeyHint`;
             where it reads "next" and a later field in view is still empty,
             it moves the cursor there instead of submitting half a form. */
          if (
            e.key === "Enter" &&
            !e.nativeEvent.isComposing &&
            e.target instanceof HTMLInputElement &&
            e.target.enterKeyHint === "next"
          ) {
            const fields = Array.from(
              e.currentTarget.querySelectorAll<HTMLInputElement>(
                'input:not([type=hidden]):not([type=checkbox]):not([type=radio])',
              ),
            ).filter((el) => !el.disabled && !el.closest("[hidden]"));
            const after = fields.slice(fields.indexOf(e.target) + 1).find((el) => el.value === "");
            if (after) {
              e.preventDefault();
              after.focus();
            }
          }
        }}
        onSubmit={(e) => {
          /* UX-14: the action is dispatched here rather than by `<form
             action>`, because React resets a form after a `<form action>`
             submission completes, refusal included. A dispatch from here is
             not followed by a reset, so every answer stays. `action` above
             still serves a submit made before the page has hydrated. */
          e.preventDefault();
          /* Sign up: the early checks, drawn without a round trip, and the
             cursor on the first thing to fix (F-12). */
          const early = isSignUp ? signUpErrors(e.currentTarget) : {};
          if (isSignUp) setLocalErrors(early);
          /* Sign up only. Signing in is not the moment somebody agrees to
             anything: they agreed when they made the account. */
          if (isSignUp && (!accepted || !adult)) {
            setAcceptError(!accepted);
            setAdultError(!adult);
            setRefusedLocally((n) => n + 1);
            return;
          }
          if (Object.keys(early).length > 0) {
            setRefusedLocally((n) => n + 1);
            return;
          }
          const data = new FormData(e.currentTarget);
          if (isSignUp) {
            try {
              window.sessionStorage.setItem(
                SIGNUP_DRAFT_KEY,
                JSON.stringify({ firstName: values.firstName ?? "", surname: values.surname ?? "" }),
              );
            } catch {
              /* A refused write only loses the convenience. */
            }
          }
          startTransition(() => formAction(data));
        }}
        className="nf-auth__form nf-auth__form--fields nf-slate-stagger"
        noValidate
      >
        {/* Where the middleware was sending them before it asked them to sign
            in. A hidden field is an input like any other, so the action
            re-checks it rather than trusting the round trip. */}
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {isSignUp ? (
          <>
            <div className="nf-slate-pair">
              <Field
                t={t}
                id="firstName"
                name="firstName"
                {...bind("firstName")}
                type="text"
                label={t.signUp.firstNameLabel}
                placeholder={t.signUp.firstNamePlaceholder}
                autoComplete="given-name"
                enterKeyHint="next"
                error={fieldError("firstName")}
              />
              <Field
                t={t}
                id="surname"
                name="surname"
                {...bind("surname")}
                type="text"
                label={t.signUp.surnameLabel}
                placeholder={t.signUp.surnamePlaceholder}
                autoComplete="family-name"
                enterKeyHint="next"
                error={fieldError("surname")}
              />
            </div>
            {/* The address is checked as the field loses focus, so an
                account that already exists is named here rather than
                discovered after a submit. */}
            <EmailTakenNotice
              t={t}
              error={fieldError("email")}
              check={signUpMethodForEmail}
              initialEmail={initialEmail}
            />
            {/* No phone number here (founder, 6 November 2026: "phone number
                should be removed from sign up"). It is asked at the first deal
                instead, by the moments gate (`lib/phone-otp/gate.ts`). */}
            <div>
              <PasswordField
                t={t}
                id="password"
                label={t.auth.passwordLabel}
                placeholder={t.auth.passwordPlaceholder}
                autoComplete="new-password"
                enterKeyHint="done"
                error={fieldError("password")}
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  if (localErrors.password) setLocalErrors((e) => ({ ...e, password: undefined }));
                }}
              />
              <div className="mt-sm">
                <StrengthMeter password={password} t={t} />
              </div>
            </div>
            <ReferralField
              t={t}
              error={state.fieldErrors?.referralCode}
              check={lookupReferrer}
              initialCode={invite?.code ?? ""}
              initialName={invite?.firstName ?? null}
            />
            <AcceptTerms
              t={t}
              accepted={accepted}
              onChange={(next) => {
                setAccepted(next);
                if (next) setAcceptError(false);
              }}
              /* The browser's refusal OR the server's. The server refuses a
                 sign-up that carries no current terms version, and that
                 refusal has to land on this control rather than vanish. */
              showError={acceptError || Boolean(state.fieldErrors?.acceptTerms)}
              adult={adult}
              onAdultChange={(next) => {
                setAdult(next);
                if (next) setAdultError(false);
              }}
              showAdultError={adultError || Boolean(state.fieldErrors?.ageConfirmed)}
            />
          </>
        ) : (
          <>
            <Field
              t={t}
              id="email"
              name="email"
              {...bind("email")}
              type="email"
              label={t.auth.emailLabel}
              placeholder={t.auth.emailPlaceholder}
              autoComplete="email"
              inputMode="email"
              enterKeyHint="next"
              error={state.fieldErrors?.email}
            />
            {/* Email and password on one screen (B-1). When the address
                arrived already filled in (a link carrying it, or an old
                chooser post), the cursor goes to the one thing left to type. */}
            <div>
              <PasswordField
                t={t}
                id="password"
                label={t.auth.passwordLabel}
                placeholder={t.auth.signInPasswordPlaceholder}
                autoComplete="current-password"
                enterKeyHint="go"
                error={state.fieldErrors?.password}
                value={password}
                onChange={setPassword}
                autoFocus={Boolean(initialEmail)}
              />
              <p className="nf-slate-forgot">
                <Link href="/forgot-password" className="nf-tap nf-auth__aside">
                  {t.auth.forgotPassword}
                </Link>
              </p>
            </div>
          </>
        )}

        {/* The refusal and its one way out are said by the one banner at the
            top of the screen (`useAuthBanner`, founder, 7 November 2026). */}

        {/* On sign up the pill rides a bar pinned to the foot of the screen,
            so the one primary action is in view from the first field to the
            last without scrolling to find it. The label stays and dims
            behind a spinner while pending, so the pill keeps its width. */}
        <div className={isSignUp ? "nf-auth__actions nf-auth__actions--sticky" : "nf-auth__actions"}>
          {!isSignUp && !emailReady ? (
            <p className="nf-auth__notice">{t.auth.providerUnavailable}</p>
          ) : (
            <AuthPillButton type="submit" loading={pending || leaving} className="nf-auth__cta">
              {isSignUp ? t.signUp.createAccountCta : t.common.signIn}
            </AuthPillButton>
          )}
        </div>
      </form>

      {/* Google and Apple, round, under the rule: the quicker way to the
          same place. */}
      <div className="nf-slate-stagger">
        <SocialDoors
          t={t}
          googleReady={googleReady}
          appleReady={appleReady}
          surface={surface}
          next={next}
          intent={mode}
        />
      </div>

      <p className="nf-auth__swap">
        {isSignUp ? t.auth.haveAccount : t.auth.noAccount}{" "}
        <Link href={withNext(isSignUp ? "/sign-in" : "/sign-up", next)}>
          {isSignUp ? t.common.signIn : t.common.signUp}
        </Link>
      </p>

      {/* What Vallo is, a quiet door under the swap, with this form as the
          way back (request W2). It opens the steps (`tour=1`): a bare
          `/welcome` with a sign-up door is the intro, whose Get started only
          leads back round to the options page. */}
      {isSignUp && (
        <p className="nf-auth__swap nf-auth__swap--quiet">
          <Link
            href={`/welcome?tour=1&next=${encodeURIComponent(withNext("/sign-up/email", next))}`}
            prefetch={false}
            className="nf-tap"
          >
            {t.welcomeCards.label}
          </Link>
        </p>
      )}
    </div>
  );
}
