"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { banner } from "@/lib/ui/toast";
import { flushSync } from "react-dom";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/Field";
import {
  beginMoneyConfirm,
  confirmWithFallback,
  finishMoneyConfirm,
  sendFallbackCode,
  stepUpStatus,
  type StepUpStatus,
} from "@/lib/security/money-step-up-actions";
import type { MoneyIntent } from "@/lib/security/money-intent";
import { assertPlatformKey, platformLockAvailable } from "@/lib/security/webauthn-client";

/**
 * THE LOCK ON MONEY, IN FRONT OF A MONEY ACTION. V-81.
 *
 * Two ways to use it.
 *
 * A FORM (add or remove a payout account):
 *   const lock = useMoneyStepUp((form) => ({ kind: "payout_add", target: String(form.get("accountNumber") ?? "") }));
 *   <form onSubmit={(e) => { if (!lock.pass(e)) return; ... }}>
 *     <input type="hidden" name="stepUp" value={lock.token} />
 *     {lock.sheet}
 *
 * A CALL (add a bank account, make one the default):
 *   const stepUp = await lock.prove({ kind: "bank_add", target });
 *   if (stepUp === null) return;            // cancelled or refused
 *   await addBankAccount({ ...input, stepUp });
 *
 * For somebody who never locked money with their phone, nothing changes:
 * `pass` lets the submit through and `prove` answers "" at once. For somebody
 * who did, the sheet asks for this phone's face or fingerprint lock (or the
 * password, or an emailed code for an account with no password), the server
 * checks the proof and hands back a single-use step-up FOR THIS ACTION, and
 * the action goes ahead carrying it. When the lock state cannot be read, the
 * action goes ahead and the server decides. The server refuses a movement
 * without a matching proof regardless (`lib/security/money-lock-guard.ts`).
 */
export function useMoneyStepUp(
  intentOf?: (form: FormData) => MoneyIntent,
): {
  pass: (event: FormEvent<HTMLFormElement>) => boolean;
  prove: (intent: MoneyIntent) => Promise<string | null>;
  guard: <R extends { ok: boolean; error?: string }>(intent: MoneyIntent, act: (stepUp?: string) => Promise<R>) => Promise<R | null>;
  recover: (error: string | null | undefined) => Promise<string | null> | null;
  token: string;
  sheet: ReactNode;
} {
  /* The words come from the route's CopyScope (`moneyLock`), never from a
     client dictionary read: that read put the whole dictionary, 398KB
     gzipped, in every money route's first load (W13, measured). */
  const copy = useScopedCopy("moneyLock");
  const [token, setToken] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StepUpStatus | null>(null);
  const [sensor, setSensor] = useState(false);
  const [mode, setMode] = useState<"sensor" | "fallback">("sensor");
  const [secret, setSecret] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  /* A password changed in the last day is refused; the emailed code takes over. */
  const [forceCode, setForceCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"rejected" | "failed" | "password_recent" | null>(null);
  /* A refusal is said by the one banner at the top of the screen, over the
     sheet (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */
  useEffect(() => {
    if (error) banner.error(error === "rejected" ? copy.rejected : error === "password_recent" ? copy.passwordRecent : copy.failed);
    // The words follow the refusal, not the copy object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
  const bypass = useRef(false);
  const form = useRef<HTMLFormElement | null>(null);
  const intent = useRef<MoneyIntent | null>(null);
  const settle = useRef<((stepUp: string | null) => void) | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([stepUpStatus().catch(() => null), platformLockAvailable()]).then(([next, can]) => {
      if (!live) return;
      setStatus(next);
      setSensor(can);
    });
    return () => {
      live = false;
    };
  }, []);

  const reset = () => {
    setBusy(false);
    setSecret("");
    setCodeSent(false);
  };

  const release = (id: string) => {
    if (settle.current) {
      const done = settle.current;
      settle.current = null;
      flushSync(() => {
        setOpen(false);
        reset();
      });
      done(id);
      return;
    }
    const target = form.current;
    flushSync(() => {
      setToken(id);
      setOpen(false);
      reset();
    });
    bypass.current = true;
    target?.requestSubmit();
  };

  const close = () => {
    setOpen(false);
    reset();
    if (settle.current) {
      const done = settle.current;
      settle.current = null;
      done(null);
    }
  };

  /** Ask, if a proof is needed. Resolves after the sheet is shown or not. */
  const ask = async (): Promise<"none" | "shown"> => {
    const fresh = status ?? (await stepUpStatus().catch(() => null));
    if (fresh) setStatus(fresh);
    askedKnowing.current = fresh?.needed === true;
    /* Unknown or unlocked: go ahead and let the server decide. */
    if (!fresh || !fresh.needed) return "none";
    setError(null);
    setMode(sensor ? "sensor" : "fallback");
    setOpen(true);
    return "shown";
  };

  const pass = (event: FormEvent<HTMLFormElement>): boolean => {
    if (bypass.current) {
      bypass.current = false;
      return true;
    }
    form.current = event.currentTarget;
    intent.current = intentOf ? intentOf(new FormData(event.currentTarget)) : null;
    if (status && !status.needed) {
      askedKnowing.current = false;
      return true;
    }
    event.preventDefault();
    void ask().then((shown) => {
      if (shown === "none") release("");
    });
    return false;
  };

  /* Whether the last ask KNEW a proof was needed. When it did not (the
     status could not be read), a refusal with the lock sentence means the
     phone guessed wrong, and `recover` asks properly; when it did, the proof
     was given and refused, and asking again would only loop. */
  const askedKnowing = useRef(false);
  const recovering = useRef(false);

  /**
   * The server refused with the lock sentence although this phone did not
   * know a proof was needed: read the status again and, if one is, open the
   * sheet for the same intent. A form resubmits itself with the proof; a
   * call gets the step-up back (or null) to run the action again.
   */
  const recover = (refusal: string | null | undefined): Promise<string | null> | null => {
    if (refusal !== copy.needed || askedKnowing.current || !intent.current || recovering.current) return null;
    recovering.current = true;
    return new Promise((resolve) => {
      void stepUpStatus()
        .catch(() => null)
        .then((fresh) => {
          recovering.current = false;
          if (fresh) setStatus(fresh);
          if (!fresh?.needed) {
            resolve(null);
            return;
          }
          askedKnowing.current = true;
          setError(null);
          setMode(sensor ? "sensor" : "fallback");
          if (!form.current) settle.current = resolve;
          else resolve(null);
          setOpen(true);
        });
    });
  };

  /** Prove, act, and if the server says a proof was needed after all, ask and act once more. */
  const guard = async <R extends { ok: boolean; error?: string }>(
    next: MoneyIntent,
    act: (stepUp?: string) => Promise<R>,
  ): Promise<R | null> => {
    form.current = null;
    const stepUp = await prove(next);
    if (stepUp === null) return null;
    const first = await act(stepUp || undefined);
    const retry = recover(first.ok ? null : first.error);
    if (!retry) return first;
    const second = await retry;
    return second === null ? first : act(second || undefined);
  };

  const prove = (next: MoneyIntent): Promise<string | null> => {
    intent.current = next;
    if (status && !status.needed) {
      askedKnowing.current = false;
      return Promise.resolve("");
    }
    return new Promise((resolve) => {
      settle.current = resolve;
      void ask().then((shown) => {
        if (shown === "none" && settle.current) {
          settle.current = null;
          resolve("");
        }
      });
    });
  };

  const proveWithSensor = async () => {
    if (!status || !intent.current) return;
    setBusy(true);
    setError(null);
    const begun = await beginMoneyConfirm(intent.current).catch(() => ({ error: "failed" as const }));
    if ("error" in begun) {
      setBusy(false);
      setError(begun.error);
      return;
    }
    const proof = await assertPlatformKey({ challenge: begun.challenge, rpId: status.rpId, allow: status.credentialIds });
    if (!proof) {
      setBusy(false);
      setError("rejected");
      return;
    }
    const done = await finishMoneyConfirm({ challenge: begun.challenge, ...proof }).catch(() => ({ error: "failed" as const }));
    if ("error" in done) {
      setBusy(false);
      setError(done.error);
      return;
    }
    release(done.stepUp);
  };

  const byCode = status?.fallback === "email-code" || forceCode;

  const askForCode = async () => {
    setBusy(true);
    setError(null);
    const sent = await sendFallbackCode().catch(() => ({ error: "failed" as const }));
    setBusy(false);
    if ("error" in sent) setError("failed");
    else setCodeSent(true);
  };

  const proveWithFallback = async () => {
    if (!intent.current) return;
    setBusy(true);
    setError(null);
    const proof = byCode ? { code: secret.trim() } : { password: secret };
    const done = await confirmWithFallback({ proof, intent: intent.current }).catch(() => ({ error: "failed" as const }));
    if ("error" in done) {
      setBusy(false);
      setError(done.error);
      if (done.error === "password_recent") {
        setForceCode(true);
        setCodeSent(false);
        setSecret("");
      }
      return;
    }
    release(done.stepUp);
  };

  const sheet = (
    <Sheet open={open} onOpenChange={(next) => !busy && (next ? setOpen(true) : close())} title={copy.confirmTitle} detents={[0.6]}>
      <div className="space-y-row" data-testid="money-step-up">
        <p className="nf-body text-[var(--nf-content-secondary)]">{copy.confirmBody}</p>
        {mode === "sensor" ? (
          <Button type="button" variant="primary" full loading={busy} disabled={busy} onClick={() => void proveWithSensor()}>
            {copy.confirm}
          </Button>
        ) : byCode && !codeSent ? (
          <Button type="button" variant="primary" full loading={busy} disabled={busy} onClick={() => void askForCode()}>
            {copy.sendCode}
          </Button>
        ) : (
          <>
            <TextField
              label={byCode ? copy.codeLabel : copy.passwordLabel}
              type={byCode ? "text" : "password"}
              inputMode={byCode ? "numeric" : undefined}
              enterKeyHint="go"
              autoComplete={byCode ? "one-time-code" : "current-password"}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              full
              loading={busy}
              disabled={busy || secret.trim().length === 0}
              onClick={() => void proveWithFallback()}
            >
              {copy.passwordConfirm}
            </Button>
          </>
        )}
        {mode === "sensor" && (
          <Button type="button" variant="ghost" full disabled={busy} onClick={() => setMode("fallback")}>
            {byCode ? copy.useCode : copy.usePassword}
          </Button>
        )}
        <Button type="button" variant="ghost" full disabled={busy} onClick={close}>
          {copy.cancel}
        </Button>
      </div>
    </Sheet>
  );

  return { pass, prove, guard, recover, token, sheet };
}

/**
 * For a FORM guarded by `useMoneyStepUp`: when its action answers with the
 * lock sentence although the phone did not know a proof was needed, ask for
 * it now; the form then resubmits itself with the proof. Once per answer.
 */
export function useLockRecovery(
  lock: { recover: (error: string | null | undefined) => Promise<string | null> | null },
  answer: unknown,
): void {
  const recover = useRef(lock.recover);
  useEffect(() => {
    recover.current = lock.recover;
  });
  useEffect(() => {
    const result = answer as { ok?: unknown; error?: unknown } | null;
    if (result && result.ok === false && typeof result.error === "string") void recover.current(result.error);
  }, [answer]);
}
