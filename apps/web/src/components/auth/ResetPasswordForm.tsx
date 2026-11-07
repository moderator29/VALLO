"use client";
import "@/app/css/auth.css";

import { useActionState, useMemo, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import type { AuthFormState } from "@/lib/auth/form-state";
import { updatePassword } from "@/lib/auth/actions";
import { PasswordField, StrengthMeter } from "./fields";
import { AuthPillButton } from "./slate";
import { useAuthBanner } from "./use-auth-banner";

const EMPTY: AuthFormState = { ok: false };

/**
 * Choose the new password.
 *
 * Reached only through the recovery link, which lands on `/auth/callback`,
 * exchanges its code for a session and forwards here. That session IS the
 * authorisation for half an hour, so the old password is not asked. Any other
 * session (signed in the ordinary way) is asked for the current password
 * first, because a stolen session must not be able to change it. The screen
 * never carries a token in its own URL, which is what stops one being left in
 * a browser history or a shared link.
 *
 * Same strength meter and same confirm check as sign-up, from the same module,
 * so the rules a person met when they created the account are the rules they
 * meet when they replace it.
 */
export function ResetPasswordForm({
  t,
  askCurrent = false,
}: {
  t: Dictionary;
  /**
   * The session did not come from a recent recovery link, so the server will
   * ask for the current password; the field is drawn up front rather than
   * after a refusal.
   */
  askCurrent?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updatePassword, EMPTY);
  /* The refusal's way on is always a new code, so the banner carries it. */
  const answer = useMemo(
    () => (state.message ? { ...state, action: state.action ?? { href: "/forgot-password", label: t.auth.resetSend } } : state),
    [state, t.auth.resetSend],
  );
  useAuthBanner(answer);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  /* Judged once the second password is as long as the first: the words go
     to the banner now, and a banner on the first keystroke would scold. */
  const mismatch = confirm.length > 0 && confirm.length >= password.length && confirm !== password;
  const confirmError = mismatch ? t.authFlow.passwordsDiffer : state.fieldErrors?.confirmPassword;

  return (
    <div className="nf-auth__screen nf-slate-stagger">
      <h1 className="nf-auth__title">{t.auth.newPasswordTitle}</h1>
      <p className="nf-auth__sub">{t.auth.newPasswordLead}</p>

      <form action={formAction} className="nf-auth__form nf-auth__form--fields nf-slate-stagger" noValidate>
        {(askCurrent || state.fieldErrors?.currentPassword) && (
          <PasswordField
            t={t}
            id="currentPassword"
            label={t.auth.currentPasswordLabel}
            placeholder={t.auth.currentPasswordPlaceholder}
            autoComplete="current-password"
            error={state.fieldErrors?.currentPassword}
            value={current}
            onChange={setCurrent}
          />
        )}
        <PasswordField
          t={t}
          id="password"
          label={t.auth.newPasswordLabel}
          placeholder={t.auth.passwordPlaceholder}
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          value={password}
          onChange={setPassword}
        />
        <StrengthMeter password={password} t={t} />
        <PasswordField
          t={t}
          id="confirmPassword"
          label={t.auth.confirmPasswordLabel}
          placeholder={t.auth.confirmPasswordPlaceholder}
          autoComplete="new-password"
          error={confirmError}
          value={confirm}
          onChange={setConfirm}
        />

        {/* Said by the one banner at the top of the screen, with "Send a new
            code" as its action (`useAuthBanner`, founder, 7 November 2026). */}

        <div className="nf-auth__actions">
          <AuthPillButton type="submit" loading={pending} className="nf-auth__cta">
            {t.auth.newPasswordSave}
          </AuthPillButton>
        </div>
      </form>
    </div>
  );
}

