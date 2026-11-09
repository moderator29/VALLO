"use client";
import "@/app/css/auth.css";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import type { AuthFormState } from "@/lib/auth/form-state";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Field } from "./fields";
import { CodeInput } from "./CodeInput";
import { AuthPillButton } from "./slate";
import {
  CONFIRMATION_CODE_LENGTH,
  CONFIRMATION_CODE_PLACEHOLDER,
  codeLengthWord,
  readCode,
  surplusMessage,
} from "@/lib/auth/confirmation-code";
import { useAuthBanner } from "./use-auth-banner";

const EMPTY: AuthFormState = { ok: false };

/**
 * The reset code: the address and the code from the reset email.
 *
 * The fallback for a reset link opened somewhere the link cannot work (a mail
 * app's own browser, another phone, another browser). A right code makes the
 * recovery session on the server and the action redirects to
 * /reset-password, which then sets the new password exactly as it does after
 * the link. A wrong one gets one neutral sentence on the code field, the same
 * whether or not the address has an account.
 *
 * The address is asked for rather than remembered, because opening the email
 * on one device and typing on another is the case this screen exists for, and
 * nothing this device holds travels with the email. The code field submits
 * the form itself once it holds the whole code, as the sign-up code does.
 */
export function ResetCodeForm({
  t,
  verify,
  initialEmail = "",
  initialState = EMPTY,
}: {
  t: Dictionary;
  verify: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  initialEmail?: string;
  initialState?: AuthFormState;
}) {
  const [state, formAction, pending] = useActionState(verify, initialState);
  useAuthBanner(state);
  const [address, setAddress] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [surplus, setSurplus] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  /* Each refusal shakes the cells once, as on the sign-up code. */
  const [wrongCount, setWrongCount] = useState(0);
  useEffect(() => {
    if (state.fieldErrors?.code) setWrongCount((n) => n + 1);
  }, [state]);

  function onCode(value: string) {
    const reading = readCode(value);
    setCode(reading.digits);
    setSurplus(surplusMessage(reading));
    if (reading.complete && !pending && address.trim().length > 0) {
      form.current?.requestSubmit();
    }
  }

  return (
    <div className="nf-auth__screen nf-slate-stagger">
      <h1 className="nf-auth__title">{t.auth.resetCodeTitle}</h1>
      <p className="nf-auth__sub">{t.auth.resetCodeLead}</p>

      <form ref={form} action={formAction} className="nf-auth__form nf-auth__form--fields nf-slate-stagger" noValidate>
        <Field
          t={t}
          id="reset-email"
          name="email"
          type="email"
          label={t.auth.emailLabel}
          placeholder={t.auth.emailPlaceholder}
          autoComplete="email"
          error={state.fieldErrors?.email}
          value={address}
          onChange={setAddress}
        />
        {/* The same square cells as every other code on the platform; one
            real input underneath, so the phone still offers the code from
            the email above the keyboard. */}
        <CodeInput
          id="reset-code"
          name="code"
          label={t.auth.resetCodeLabel}
          length={CONFIRMATION_CODE_LENGTH}
          value={code}
          onChange={onCode}
          error={surplus ?? state.fieldErrors?.code}
          wrongCount={wrongCount}
          placeholder={CONFIRMATION_CODE_PLACEHOLDER}
          cellsLabel={t.authFlow.codeCells.replace("{count}", codeLengthWord())}
        />

        {/* Said by the one banner at the top of the screen (`useAuthBanner`, founder, 7 November 2026). */}

        <div className="nf-auth__actions">
          <AuthPillButton type="submit" loading={pending} className="nf-auth__cta">
            {t.auth.resetCodeSubmit}
          </AuthPillButton>
        </div>
      </form>

      <p className="nf-auth__links">
        <Link href="/forgot-password" className="nf-tap nf-auth__aside">
          <UiIcon name="arrow-left" size={16} />
          {t.auth.resetCodeAskAgain}
        </Link>
      </p>
    </div>
  );
}
