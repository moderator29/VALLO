"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { plural, type Locale } from "@vallo/i18n/core";
import { Keypad, PasscodeDots } from "@/components/passcode/Keypad";
import type { PasscodeCopy } from "@/components/passcode/PasscodeLock";
import { turnOffPasscodeAction } from "@/lib/passcode/actions";
import { beginPasskeyUnlock, finishPasscodeOffWithKey } from "@/lib/passcode/passkey-unlock";
import { forgetLocalPasscode } from "@/lib/passcode/local-verifier";
import { forgetTab } from "@/lib/passcode/tab";
import { assertPlatformKey, platformLockAvailable } from "@/lib/security/webauthn-client";
import { banner } from "@/lib/ui/toast";

/**
 * TURN THE PASSCODE OFF (13 November 2026, the founder: "same as Face ID,
 * build it end to end"). The passcode is off by default and the member turns
 * it on; this is the way back. Never on a tap alone: the current code (checked
 * by the database exactly as the lock checks it, every wrong try counted), or
 * Face ID or a fingerprint (a server-verified proof bound to turning it off).
 * Then the lock is gone from the account (`lib/passcode/turn-off.ts`), this
 * phone forgets its local copy and its tab mark, one calm banner says so, and
 * the screen shows the first-time setup again.
 */
export function TurnOffPasscode({
  copy,
  locale,
  length,
  passkey,
}: {
  copy: PasscodeCopy;
  locale: Locale;
  length: 4 | 6;
  /** The account holds a platform key (Face ID or fingerprint is offered when this phone can ask). */
  passkey: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const done = () => {
    forgetLocalPasscode();
    forgetTab();
    banner.success(copy.turnedOff);
    setOpen(false);
    router.refresh();
  };

  const send = async (full: string) => {
    setBusy(true);
    try {
      const result = await turnOffPasscodeAction(full);
      if (result.ok) return done();
      setCode("");
      if (result.reason === "locked-out" || result.reason === "signed-out") {
        router.replace("/sign-in?notice=passcode-reset");
        return;
      }
      if (result.reason === "not-set") {
        router.refresh();
        return;
      }
      setShake((n) => n + 1);
      const attempt = result.attempt;
      setMessage(
        result.reason === "paced"
          ? copy.paced
          : attempt && attempt.status === "wrong"
            ? attempt.beforeSignOut <= 1
              ? plural(attempt.beforeSignOut, copy.wrongLastBeforeSignOut, locale)
              : plural(attempt.beforeCooldown, copy.wrongLeft, locale)
            : attempt && attempt.status === "cooldown"
              ? copy.cooldown.replace("{seconds}", String(attempt.retryAfterSeconds))
              : copy.error,
      );
    } catch {
      setCode("");
      setMessage(copy.error);
    } finally {
      setBusy(false);
    }
  };

  const onDigit = (digit: string) => {
    if (busy || code.length >= length) return;
    const next = code + digit;
    setCode(next);
    setMessage(null);
    if (next.length === length) void send(next);
  };

  const withKey = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!(await platformLockAvailable())) return setMessage(copy.passkeyFailed);
      const start = await beginPasskeyUnlock("off");
      if (start.state !== "ready") return setMessage(copy.passkeyFailed);
      const proof = await assertPlatformKey({ challenge: start.challenge, rpId: start.rpId, allow: start.credentialIds, waitMs: 20_000 });
      if (!proof) return setMessage(copy.passkeyFailed);
      const result = await finishPasscodeOffWithKey({ challenge: start.challenge, ...proof });
      if (result.ok) return done();
      setMessage(copy.passkeyFailed);
    } catch {
      setMessage(copy.passkeyFailed);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="nf-btn nf-btn--secondary w-full" onClick={() => setOpen(true)} data-testid="passcode-turn-off">
        {copy.turnOff}
      </button>
    );
  }

  return (
    <section className="nf-panel nf-panel--card nf-passcode-settings" aria-labelledby="passcode-off-title" data-testid="passcode-off">
      <h2 id="passcode-off-title" className="nf-passcode-settings__label">
        {copy.turnOffTitle}
      </h2>
      <p className="nf-passcode-settings__note">{copy.turnOffBody}</p>
      {passkey ? (
        <button type="button" className="nf-btn nf-btn--primary w-full" disabled={busy} onClick={() => void withKey()} data-testid="passcode-off-key">
          {copy.turnOffWithKey}
        </button>
      ) : null}
      <PasscodeDots length={length} filled={code.length} shake={shake} label={copy.digitsEntered.replace("{count}", String(code.length)).replace("{total}", String(length))} />
      <p className="nf-passcode__message" role="status" aria-live="polite" data-testid="passcode-off-message">
        {message ?? ""}
      </p>
      <Keypad onDigit={onDigit} onDelete={() => setCode((c) => c.slice(0, -1))} disabled={busy} label={copy.keypadLabel} deleteLabel={copy.deleteKey} />
      <button
        type="button"
        className="nf-passcode__link"
        disabled={busy}
        onClick={() => {
          setOpen(false);
          setCode("");
          setMessage(null);
        }}
        data-testid="passcode-off-cancel"
      >
        {copy.turnOffCancel}
      </button>
    </section>
  );
}
