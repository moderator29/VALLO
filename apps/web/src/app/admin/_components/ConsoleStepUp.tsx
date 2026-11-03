"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { beginConsoleStepUp, finishConsoleStepUp } from "@/lib/security/console-step-up";
import { beginEnrol, finishEnrol, sendFallbackCode } from "@/lib/security/money-step-up-actions";
import { assertPlatformKey, createPlatformKey } from "@/lib/security/webauthn-client";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE CONSOLE'S SECOND FACTOR, AS STAFF SEE IT.
 *
 * Every admin and staff member confirms it is them with their security key
 * (the passkey on their phone or computer) before any desk opens, once per
 * sign-in and again after twelve hours. Somebody without a key is sent to set
 * one up first; there is no password-only way in.
 *
 * C14 (30 September 2026): somebody with no key that may open the console
 * (none enrolled, or every one revoked for the console after a lost phone)
 * enrols a new one right here, on the first-key proof the settings page uses
 * for a staff account: the emailed code, and the password for an account
 * with one (`beginEnrol`). Then the console asks for the new key at once.
 */
export function ConsoleStepUp({ name }: { name: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState<null | "password" | "email-code">(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const confirm = () =>
    start(async () => {
      try {
        setMessage(null);
        const begun = await beginConsoleStepUp();
        if (begun.state === "enrol") {
          setNeedsKey(begun.method);
          return;
        }
        if (begun.state !== "ready") {
          setMessage("That did not start. Try again in a moment.");
          return;
        }
        const proof = await assertPlatformKey({ challenge: begun.challenge, rpId: begun.rpId, allow: begun.credentialIds });
        if (!proof) {
          setMessage("Your key did not answer. Try again, on the device where you set it up.");
          return;
        }
        const done = await finishConsoleStepUp({ challenge: begun.challenge, ...proof });
        if ("ok" in done) router.refresh();
        else setMessage(done.error === "rejected" ? "That key was not accepted. Try again." : "That did not go through. Try again.");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const sendCode = () =>
    start(async () => {
      try {
        setMessage(null);
        const sent = await sendFallbackCode().catch(() => ({ error: "failed" as const }));
        if ("ok" in sent) setCodeSent(true);
        else setMessage("The code did not send. Try again in a moment.");
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const enrolHere = () =>
    start(async () => {
      try {
        setMessage(null);
        const begun = await beginEnrol({ code: code.trim(), password: needsKey === "password" ? password : undefined }).catch(
          () => ({ error: "failed" as const }),
        );
        if ("error" in begun) {
          setMessage(
            begun.error === "password_recent"
              ? "Your password changed in the last day, so it cannot vouch for a new key yet. Ask a super admin, or try tomorrow."
              : begun.error === "rejected"
                ? "That code or password was not accepted. Check both and try again."
                : "That did not go through. Try again.",
          );
          return;
        }
        const made = await createPlatformKey({ challenge: begun.challenge, userId: begun.userId, email: begun.email, rpId: begun.rpId, rpName: "Vallo", exclude: [] });
        if (!made) {
          setMessage("Your device did not make a key. Use the device you will keep, and allow its screen lock.");
          return;
        }
        const done = await finishEnrol({ challenge: begun.challenge, ...made, label: "Console" }).catch(() => ({ error: "failed" as const }));
        if (!("ok" in done)) {
          setMessage("The new key was not saved. Try again.");
          return;
        }
        setNeedsKey(null);
        setCode("");
        setPassword("");
        setCodeSent(false);
        confirm();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    /* In the page gutter: rendered straight from the admin layout, the card
       ran flush to both edges of a phone. The safe area covers a notch. */
    <div className="nf-safe-top px-gutter pb-block">
      <section className="nf-console nf-panel nf-panel--card mx-auto mt-block max-w-lg p-card" data-testid="console-step-up">
        <p className="nf-caption text-[var(--nf-content-secondary)]">Vallo console</p>
        <h1 className="nf-h2 mt-inline">Confirm it is you, {name}</h1>
        <p className="nf-body mt-inline">
          The console opens only after you confirm with your security key, once each time you sign in and again after
          twelve hours. A password on its own never opens it.
        </p>
        {needsKey ? (
          <div className="mt-block grid gap-sm" role="status" data-testid="console-enrol">
            <p className="nf-body">
              You have no security key that opens the console: none is set up, or the one you had was cleared after a
              lost device. Set up a new one on this device (it uses its screen lock).{" "}
              {needsKey === "password"
                ? "We email you a code, and ask for your password too."
                : "We email you a code to prove it is you."}
            </p>
            {needsKey === "password" ? (
              <TextField
                label="Your password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
              />
            ) : null}
            {codeSent ? (
              <TextField
                label="The code we emailed you"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={pending}
              />
            ) : null}
            {codeSent ? (
              <Button
                variant="primary"
                size="md"
                loading={pending}
                disabled={pending || code.trim().length === 0 || (needsKey === "password" && password.length === 0)}
                onClick={enrolHere}
              >
                Set up the key on this device
              </Button>
            ) : (
              <Button variant="primary" size="md" loading={pending} disabled={pending} onClick={sendCode}>
                Email me a code
              </Button>
            )}
            <ButtonLink href="/settings/privacy/money-lock" variant="quiet" size="md">
              Or set it up in your privacy settings
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-block">
            <Button variant="primary" size="md" onClick={confirm} disabled={pending} loading={pending}>
              Confirm with my security key
            </Button>
          </div>
        )}
        {message ? (
          <p className="nf-body mt-inline text-[var(--nf-state-error)]" role="alert">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
