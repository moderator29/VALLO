"use client";
import "@/app/css/auth.css";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CODE_START, type CodeSignInState } from "@/lib/auth/code-sign-in-state";
import { sendEmailSignInCode, verifyEmailSignInCode } from "@/lib/auth/email-code";
import { sendPhoneSignInCode, verifyPhoneSignInCode } from "@/lib/auth/phone-sign-in";
import { RESEND_WAIT_SECONDS, resendLabel } from "@/lib/auth/mail-app";
import { CONFIRMATION_CODE_LENGTH, codeLengthWord } from "@/lib/auth/confirmation-code";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "./CodeInput";
import { Field } from "./fields";
import { AuthPillButton } from "./slate";

/* An email code comes from the same GoTrue setting as the sign-up
   confirmation code, so it has the same length (`confirmation-code.ts`); a
   phone code is six digits (`isSixDigits`). */
const PHONE_CODE_LENGTH = 6;

type Mode = "email" | "phone";

/**
 * A3 and A2. Sign in with a six-digit code: by email (no password), or by
 * phone (WhatsApp first, then text). Two steps on one screen, drawn with the
 * auth screens' own classes and field, so it looks like the sign-in it sits
 * beside. The code field takes `one-time-code` autofill.
 *
 * THE CODE STEP IS THE SIGN-UP CODE SCREEN'S (A4, 30 September re-audit):
 * the same cells (`CodeInput`, one real input under them), a shake on a
 * refused code, the last digit sending the form, and "Send a new code"
 * counting down its thirty seconds in place. The actions are unchanged.
 */
export function CodeSignInForm({ mode, t, next }: { mode: Mode; t: Dictionary; next?: string }) {
  const copy = mode === "email" ? t.publicDoors.emailCode : t.publicDoors.phone;
  const codeLength = mode === "email" ? CONFIRMATION_CODE_LENGTH : PHONE_CODE_LENGTH;
  /* The code's length as a word ("six"), so every line follows the code rather than saying 6 by hand. */
  const lengthWord = codeLengthWord(codeLength);
  const [sent, send, sending] = useActionState<CodeSignInState, FormData>(
    mode === "email" ? sendEmailSignInCode : sendPhoneSignInCode,
    CODE_START,
  );
  const [checked, verify, verifying] = useActionState<CodeSignInState, FormData>(
    mode === "email" ? verifyEmailSignInCode : verifyPhoneSignInCode,
    CODE_START,
  );
  const [code, setCode] = useState("");
  const verifyForm = useRef<HTMLFormElement>(null);
  /* One shake per refusal, counted as the answer arrives, as
     VerifyCodeForm does. */
  const [answered, setAnswered] = useState(checked);
  const [wrongCount, setWrongCount] = useState(0);
  /* Which of the two forms answered last: the screen shows that answer.
     (It used to read the step off both at once, and the verify form's
     starting state, "ask", kept the code step from ever showing.) */
  const [latest, setLatest] = useState<"sent" | "checked">("sent");
  if (answered !== checked) {
    setAnswered(checked);
    setLatest("checked");
    if (checked.error === "wrongCode" || checked.error === "badCode") setWrongCount((n) => n + 1);
  }

  /* The resend waits thirty seconds from every send. */
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS);
  const [sentAnswer, setSentAnswer] = useState(sent);
  if (sentAnswer !== sent) {
    setSentAnswer(sent);
    setLatest("sent");
    if (sent.step === "code") setWait(RESEND_WAIT_SECONDS);
  }
  const state = latest === "checked" ? checked : sent;
  const onCode = state.step === "code";
  /* A code tried too often names the check's limit, not the send's "too many
     codes" (errors that name the next action). */
  const message = !state.error
    ? null
    : onCode && state.error === "limited"
      ? copy.verifyLimited
      : ((copy as Record<string, string>)[state.error] ?? copy.failed);

  useEffect(() => {
    if (!onCode || wait <= 0) return;
    const timer = window.setTimeout(() => setWait((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [onCode, wait]);

  const onDigits = (value: string) => {
    const digits = value.replace(/\D/g, "");
    setCode(digits);
    if (digits.length === codeLength && !verifying) verifyForm.current?.requestSubmit();
  };

  return (
    <div className="nf-auth__screen nf-slate-stagger">
      <h1 className="nf-auth__title">{copy.title}</h1>
      <p className="nf-auth__sub">
        {onCode ? (
          <SentTo template={copy.sentTo} slot={mode === "email" ? "{email}" : "{phone}"} shown={sent.shown ?? ""} />
        ) : (
          copy.lede.replace("{count}", lengthWord)
        )}
      </p>

      {!onCode ? (
        <form action={send} className="nf-auth__form nf-auth__form--fields nf-slate-stagger" noValidate>
          {mode === "email" ? (
            <Field
              t={t}
              id="code-email"
              name="email"
              type="email"
              label={t.publicDoors.emailCode.emailLabel}
              placeholder={t.auth.emailPlaceholder}
              autoComplete="email"
              error={state.error === "badTarget" ? t.publicDoors.emailCode.badEmail : undefined}
            />
          ) : (
            <Field
              t={t}
              id="code-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              label={`${t.publicDoors.phone.phoneLabel} (${t.publicDoors.phone.prefix})`}
              placeholder={t.publicDoors.phone.placeholder}
              autoComplete="tel-national"
              error={state.error === "badTarget" ? t.publicDoors.phone.badPhone : undefined}
            />
          )}
          {message && state.error !== "badTarget" && (
            <p role="alert" className="nf-auth__notice">
              {message}
            </p>
          )}
          <div className="nf-auth__actions">
            <AuthPillButton type="submit" loading={sending} className="nf-auth__cta" data-testid={`code-send-${mode}`}>
              {copy.send}
            </AuthPillButton>
          </div>
        </form>
      ) : (
        <form ref={verifyForm} action={verify} className="nf-auth__form nf-auth__form--fields nf-slate-stagger" noValidate>
          <input type="hidden" name="target" value={sent.target ?? ""} />
          {next && <input type="hidden" name="next" value={next} />}
          <CodeInput
            id="code-digits"
            name="code"
            label={copy.codeLabel.replace("{count}", lengthWord)}
            length={codeLength}
            value={code}
            onChange={onDigits}
            error={state.error === "badCode" ? copy.badCode.replace("{count}", lengthWord) : state.error === "wrongCode" ? copy.wrongCode : undefined}
            wrongCount={wrongCount}
            placeholder="123456"
            cellsLabel={t.authFlow.codeCells.replace("{count}", lengthWord)}
          />
          {state.error && state.error !== "badCode" && state.error !== "wrongCode" && message && (
            <p role="alert" className="nf-auth__notice">
              {message}
            </p>
          )}
          <div className="nf-auth__actions">
            <AuthPillButton type="submit" loading={verifying} className="nf-auth__cta" data-testid={`code-verify-${mode}`}>
              {copy.verify}
            </AuthPillButton>
          </div>
        </form>
      )}

      {onCode && (
        <form action={send} className="nf-verify__resend nf-slate-stagger">
          <input type="hidden" name={mode === "email" ? "email" : "phone"} value={sent.target ?? ""} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            loading={sending}
            disabled={wait > 0}
            data-testid={`code-resend-${mode}`}
          >
            {wait > 0 ? resendLabel(t.authFlow.resendIn, wait) : copy.resend}
          </Button>
        </form>
      )}

      <p className="nf-auth__links">
        <Link href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"} className="nf-tap nf-auth__aside">
          <UiIcon name="arrow-left" size={16} />
          {t.publicDoors.emailCode.usePassword}
        </Link>
      </p>
    </div>
  );
}

/** "We sent a code to a***@mail.com." with the address in the ink it is in on the sign-up code screen. */
function SentTo({ template, slot, shown }: { template: string; slot: string; shown: string }) {
  const [before, after = ""] = template.split(slot);
  if (!shown) return <>{template.replace(slot, "")}</>;
  return (
    <>
      {before}
      <span className="font-semibold text-[var(--nf-content-primary)]">{shown}</span>
      {after}
    </>
  );
}
