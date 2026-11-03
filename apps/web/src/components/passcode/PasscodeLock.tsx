"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { plural, type Dictionary, type Locale } from "@vallo/i18n/core";
import { forgotPasscodeAction, verifyPasscodeAction, type VerifyResult } from "@/lib/passcode/actions";
import { ATTEMPTS_PER_COOLDOWN, cooldownRemaining, type PasscodeLength } from "@/lib/passcode/rules";
import type { LockMode } from "@/lib/passcode/decide";
import { fill, herePath, markTabUnlocked } from "@/lib/passcode/tab";
import { thresholdAllowed } from "@/lib/motion/threshold";
import { signOut } from "@/lib/profile/actions";
import { forgetKeptPages } from "@/lib/offline/page-cache";
import { feedback } from "@/lib/ui/feedback";
import { sleepUntilOnline, verifyPatiently } from "@/lib/passcode/patient-verify";
import { canCheckLocally, checkLocally, forgetLocalPasscode, rememberPasscode } from "@/lib/passcode/local-verifier";
import { catchUpWithServer } from "@/lib/passcode/server-catch-up";
import { Button } from "@/components/ui/Button";
import { Keypad, PasscodeDots } from "./Keypad";
import { PasskeyUnlockKey } from "./PasskeyUnlockKey";
import { readDeviceLock, type DeviceLock } from "@/lib/security/device-lock";
import { platformLockAvailable } from "@/lib/security/webauthn-client";
import { PasscodeFrame } from "./PasscodeFrame";
import { OPEN_HOLD_MS, OPEN_LEAVE_MS, arriveThroughOpenDoor } from "./open-door";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

export type PasscodeCopy = Dictionary["passcode"];

/** One id per typed code, so asking again never counts it twice. */
function newAttemptId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }
}

/** How long an accepted unlock waits for the page before loading it outright. */
const UNLOCK_GIVE_UP_MS = 6000;
/** On a slow link the refresh is still on its way at six seconds; a reload then only starts it again. */
const UNLOCK_GIVE_UP_SLOW_MS = 20000;

function giveUpAfterMs(): number {
  try {
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
    if (connection?.saveData || /(^|-)2g$|^3g$/.test(connection?.effectiveType ?? "")) return UNLOCK_GIVE_UP_SLOW_MS;
  } catch {
    /* No connection hint: the usual wait. */
  }
  return UNLOCK_GIVE_UP_MS;
}

/**
 * "HELLO, ADA": the lock. docs/PASSCODE.md; the founder's reference 6
 * (docs/design/PREMIUM-STANDARD.md, 7 October 2026): a lit Vallo scene on
 * top, a raised sheet rising over it with the member's face and their first
 * name, a way to switch account, biometric first where a passkey is
 * enrolled and the passcode second; the keypad arrives with the sheet.
 *
 * WHAT IS UNCHANGED (security, all of it): the code is sent the moment its
 * last digit is typed, checked by `passcode_verify` in the database, and
 * forgotten here as soon as the answer arrives. A wrong code shakes the dots
 * and says how many tries are left before the pause and before the
 * sign-out; a cooldown disables the keypad and counts down; the tenth wrong
 * try signs this browser out and lands on sign-in with the reason. The
 * biometric is the same server-verified ceremony (`PasskeyUnlockKey`).
 *
 * WHAT IS NEW IS PRESENTATION:
 *
 *   biometric first  where the member has a platform key, the sheet offers
 *                    "Unlock with Face ID or fingerprint" as the primary and
 *                    "Use your passcode" under it; choosing the keypad, a
 *                    failed biometric or a digit typed on a keyboard brings
 *                    the keypad, which keeps the biometric in its corner key.
 *   switch account   ends this session on this device (`signOut`, the same
 *                    action setup's "Sign out" uses) and opens sign in. It
 *                    unlocks nothing.
 *   the open door    a right code holds its full row 80ms, the sheet and the
 *                    scene leave on `leave`, and the app comes forward
 *                    through the startup's own `open` arrival
 *                    (`open-door.ts`), so unlocking and arriving are one
 *                    move. The hold is on a code the server has ALREADY
 *                    accepted, never a wait dressed as checking. Quiet
 *                    readers hand over at once.
 */
export function PasscodeLock({
  copy,
  locale,
  mode,
  length,
  lockedUntil,
  name,
  avatarUrl,
  onUnlocked,
  verify = verifyPasscodeAction,
  passkey: passkeyKept = false,
  userId,
  retryGaps,
}: {
  copy: PasscodeCopy;
  locale: Locale;
  mode: LockMode;
  length: PasscodeLength;
  lockedUntil?: string | null;
  name: string;
  avatarUrl?: string | null;
  /** Called after a right code. Without it the route is refreshed from the server. */
  onUnlocked?: () => void;
  /** The check. Always the real action in the app; the preview harness passes a fixture. */
  verify?: (code: string, attemptId?: string) => Promise<VerifyResult>;
  /** C14: this member has a platform key, so the lock offers Face ID or fingerprint. */
  passkey?: boolean;
  /**
   * The signed-in member (2 November 2026): binds the phone's own check of the
   * code (`local-verifier.ts`). Without it the server is the only check.
   */
  userId?: string;
  /** The gaps between asks on a lost answer (`RETRY_GAPS_MS`); a test passes short ones. */
  retryGaps?: readonly number[];
}) {
  const titleId = useId();
  const router = useRouter();
  /* The member holds a platform key, but this device may not be able to ask
     for it (a desktop browser with no Hello or Touch ID): never offer a method
     the device lacks (27 October 2026). Optimistic until the browser answers,
     so a phone does not see the keypad flash first. */
  /* Biometric first where the member has a platform key; the keypad after. */
  const [door, setDoor] = useState<"biometric" | "keypad">(passkeyKept ? "biometric" : "keypad");
  const [deviceCanAsk, setDeviceCanAsk] = useState(true);
  const [deviceLock, setDeviceLock] = useState<DeviceLock>("this-device");
  useEffect(() => {
    if (!passkeyKept) return;
    setDeviceLock(readDeviceLock());
    let live = true;
    void platformLockAvailable().then((ok) => {
      if (!live) return;
      setDeviceCanAsk(ok);
      if (!ok) setDoor("keypad");
    });
    return () => {
      live = false;
    };
  }, [passkeyKept]);
  const passkey = passkeyKept && deviceCanAsk;
  const passkeyLabel = copy.passkeyUnlockBy[deviceLock];
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(mode === "unavailable" ? copy.unavailable : null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState<number>(() => {
    const seconds = cooldownRemaining(lockedUntil ?? null, Date.now());
    return seconds > 0 ? Date.now() + seconds * 1000 : 0;
  });
  const [now, setNow] = useState(() => Date.now());
  const [leaving, startLeaving] = useSafeTransition();
  const sending = useRef(false);
  /* The code the network did not answer, kept for Try again with its attempt id. */
  const [stranded, setStranded] = useState<{ code: string; attemptId: string } | null>(null);
  /* The right answer has landed and the door is opening. */
  const [opening, setOpening] = useState(false);
  const opened = useRef(false);

  /* The far side of the door: when this lock leaves the screen after a right
     answer (the page replaces it, or the guard lets go), the app comes
     forward through the `open` arrival. The hold, the leave and the give-up
     are tracked, and the lock knows whether it is still on screen: a right
     code sets the unlock cookie, so Next can re-render the gate as unlocked
     and unmount this lock before the door has run, and an untracked timer
     would then refresh or reload a page the member is already using. */
  const stuck = useRef(0);
  const hold = useRef(0);
  const leave = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(hold.current);
      window.clearTimeout(leave.current);
      window.clearTimeout(stuck.current);
      if (opened.current) arriveThroughOpenDoor();
    };
  }, []);

  /* Unlocked (the server said so): hold the full row, open the door, hand over. */
  const unlock = useCallback(() => {
    markTabUnlocked();
    setMessage(null);
    opened.current = true;
    const finish = () => {
      if (!mounted.current) return;
      if (onUnlocked) onUnlocked();
      router.refresh();
      /* If the refreshed page has not replaced the lock in a few seconds (a
         dropped request), load it outright rather than leave somebody at an
         open door. The server has already accepted the unlock. */
      stuck.current = window.setTimeout(() => window.location.reload(), giveUpAfterMs());
    };
    if (!thresholdAllowed()) {
      finish();
      return;
    }
    hold.current = window.setTimeout(() => {
      if (!mounted.current) return;
      setOpening(true);
      leave.current = window.setTimeout(finish, OPEN_LEAVE_MS);
    }, OPEN_HOLD_MS);
  }, [onUnlocked, router]);

  const cooling = waitUntil > now;
  const secondsLeft = cooling ? Math.ceil((waitUntil - now) / 1000) : 0;

  useEffect(() => {
    if (!waitUntil) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= waitUntil) {
        setWaitUntil(0);
        setMessage(null);
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [waitUntil]);

  /* Unlocked on the phone: the page behind is already here; the server catches up. */
  const unlockOnPhone = useCallback(
    (attempt: string) => {
      markTabUnlocked();
      setMessage(null);
      opened.current = true;
      catchUpWithServer(attempt, verify);
      if (onUnlocked) onUnlocked();
    },
    [onUnlocked, verify],
  );

  const submit = useCallback(
    async (attempt: string, attemptId: string = newAttemptId()) => {
      if (sending.current) return;
      sending.current = true;
      setBusy(true);
      setStranded(null);
      let keepForRetry = false;
      try {
        /* Patient on a weak signal (2 November 2026): a lost answer is asked
           again under the same attempt id, so the database counts it once. */
        const result = await verifyPatiently(
          {
            verify,
            isOnline: () => navigator.onLine !== false,
            sleep: sleepUntilOnline,
            onRetry: () => setMessage(copy.slow),
            ...(retryGaps ? { gaps: retryGaps } : {}),
          },
          attempt,
          attemptId,
        );
        switch (result.status) {
          case "ok":
            feedback("confirm");
            if (userId) void rememberPasscode(userId, attempt, length);
            unlock();
            /* The row stays full through the hold and the door. */
            return;
          case "unreachable": {
            /* No answer at all. Over a page that is already on this phone, the
               phone's own check opens it; otherwise the code waits for Try again. */
            if (onUnlocked && userId && canCheckLocally(userId)) {
              const local = await checkLocally(userId, attempt);
              if (local === "ok") {
                feedback("confirm");
                unlockOnPhone(attempt);
                return;
              }
              if (local === "wrong") {
                feedback("error");
                setShake((n) => n + 1);
                setMessage(copy.wrongOffline);
                break;
              }
            }
            keepForRetry = true;
            setStranded({ code: attempt, attemptId });
            setMessage(copy.unreachable);
            return;
          }
          case "wrong":
            feedback("error");
            setShake((n) => n + 1);
            setMessage(
              result.beforeSignOut <= ATTEMPTS_PER_COOLDOWN
                ? plural(result.beforeSignOut, copy.wrongLastBeforeSignOut, locale)
                : plural(result.beforeCooldown, copy.wrongLeft, locale)
            );
            break;
          case "cooldown":
          case "paced": {
            feedback("error");
            setShake((n) => n + 1);
            const until = Date.now() + result.retryAfterSeconds * 1000;
            setNow(Date.now());
            setWaitUntil(until);
            setMessage(result.status === "paced" ? copy.paced : null);
            break;
          }
          case "signed-out": {
            forgetLocalPasscode();
            const query = new URLSearchParams({
              notice: "passcode-locked",
              next: herePath(),
            });
            window.location.assign(`/sign-in?${query.toString()}`);
            return;
          }
          case "setup":
            router.refresh();
            return;
          default:
            setMessage(copy.error);
        }
      } catch {
        setMessage(copy.error);
      } finally {
        setBusy(false);
        /* A right code keeps its full row and the send lock through the
           door; a code the network never answered stays for Try again;
           anything else clears for the next try. */
        if (!opened.current) {
          sending.current = false;
          if (!keepForRetry) setCode("");
        }
      }
    },
    [copy, length, locale, onUnlocked, retryGaps, router, unlock, unlockOnPhone, userId, verify]
  );

  const tryAgain = useCallback(() => {
    if (stranded) void submit(stranded.code, stranded.attemptId);
  }, [stranded, submit]);

  /* The signal is back while a code waits: send it again by itself. */
  useEffect(() => {
    if (!stranded) return;
    const back = () => tryAgain();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [stranded, tryAgain]);

  const onDigit = useCallback(
    (digit: string) => {
      if (sending.current) return;
      /* A digit typed while the biometric door is offered is the person
         choosing the keypad. */
      setDoor("keypad");
      if (stranded) {
        setStranded(null);
        setMessage(null);
        setCode(digit);
        return;
      }
      setCode((current) => (current.length >= length ? current : current + digit));
    },
    [length, stranded]
  );

  /* The last digit sends the code. */
  useEffect(() => {
    if (code.length === length && !sending.current && !stranded) void submit(code);
  }, [code, length, stranded, submit]);
  const onDelete = useCallback(() => {
    /* Deleting a code the network never answered starts again. */
    if (stranded) {
      setStranded(null);
      setMessage(null);
      setCode("");
      return;
    }
    setCode((current) => current.slice(0, -1));
  }, [stranded]);

  const usePassword = () => startLeaving(() => forgotPasscodeAction(herePath()));
  /* Another account on this device: end this session here, then sign in. */
  const switchAccount = () =>
    startLeaving(async () => {
      try {
        await signOut();
        /* The pages this phone kept for offline go with the session. */
        await forgetKeptPages();
        window.location.assign("/sign-in");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  /*
   * LEAVING THE BIOMETRIC DOOR FOR THE KEYPAD. The door's buttons unmount
   * when the keypad replaces them, and focus inside a modal dialog would fall
   * to <body>. So choosing "Use your passcode" lands on the first key; a digit
   * typed on the keyboard lands on the title (the lock's own opening focus),
   * and only when focus would otherwise be lost.
   */
  const focusAfterSwitch = useRef<"key" | "title" | null>(null);
  const toKeypad = useCallback((focus: "key" | "title") => {
    focusAfterSwitch.current = focus;
    setDoor("keypad");
  }, []);
  useEffect(() => {
    const want = focusAfterSwitch.current;
    if (door !== "keypad" || !want) return;
    focusAfterSwitch.current = null;
    const frame = document.getElementById(titleId)?.closest<HTMLElement>(".nf-passcode");
    if (!frame) return;
    const active = document.activeElement;
    if (want === "title" && active instanceof HTMLElement && active !== document.body && frame.contains(active)) return;
    const target =
      want === "key" ? frame.querySelector<HTMLElement>('[data-testid="passcode-keypad"] button:not(:disabled)') : null;
    (target ?? document.getElementById(titleId))?.focus();
  }, [door, titleId]);

  const first = name.trim().split(/\s+/)[0] ?? "";
  const title = first ? fill(copy.hello, { name: first }) : copy.helloNoName;
  const passwordOnly = mode === "password-only";
  const status = cooling ? fill(copy.cooldown, { seconds: secondsLeft }) : message;

  const biometricFirst = passkey && door === "biometric" && !cooling;
  const onPasskeyFailed = () => {
    if (door === "biometric") toKeypad("key");
    setMessage(copy.passkeyFailed);
  };

  /* Typing on the biometric door: the keypad's own keyboard listener is not
     mounted there, so a digit switches to it and lands as the first. */
  const doorIdle = biometricFirst && !busy && !leaving && !opening;
  useEffect(() => {
    if (!doorIdle) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!/^[0-9]$/.test(event.key)) return;
      event.preventDefault();
      feedback("select");
      toKeypad("title");
      onDigit(event.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doorIdle, onDigit, toKeypad]);

  return (
    <PasscodeFrame
      overlay
      wordmark={copy.wordmark}
      titleId={titleId}
      title={title}
      subtitle={passwordOnly ? copy.lockedTitle : biometricFirst ? null : copy.enterCode}
      name={name}
      avatarUrl={avatarUrl}
      testId="passcode-lock"
      opening={opening}
      door={passwordOnly ? "keypad" : biometricFirst ? "biometric" : "keypad"}
      aside={
        <button
          type="button"
          className="nf-passcode__switch"
          onClick={switchAccount}
          disabled={leaving || opening}
          data-testid="passcode-switch-account"
        >
          {copy.switchAccount}
        </button>
      }
    >
      {passwordOnly ? (
        <p className="nf-passcode__message nf-passcode__message--block" role="status">
          {copy.passwordOnly}
        </p>
      ) : biometricFirst ? (
        <div className="nf-passcode__offer">
          <PasskeyUnlockKey
            variant="door"
            label={passkeyLabel}
            lock={deviceLock}
            disabled={busy || leaving || opening}
            onUnlocked={() => {
              feedback("confirm");
              unlock();
            }}
            onFailed={onPasskeyFailed}
          />
          <Button
            variant="secondary"
            size="lg"
            full
            className="nf-passcode__second"
            onClick={() => toKeypad("key")}
            disabled={leaving || opening}
            data-testid="passcode-use-keypad"
          >
            {copy.withPasscode}
          </Button>
          <p className="nf-passcode__message" role="status" aria-live="polite" data-testid="passcode-message">
            {status ?? ""}
          </p>
        </div>
      ) : (
        <>
          <PasscodeDots
            length={length}
            filled={code.length}
            shake={shake}
            label={fill(copy.digitsEntered, {
              count: code.length,
              total: length,
            })}
          />
          <p className="nf-passcode__message" role="status" aria-live="polite" data-testid="passcode-message">
            {status ?? (busy ? copy.checking : "")}
          </p>
          {stranded && !busy ? (
            <button type="button" className="nf-passcode__link" onClick={tryAgain} data-testid="passcode-try-again">
              {copy.tryAgain}
            </button>
          ) : null}
          <Keypad
            onDigit={onDigit}
            onDelete={onDelete}
            disabled={busy || cooling || leaving || opening}
            label={copy.keypadLabel}
            deleteLabel={copy.deleteKey}
            accessory={
              passkey && !cooling ? (
                <PasskeyUnlockKey
                  label={passkeyLabel}
            lock={deviceLock}
                  disabled={busy || leaving || opening}
                  onUnlocked={() => {
                    feedback("confirm");
                    unlock();
                  }}
                  onFailed={onPasskeyFailed}
                />
              ) : undefined
            }
          />
        </>
      )}
      <div className="nf-passcode__foot">
        <button
          type="button"
          className={passwordOnly ? "nf-btn nf-btn--primary nf-passcode__cta" : "nf-passcode__link"}
          onClick={usePassword}
          disabled={leaving || opening}
          data-testid="passcode-use-password"
        >
          {passwordOnly ? copy.signInAgain : copy.usePassword}
        </button>
      </div>
    </PasscodeFrame>
  );
}
