"use client";
import "@/app/css/auth.css";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { PhoneField } from "@/components/app/PhoneField";
import { AuthPillButton } from "./slate";
import { CodeInput } from "./CodeInput";
import { confirmPhoneCode, sendPhoneCode } from "@/lib/phone-otp/actions";
import { saveProfilePhone } from "@/lib/settings/profile-phone";
import { formatPhone } from "@/lib/phone";
import { resendLabel, RESEND_WAIT_SECONDS } from "@/lib/auth/mail-app";
import { feedback } from "@/lib/ui/feedback";

const CODE_LENGTH = 6;

/**
 * SIGN-UP, STEP THREE: THE PHONE CODE (2 November 2026).
 *
 * The same screen language as the email code before it (`VerifyCodeForm`):
 * the title, the number the code went to written in full, the code cells that
 * submit on the last digit, "Send a new code" after a short wait, and a way to
 * change the number. The code is sent as the screen opens, once.
 *
 * "Change number" opens the platform's phone field (Nigeria first, every
 * country). A code sent to the new number and confirmed also becomes the
 * number on the profile, so the account has one number, not two.
 *
 * "Do this later" goes on to where the person was going: the first message,
 * booking or payment will ask again, so nobody is trapped here by a network
 * that will not deliver.
 */
export function SignUpPhoneStep({ t, phone, next }: { t: Dictionary; phone: string; next: string }) {
  const copy = t.trustVisible.phone;
  const a = t.authFlow;
  const router = useRouter();
  const [target, setTarget] = useState(phone);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [draft, setDraft] = useState("");
  const [wait, setWait] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [pending, start] = useTransition();
  const sentOnce = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  function send(to: string) {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const result = await sendPhoneCode({ phone: to });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setTarget(result.data.sentTo);
        setSent(true);
        setChanging(false);
        setCode("");
        setWait(RESEND_WAIT_SECONDS);
      } catch {
        setError(copy.sendFailed);
      }
    });
  }

  /* The code goes out as the screen opens, once. */
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    send(phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirm(value: string) {
    setError(null);
    start(async () => {
      try {
        const result = await confirmPhoneCode({ code: value });
        if (!result.ok) {
          feedback("error");
          setWrongCount((n) => n + 1);
          setError(result.error);
          return;
        }
        /* A new number confirmed here is the account's number from now on. */
        if (target !== phone) await saveProfilePhone(target);
        feedback("success");
        setNotice(copy.done);
        window.setTimeout(() => {
          router.replace(next);
          router.refresh();
        }, 700);
      } catch {
        setError(copy.sendFailed);
      }
    });
  }

  function onCode(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH && !pending) confirm(digits);
  }

  const shown = formatPhone(target);

  return (
    <div className="nf-auth__screen nf-verify" data-testid="sign-up-phone">
      <div className="nf-slate-stagger">
        <h1 className="nf-auth__title">{copy.signUpTitle}</h1>
        <p className="nf-auth__sub">
          {(sent ? copy.signUpSentTo : copy.signUpSending).split("{number}")[0]}
          <span className="font-semibold text-[var(--nf-content-primary)]">{shown}</span>
          {(sent ? copy.signUpSentTo : copy.signUpSending).split("{number}")[1]}
        </p>
        {!changing && (
          <p className="nf-verify__change">
            <button
              type="button"
              className="nf-auth__notice-link"
              onClick={() => {
                setDraft("");
                setChanging(true);
                setError(null);
              }}
              data-testid="sign-up-phone-change"
            >
              {copy.changeNumber}
            </button>
          </p>
        )}
      </div>

      {changing ? (
        <form
          className="nf-auth__form nf-auth__form--fields nf-slate-stagger"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) send(draft);
          }}
        >
          <PhoneField name="phone" label={copy.numberLabel} hint={copy.numberHint} value={draft} onChange={setDraft} autoComplete="tel" />
          {error && (
            <p role="alert" className="nf-auth__alert">
              {error}
            </p>
          )}
          <AuthPillButton type="submit" loading={pending} disabled={draft.trim() === ""}>
            {copy.sendToNew}
          </AuthPillButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setChanging(false)}>
            {copy.keepNumber}
          </Button>
        </form>
      ) : (
        <form
          className="nf-auth__form nf-auth__form--fields nf-slate-stagger"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (code.length === CODE_LENGTH) confirm(code);
          }}
        >
          <CodeInput
            id="sign-up-phone-code"
            name="code"
            label={copy.codeLabel}
            length={CODE_LENGTH}
            value={code}
            onChange={onCode}
            error={error}
            wrongCount={wrongCount}
            placeholder="000000"
            cellsLabel={a.codeCells.replace("{count}", "six")}
          />
          {notice && (
            <p role="status" className="nf-auth__notice">
              {notice}
            </p>
          )}
          <AuthPillButton type="submit" loading={pending} disabled={code.length !== CODE_LENGTH} data-testid="sign-up-phone-confirm">
            {copy.confirm}
          </AuthPillButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => send(target)}
            disabled={pending || wait > 0}
            data-testid="sign-up-phone-resend"
          >
            {wait > 0 ? resendLabel(a.resendIn, wait) : copy.resend}
          </Button>
        </form>
      )}

      <p className="nf-auth__swap mt-xs">
        <Link href={next} data-testid="sign-up-phone-later">
          {copy.later}
        </Link>
      </p>
    </div>
  );
}
