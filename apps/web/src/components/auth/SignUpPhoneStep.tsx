"use client";
import "@/app/css/auth.css";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { AuthPillButton } from "./slate";
import { CodeInput } from "./CodeInput";
import { confirmPhoneCode, sendPhoneCode } from "@/lib/phone-otp/actions";
import { formatPhone } from "@/lib/phone";
import { resendLabel, RESEND_WAIT_SECONDS } from "@/lib/auth/mail-app";
import { feedback } from "@/lib/ui/feedback";
import { retryLost } from "@/lib/offline/retry-lost";

const CODE_LENGTH = 6;

/**
 * SIGN-UP, STEP THREE: THE PHONE CODE (2 November 2026).
 *
 * The same screen language as the email code before it (`VerifyCodeForm`):
 * the title, the number the code went to written in full, the code cells that
 * submit on the last digit, and "Send a new code" after a short wait. The code
 * is sent as the screen opens, once.
 *
 * THE NUMBER CANNOT BE CHANGED HERE (the founder, 2 November 2026): a mobile
 * number is part of who the account is, so the screen offers no other number,
 * only "Wrong number? Contact support".
 *
 * "Do this later" goes on to where the person was going: the first message,
 * booking or payment will ask again, so nobody is trapped here by a network
 * that will not deliver.
 */
export function SignUpPhoneStep({ t, phone, next }: { t: Dictionary; phone: string; next: string }) {
  const copy = t.trustVisible.phone;
  const a = t.authFlow;
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
        setSent(true);
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
        const result = await retryLost(() => confirmPhoneCode({ code: value }));
        if (!result.ok) {
          feedback("error");
          setWrongCount((n) => n + 1);
          setError(result.error);
          return;
        }
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

  const shown = formatPhone(phone);

  return (
    <div className="nf-auth__screen nf-verify" data-testid="sign-up-phone">
      <div className="nf-slate-stagger">
        <h1 className="nf-auth__title">{copy.signUpTitle}</h1>
        <p className="nf-auth__sub">
          {(sent ? copy.signUpSentTo : copy.signUpSending).split("{number}")[0]}
          <span className="font-semibold text-[var(--nf-content-primary)]">{shown}</span>
          {(sent ? copy.signUpSentTo : copy.signUpSending).split("{number}")[1]}
        </p>
        <p className="nf-verify__change">
          {copy.wrongNumber}{" "}
          <Link href="/support" className="nf-auth__notice-link" data-testid="sign-up-phone-support">
            {copy.contactSupport}
          </Link>
        </p>
      </div>

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
          onClick={() => send(phone)}
          disabled={pending || wait > 0}
          data-testid="sign-up-phone-resend"
        >
          {wait > 0 ? resendLabel(a.resendIn, wait) : copy.resend}
        </Button>
      </form>

      <p className="nf-auth__swap mt-xs">
        <Link href={next} data-testid="sign-up-phone-later">
          {copy.later}
        </Link>
      </p>
    </div>
  );
}
