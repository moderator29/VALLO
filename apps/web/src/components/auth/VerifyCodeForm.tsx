"use client";
import "@/app/css/auth.css";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Button } from "@/components/ui/Button";
import { Field } from "./fields";
import { AuthPillButton } from "./slate";
import { useRouter } from "next/navigation";
import { playThreshold, thresholdAllowed } from "@/lib/motion/threshold";
import { motionQuiet } from "@/lib/motion/gate";
import { ArrivalMoment } from "./ArrivalMoment";
import { CodeInput } from "./CodeInput";
import { withNext } from "@/lib/auth/next-link";
import { mailAppFor, resendLabel, RESEND_WAIT_SECONDS } from "@/lib/auth/mail-app";
import { useAuthBanner } from "./use-auth-banner";
import {
  CONFIRMATION_CODE_LENGTH,
  CONFIRMATION_CODE_PLACEHOLDER,
  codeLengthWord,
  readCode,
  surplusMessage,
} from "@/lib/auth/confirmation-code";

/**
 * The code from the confirmation email.
 *
 * This screen is the half of sign-up that never existed. The email has always
 * carried a code as well as a link, under the words "Or enter this code", and
 * there was nowhere to enter it. Somebody who read the code rather than tapping
 * the link had no way forward at all.
 *
 * Typing the last digit submits. Not as a flourish: the code has a known
 * length, so waiting for somebody to reach for a button after they have
 * already given you everything you need is a step that exists for the form's
 * benefit and not for theirs. The button stays for a keyboard, for a paste that
 * lands short, and for anybody who does not trust a form that moves on its own.
 *
 * Pasting works from the code field alone rather than from one box per digit.
 * Separate boxes look considered and then fight every password manager, every
 * "copy" from a mail client that brings a trailing space, and every screen
 * reader, which reads them as a row of unlabelled inputs.
 *
 * HOW LONG THE CODE IS LIVES IN ONE PLACE, `lib/auth/confirmation-code`. This
 * file used to carry its own `const CODE_LENGTH = 6` and its own sentences
 * saying "six digits", and neither moved when the project began issuing eight.
 */

const EMPTY: AuthFormState = { ok: false };

export function VerifyCodeForm({
  t,
  verify,
  resend,
  email,
  next,
}: {
  t: Dictionary;
  verify: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  resend: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  /** Remembered from the sign-up, empty if this was opened on another device. */
  email: string;
  next?: string | undefined;
}) {
  const a = t.authFlow;
  const [state, verifyAction, verifying] = useActionState(verify, EMPTY);
  const [resendState, resendAction, resending] = useActionState(resend, EMPTY);
  useAuthBanner(state);
  useAuthBanner(resendState, resendState.ok ? "success" : "error");
  const [address, setAddress] = useState(email);
  const [code, setCode] = useState("");
  /* Set when somebody hands us more digits than a code has. Ours to say, not
     the server's: the server never sees a value this field refused to send. */
  const [surplus, setSurplus] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  /* How many times the server refused a code, so the cells shake once for
     each (`CodeInput`). Counted as the answer arrives, during render, the
     way the sign-up form picks its step, so no effect re-renders for it. */
  const [answered, setAnswered] = useState(state);
  const [wrongCount, setWrongCount] = useState(0);
  if (answered !== state) {
    setAnswered(state);
    if (state.fieldErrors?.code) setWrongCount((n) => n + 1);
  }

  /*
   * A4: THE SCREEN HELPS WHEN THE CODE DOES NOT COME. "Send a new code"
   * waits thirty seconds (a code was sent a moment ago; a second one sent at
   * once only races the first), counting down in place. Each send starts
   * the wait again, and after two the hint about Spam and Promotions turns
   * into "Still nothing?" with the way to help.
   */
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS);
  const [sends, setSends] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  /*
   * THE MOMENT THE ACCOUNT EXISTS (A17).
   *
   * Confirming by code used to redirect from the server, which put somebody
   * inside the platform on the next frame. The screen now says so first,
   * by name ("You're in, Ada."), for under a second, then goes through the
   * door to where the person was going. Quiet (reduced motion, Calm, Off):
   * the finished picture, and on at once.
   */
  useEffect(() => {
    if (!state.ok || !state.verified) return;
    /* "Welcome to Vallo" follows from the server: the verify action set a
       one-shot cookie that `SuccessFlagHost` reads on the next screen. */
    const to = state.verified;
    const go = () => {
      router.replace(to);
      router.refresh();
    };
    const hold = motionQuiet() ? 350 : 1100;
    const timer = window.setTimeout(() => {
      /* Track M: through the door when motion allows it. */
      if (thresholdAllowed()) void playThreshold("door").then(go);
      else go();
    }, hold);
    return () => window.clearTimeout(timer);
  }, [state.ok, state.verified, router]);

  if (state.ok && state.verified) {
    return <ArrivalMoment t={t} name={state.name} />;
  }

  /*
   * Digits only, and NEVER FEWER THAN THEY GAVE US.
   *
   * The spacing goes, because "  123 456 " and "123-456" are both somebody
   * pasting out of an email and the punctuation is not part of what they meant.
   * The digits stay, all of them. This line used to end `.slice(0, 6)`, which
   * is a decision to throw away part of what a person typed and say nothing
   * about it, and it was only safe while six was true. When the project started
   * issuing eight, the field ate the last two, the server refused the six that
   * were left, and the screen told somebody their code was wrong while showing
   * them the first six digits of the right one. A surplus is now SAID.
   */
  function onCode(value: string) {
    const reading = readCode(value);
    setCode(reading.digits);
    setSurplus(surplusMessage(reading));
    if (reading.complete && !verifying) {
      /* requestSubmit rather than submit, so the form's own validation and the
         action both run exactly as they would on a press. */
      form.current?.requestSubmit();
    }
  }

  /* Every send starts the wait again. */
  const onResend = () => {
    setWait(RESEND_WAIT_SECONDS);
    setSends((n) => n + 1);
  };

  const mail = mailAppFor(address);
  /* Back to the form with the address in it, and the destination kept; the
     form restores the names typed a moment ago (A1's draft, never the
     password). */
  const changeHref = (() => {
    const base = withNext("/sign-up/email", next);
    return address ? `${base}${base.includes("?") ? "&" : "?"}email=${encodeURIComponent(address)}` : base;
  })();

  return (
    <div className="nf-auth__screen nf-verify">
      <div className="nf-slate-stagger">
        <h1 className="nf-auth__title">{a.enterCode}</h1>
        <p className="nf-auth__sub">
          {address.length > 0 ? (
            <>
              {a.sentTo.replace("{count}", codeLengthWord())}{" "}
              <span className="font-semibold text-[var(--nf-content-primary)]">{address}</span>
              {a.sentToTail}
            </>
          ) : (
            <>
              {a.sentNoAddress.replace("{count}", codeLengthWord())}
            </>
          )}
        </p>
        {email.length > 0 && address.length > 0 ? (
          <p className="nf-verify__change">
            {a.wrongAddress}{" "}
            <Link href={changeHref} className="nf-auth__notice-link" data-testid="verify-change-address">
              {a.changeAddress}
            </Link>
          </p>
        ) : null}
      </div>

      <form ref={form} action={verifyAction} className="nf-auth__form nf-auth__form--fields nf-slate-stagger" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

        {/*
          The address is on the form whether or not we remembered it. Opening
          the email on a phone and the code on a laptop is ordinary, and the
          cookie that carries it does not travel between the two. Remembered,
          it is a hidden input and the line above shows it, with a way to
          change it.
        */}
        {email.length > 0 ? (
          <input type="hidden" name="email" value={address} />
        ) : (
          <Field
            t={t}
            id="verify-email"
            name="email"
            type="email"
            label={t.auth.emailLabel}
            placeholder={t.auth.emailPlaceholder}
            autoComplete="email"
            error={state.fieldErrors?.email ?? resendState.fieldErrors?.email}
            value={address}
            onChange={setAddress}
          />
        )}

        {/* The surplus first. It is about what is in the field right now,
            where the server's refusal is about the last thing sent, and the
            newer fact is the one worth reading. */}
        <CodeInput
          id="verify-code"
          name="code"
          label={a.codeLabel}
          length={CONFIRMATION_CODE_LENGTH}
          value={code}
          onChange={onCode}
          error={surplus ?? state.fieldErrors?.code}
          wrongCount={wrongCount}
          placeholder={CONFIRMATION_CODE_PLACEHOLDER}
          cellsLabel={a.codeCells.replace("{count}", codeLengthWord())}
        />

        {/* Said by the one banner at the top of the screen (`useAuthBanner`, founder, 7 November 2026). */}

        {/* The navy pill every other auth screen submits with (E2E audit
            L-7), not the bright-blue primary this one alone was drawing. */}
        <AuthPillButton type="submit" loading={verifying} data-testid="verify-submit">
          {a.confirmAndGo}
        </AuthPillButton>
      </form>

      {/* Its own form, so asking for another code cannot submit the one that
          is already typed, and a refusal on one does not clear the other. */}
      <form action={resendAction} onSubmit={onResend} className="nf-verify__resend nf-slate-stagger">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input type="hidden" name="email" value={address} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          loading={resending}
          disabled={wait > 0}
          data-testid="verify-resend"
        >
          {wait > 0 ? resendLabel(a.resendIn, wait) : a.sendAnother}
        </Button>
        {/* "A new code is on its way" (or the refusal) is said by the one banner. */}
      </form>

      {/* Where the code might be, and one tap to the inbox when we can tell
          which one it is. */}
      <div className="nf-verify__help nf-slate-stagger">
        <p className="nf-verify__hint">{sends >= 2 ? a.stillNothing : a.checkSpam}</p>
        {mail ? (
          <a
            href={mail.href}
            target="_blank"
            rel="noopener noreferrer"
            className="nf-verify__mail nf-tap"
            data-testid="verify-open-mail"
          >
            {a.openMail.replace("{app}", mail.app)}
          </a>
        ) : null}
      </div>

      {/* The house classes, not a one-off. `nf-auth__swap` is what every other
          screen in this card uses for "the other door", and it is the reason
          that door is legible: it draws the link in `--nf-content-link` at 600.
          Colour is never the ONLY signal (rule 13). */}
      <p className="nf-auth__terms nf-verify__same">{a.sameEmailButton}</p>
      <p className="nf-auth__swap mt-xs">
        <Link href="/sign-in">{a.alreadyConfirmed}</Link>
      </p>
      <p className="nf-auth__swap nf-auth__swap--quiet">
        <Link href="/help" className="nf-tap" data-testid="verify-help">
          {a.getHelp}
        </Link>
      </p>
    </div>
  );
}
