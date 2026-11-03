"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";
import { forgetLocalPasscode, rememberPasscode } from "@/lib/passcode/local-verifier";
import { useRouter } from "next/navigation";
import { plural, type Locale } from "@vallo/i18n/core";
import { forgotPasscodeAction, setPasscodeAction } from "@/lib/passcode/actions";
import { signOut } from "@/lib/profile/actions";
import { forgetKeptPages } from "@/lib/offline/page-cache";
import {
  ATTEMPTS_PER_COOLDOWN,
  DEFAULT_PASSCODE_LENGTH,
  isTrivialCode,
  type PasscodeLength,
} from "@/lib/passcode/rules";
import { fill, herePath, markTabUnlocked } from "@/lib/passcode/tab";
import { feedback } from "@/lib/ui/feedback";
import { showSuccess } from "@/lib/ui/success-moments";
import { platformLockAvailable } from "@/lib/security/webauthn-client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BIO_ENROL_HREF, markBioOfferSeen, readBioOfferSeen, shouldOfferBiometric } from "./biometric-offer";
import { Keypad, PasscodeDots } from "./Keypad";
import { PasscodeFrame } from "./PasscodeFrame";
import type { PasscodeCopy } from "./PasscodeLock";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Step = "current" | "enter" | "confirm";

/**
 * SETUP, CONFIRM, AND CHANGE. docs/PASSCODE.md.
 *
 * `first`: after sign-up, or the first visit after the passcode shipped.
 * `reset`: after "Use your password instead" or ten wrong tries, once the
 * member has signed in again. `change`: from Settings, where the current code
 * is asked first unless the member signed in within the last fifteen minutes.
 *
 * The code is typed twice. A trivial code (a repeat, a run, the birth year) is
 * refused here before it is sent and again by the database, which is the
 * authority. Four digits by default (D18); one tap switches to six.
 */
export function PasscodeSetup({
  copy,
  locale,
  mode,
  name,
  avatarUrl,
  overlay,
  askCurrent = false,
  currentLength = DEFAULT_PASSCODE_LENGTH,
  initialLength = DEFAULT_PASSCODE_LENGTH,
  onDone,
  offerBiometric = false,
  userId,
}: {
  copy: PasscodeCopy;
  locale: Locale;
  mode: "first" | "reset" | "change";
  name: string;
  avatarUrl?: string | null;
  overlay: boolean;
  askCurrent?: boolean;
  currentLength?: PasscodeLength;
  initialLength?: PasscodeLength;
  onDone?: (event: "set" | "change" | "reset") => void;
  /**
   * The member holds no platform key yet, so a NEW passcode may be followed,
   * once per device and only where the device can ask its own lock, by the
   * offer to unlock with Face ID or fingerprint next time (`biometric-offer.ts`).
   * The offer links to the enrolment; it unlocks nothing.
   */
  offerBiometric?: boolean;
  /** The signed-in member: the new code is also kept as the phone's own check (`local-verifier.ts`). */
  userId?: string;
}) {
  const titleId = useId();
  const router = useRouter();
  const [step, setStep] = useState<Step>(askCurrent ? "current" : "enter");
  const [length, setLength] = useState<PasscodeLength>(initialLength);
  const [code, setCode] = useState("");
  const [first, setFirst] = useState("");
  const [current, setCurrent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [needsProof, setNeedsProof] = useState(false);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [leaving, startLeaving] = useTransition();
  const sending = useRef(false);
  /* The passcode is saved and the one-time Face ID offer is on screen. */
  const [offering, setOffering] = useState(false);

  /* The typed digits, mirrored in a ref so two keys pressed inside one
     render are both kept. */
  const typed = useRef("");
  const put = useCallback((value: string) => {
    typed.current = value;
    setCode(value);
  }, []);

  const width = step === "current" ? currentLength : length;

  const refuse = useCallback((text: string, back: Step) => {
    feedback("error");
    setShake((n) => n + 1);
    setMessage(text);
    setStep(back);
    setFirst("");
    setCode("");
    typed.current = "";
  }, []);

  const save = useCallback(
    async (confirm: string) => {
      if (sending.current) return;
      sending.current = true;
      setBusy(true);
      try {
        const result = await setPasscodeAction({ code: first, confirm, length, current: current || null });
        if (result.ok) {
          /* The success card lives in the root layout, so it outlasts the
             refresh that swaps this screen for the page. It brings its own
             success haptic. */
          showSuccess(result.event === "set" ? "passcode-set" : "passcode-changed");
          markTabUnlocked();
          /* A new code replaces the phone's own check; where the member is not
             named here (Settings), the old check is simply forgotten. */
          if (userId) void rememberPasscode(userId, first, length);
          else forgetLocalPasscode();
          setMessage(result.event === "change" ? copy.changed : copy.saved);
          put("");
          setFirst("");
          setCurrent("");
          if (onDone) onDone(result.event);
          else if (
            overlay &&
            offerBiometric &&
            result.event === "set" &&
            shouldOfferBiometric({ enrolled: false, supported: await platformLockAvailable(), seen: readBioOfferSeen() })
          ) {
            /* Saved and unlocked already; the offer only waits for a choice. */
            markBioOfferSeen();
            setOffering(true);
          } else router.refresh();
          return;
        }
        switch (result.reason) {
          case "trivial":
            refuse(copy.trivial, "enter");
            break;
          case "mismatch":
          case "length":
            refuse(copy.mismatch, "enter");
            break;
          case "current": {
            const attempt = result.attempt;
            setCurrent("");
            if (attempt?.status === "wrong") {
              refuse(
                attempt.beforeSignOut <= ATTEMPTS_PER_COOLDOWN
                  ? plural(attempt.beforeSignOut, copy.wrongLastBeforeSignOut, locale)
                  : plural(attempt.beforeCooldown, copy.wrongLeft, locale),
                "current",
              );
            } else if (attempt?.status === "cooldown") {
              refuse(fill(copy.cooldown, { seconds: attempt.retryAfterSeconds }), "current");
            } else {
              refuse(copy.wrong, "current");
            }
            break;
          }
          case "proof_required":
            setNeedsProof(true);
            refuse(copy.proofRequired, askCurrent ? "current" : "enter");
            break;
          case "locked-out":
          case "signed-out": {
            const query = new URLSearchParams({ notice: "passcode-locked", next: herePath() });
            window.location.assign(`/sign-in?${query.toString()}`);
            return;
          }
          case "paced":
            refuse(copy.paced, "enter");
            break;
          default:
            refuse(copy.error, "enter");
        }
      } catch {
        refuse(copy.error, "enter");
      } finally {
        sending.current = false;
        setBusy(false);
      }
    },
    [askCurrent, copy, current, first, length, locale, offerBiometric, onDone, overlay, put, refuse, router, userId],
  );

  /* The last digit moves the flow on, from the key press itself. */
  const advance = (value: string) => {
    if (step === "current") {
      setCurrent(value);
      put("");
      setMessage(null);
      setStep("enter");
      return;
    }
    if (step === "enter") {
      if (isTrivialCode(value)) {
        refuse(copy.trivial, "enter");
        typed.current = "";
        return;
      }
      setFirst(value);
      put("");
      setMessage(null);
      setStep("confirm");
      return;
    }
    if (value !== first) {
      refuse(copy.mismatch, "enter");
      typed.current = "";
      return;
    }
    put(value);
    void save(value);
  };

  const onDigit = (digit: string) => {
    if (sending.current) return;
    const current = typed.current;
    if (current.length >= width) return;
    const value = current + digit;
    if (value.length < width) {
      put(value);
      return;
    }
    advance(value);
  };
  const onDelete = useCallback(() => put(typed.current.slice(0, -1)), [put]);

  const switchLength = () => {
    setLength((value) => (value === 6 ? 4 : 6));
    put("");
    setFirst("");
    setMessage(null);
  };

  const title =
    step === "current"
      ? copy.currentTitle
      : step === "confirm"
        ? copy.confirmTitle
        : mode === "reset"
          ? copy.resetTitle
          : copy.setupTitle;
  /* The step line under the title; the longer "why" for a new or reset code
     waits in the status line under the dots until something needs saying. */
  const subtitle =
    step === "current"
      ? copy.currentBody
      : step === "confirm"
        ? fill(copy.stepConfirm, { count: length })
        : fill(copy.stepChoose, { count: length });
  const hint = step === "enter" ? (mode === "reset" ? copy.resetBody : copy.setupBody) : "";

  if (offering) {
    return (
      <PasscodeFrame
        overlay={overlay}
        wordmark={copy.wordmark}
        titleId={titleId}
        title={copy.bioOfferTitle}
        subtitle={copy.bioOfferBody}
        name={name}
        avatarUrl={avatarUrl}
        focal="lock"
        door="biometric"
        testId="passcode-bio-offer"
      >
        <div className="nf-passcode__offer">
          <ButtonLink
            href={BIO_ENROL_HREF}
            variant="primary"
            size="lg"
            full
            className="nf-passcode__bio"
            data-testid="passcode-bio-offer-set-up"
          >
            {copy.bioOfferSetUp}
          </ButtonLink>
          <Button
            variant="secondary"
            size="lg"
            full
            className="nf-passcode__second"
            onClick={() => router.refresh()}
            data-testid="passcode-bio-offer-later"
          >
            {copy.bioOfferLater}
          </Button>
        </div>
      </PasscodeFrame>
    );
  }

  return (
    <PasscodeFrame
      overlay={overlay}
      wordmark={copy.wordmark}
      titleId={titleId}
      title={title}
      subtitle={subtitle}
      name={name}
      avatarUrl={avatarUrl}
      focal="lock"
      testId={`passcode-setup-${step}`}
    >
      <PasscodeDots length={width} filled={code.length} shake={shake} label={fill(copy.digitsEntered, { count: code.length, total: width })} />
      <p className="nf-passcode__message" role="status" aria-live="polite" data-testid="passcode-message">
        {message ?? (busy ? copy.checking : hint)}
      </p>
      <Keypad onDigit={onDigit} onDelete={onDelete} disabled={busy || leaving} label={copy.keypadLabel} deleteLabel={copy.deleteKey} />
      <div className="nf-passcode__foot">
        {step === "enter" ? (
          <button type="button" className="nf-passcode__link" onClick={switchLength} data-testid="passcode-length-switch">
            {length === 6 ? copy.useFour : copy.useSix}
          </button>
        ) : null}
        {needsProof || mode === "reset" ? (
          <button
            type="button"
            className="nf-passcode__link"
            onClick={() => startLeaving(() => forgotPasscodeAction(herePath()))}
            disabled={leaving}
          >
            {copy.usePassword}
          </button>
        ) : null}
        {overlay && mode === "first" ? (
          <button
            type="button"
            className="nf-passcode__link nf-passcode__link--quiet"
            disabled={leaving}
            onClick={() =>
              startLeaving(async () => {
                try {
                  await signOut();
                  /* The pages this phone kept for offline go with the session. */
                  await forgetKeptPages();
                  window.location.assign("/");
                } catch (error) {
                  if (!tapFailedOffline(error)) throw error;
                }
              })
            }
          >
            {copy.signOut}
          </button>
        ) : null}
      </div>
    </PasscodeFrame>
  );
}
