"use client";
import "@/app/css/auth.css";

import { useActionState } from "react";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import type { AuthFormState } from "@/lib/auth/form-state";
import { requestPasswordReset } from "@/lib/auth/actions";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Field } from "./fields";
import { AuthPillButton, AuthPillLink } from "./slate";
import { useAuthBanner } from "./use-auth-banner";

const EMPTY: AuthFormState = { ok: false };

/**
 * Ask for a reset code.
 *
 * One field, and then one sentence that says the same thing whether or not the
 * address has an account. That sentence is the security property, not a
 * politeness: a form that answers "no account with that email" is an
 * account-existence oracle, and on a platform where people list their homes
 * that is a privacy leak before it is a credential-stuffing aid. The action
 * returns the same message for a match, a miss and a refusal alike.
 *
 * On success the form is replaced rather than left sitting under the
 * confirmation. Nothing useful can be done with it a second time, and leaving
 * it there invites somebody to hammer the button waiting for a different
 * answer they are never going to get.
 */
export function ForgotPasswordForm({ t }: { t: Dictionary }) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, EMPTY);
  const sent = state.ok;
  /* Sent or refused, the sentence is said by the one banner (founder, 7 November 2026). */
  useAuthBanner(state, sent ? "success" : "error");

  return (
    <div className="nf-auth__screen nf-slate-stagger">
      <h1 className="nf-auth__title">{t.auth.resetTitle}</h1>
      <p className="nf-auth__sub">{sent ? t.auth.resetSentLead : t.auth.resetLead}</p>

      {sent ? (
        <>
          {/* The email carries the code alone (29 October 2026), so typing
              it is the way on, and the button leads there. */}
          <p className="nf-auth__hint">{t.auth.resetHaveCode}</p>
          <div className="nf-auth__form">
            <AuthPillLink href="/forgot-password/code">
              {t.auth.resetEnterCode}
            </AuthPillLink>
          </div>
          <p className="nf-auth__hint">{t.auth.resetNotArrived}</p>
        </>
      ) : (
        <form action={formAction} className="nf-auth__form nf-auth__form--fields nf-slate-stagger" noValidate>
          <Field
            t={t}
            id="email"
            name="email"
            type="email"
            label={t.auth.emailLabel}
            placeholder={t.auth.emailPlaceholder}
            autoComplete="email"
            error={state.fieldErrors?.email}
          />

          {/* Said by the one banner at the top of the screen (`useAuthBanner`, founder, 7 November 2026). */}

          <div className="nf-auth__actions">
            <AuthPillButton type="submit" loading={pending} className="nf-auth__cta">
              {t.auth.resetSend}
            </AuthPillButton>
          </div>
        </form>
      )}

      <p className="nf-auth__links">
        <Link href="/sign-in" className="nf-tap nf-auth__aside">
          <UiIcon name="arrow-left" size={16} />
          {t.common.signIn}
        </Link>
      </p>
    </div>
  );
}
