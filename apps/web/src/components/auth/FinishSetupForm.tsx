"use client";
import "@/app/css/auth.css";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import type { AuthFormState } from "@/lib/auth/form-state";
import { signOut } from "@/lib/profile/actions";
import { AcceptTerms } from "./AcceptTerms";
import { Field } from "./fields";
import { AuthPillButton } from "./slate";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { useAuthBanner } from "./use-auth-banner";

const EMPTY: AuthFormState = { ok: false };

/**
 * "Finish setting up" (B-2), in the Slate dress of every other auth screen.
 *
 * A new Google or Apple account lands here from the callback, and every app
 * route sends it back here until it is done (`proxy.ts`). It asks for the
 * three things the sign-up form asks that a provider cannot answer: the name
 * (filled in from what the provider sent), the terms and the 18+ statement.
 *
 * The ticks are held in state and the submit is refused here without a round
 * trip, exactly like the sign-up form; the SERVER refuses the same way
 * (`finishSocialSetup` checks the current terms version and `18+`), so a
 * hand-built post or a browser with no script cannot get past it.
 */
export function FinishSetupForm({
  t,
  action,
  next,
  initialFirstName,
  initialSurname,
}: {
  t: Dictionary;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next?: string | undefined;
  initialFirstName: string;
  initialSurname: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  useAuthBanner(state);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [surname, setSurname] = useState(initialSurname);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState(false);
  const [adult, setAdult] = useState(false);
  const [adultError, setAdultError] = useState(false);
  const [refused, setRefused] = useState(0);
  const [leaving, startLeaving] = useSafeTransition();
  const formRef = useRef<HTMLFormElement>(null);

  /* F-12: a refused submit puts the cursor on the first thing to fix. */
  useEffect(() => {
    if (refused === 0 && !state.fieldErrors) return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    invalid?.focus();
  }, [refused, state]);

  return (
    <div className="nf-auth__screen">
      <div className="nf-slate-stagger">
        <h1 className="nf-auth__title">{t.auth.finishTitle}</h1>
        <p className="nf-slate-note mt-sm">{t.auth.finishLead}</p>
      </div>

      <form
        ref={formRef}
        action={formAction}
        noValidate
        onSubmit={(e) => {
          /* Dispatched here so React does not reset the form after a refusal
             (UX-14); `action` still serves a submit made before hydration. */
          e.preventDefault();
          if (!accepted || !adult) {
            setAcceptError(!accepted);
            setAdultError(!adult);
            setRefused((n) => n + 1);
            return;
          }
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="nf-auth__form nf-auth__form--fields nf-slate-stagger"
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="nf-slate-pair">
          <Field
            t={t}
            id="firstName"
            name="firstName"
            type="text"
            value={firstName}
            onChange={setFirstName}
            label={t.signUp.firstNameLabel}
            placeholder={t.signUp.firstNamePlaceholder}
            autoComplete="given-name"
            error={state.fieldErrors?.firstName}
          />
          <Field
            t={t}
            id="surname"
            name="surname"
            type="text"
            value={surname}
            onChange={setSurname}
            label={t.signUp.surnameLabel}
            placeholder={t.signUp.surnamePlaceholder}
            autoComplete="family-name"
            error={state.fieldErrors?.surname}
          />
        </div>

        <AcceptTerms
          t={t}
          accepted={accepted}
          onChange={(value) => {
            setAccepted(value);
            if (value) setAcceptError(false);
          }}
          showError={acceptError || Boolean(state.fieldErrors?.acceptTerms)}
          adult={adult}
          onAdultChange={(value) => {
            setAdult(value);
            if (value) setAdultError(false);
          }}
          showAdultError={adultError || Boolean(state.fieldErrors?.ageConfirmed)}
        />

        {/* Said by the one banner at the top of the screen (`useAuthBanner`, founder, 7 November 2026). */}

        <div className="nf-auth__actions">
          <AuthPillButton type="submit" loading={pending} className="nf-auth__cta">
            {t.auth.finishCta}
          </AuthPillButton>
        </div>
      </form>

      {/* The way out. A server action, so the edge gate never holds it. */}
      <p className="nf-auth__swap">
        {t.auth.finishNotYou}{" "}
        <button
          type="button"
          className="nf-tap nf-auth__aside underline underline-offset-4"
          disabled={leaving}
          onClick={() =>
            startLeaving(async () => {
              try {
                await signOut();
                window.location.assign("/sign-in?notice=signed-out");
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            })
          }
        >
          {t.auth.finishSignOut}
        </button>
      </p>
    </div>
  );
}
