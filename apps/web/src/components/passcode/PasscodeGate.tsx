import { cache, type ReactNode } from "react";
import type { Dictionary, Locale } from "@vallo/i18n";
import { resolvePasscodeGate } from "@/lib/passcode/state";
import { passkeyUnlockOffered } from "@/lib/passcode/passkey-unlock";
import { PasscodeGuard } from "./PasscodeGuard";
import { PasscodeLock } from "./PasscodeLock";
import { PasscodeSetup } from "./PasscodeSetup";

/**
 * Whether this member holds a platform key, read once per request.
 *
 * THE (app) LAYOUT STARTS IT BESIDE THE GATE'S OWN READ (13 October 2026, the
 * startup track), the way SPEED-3 starts `resolvePasscodeGate()`. It used to
 * start only once the gate had decided, after the layout's other reads, so a
 * signed-in render waited for it in series: a GoTrue round trip
 * (`resolveSession`) and a `money_credentials` read, added to every member
 * screen before the shell could stream. Memoised, so the gate awaits the same
 * promise; a failed read is still "no".
 */
export const passkeyOfferedThisRequest = cache(
  async function passkeyOfferedThisRequest(): Promise<boolean> {
    return passkeyUnlockOffered().catch(() => false);
  },
);

/**
 * THE GATE, IN THE (app) LAYOUT. docs/PASSCODE.md.
 *
 * Signed out (the open catalogue, if the founder's switch is on): the page,
 * untouched. Signed in: the page only when the session is unlocked; the lock
 * or the setup screen otherwise, drawn INSTEAD of the page so nothing of it
 * reaches the browser. The auth pages and the public site are other layouts
 * and are never locked.
 *
 * It never falls through to the page on a failure. An unreadable passcode
 * shows the lock with "Use your password instead", and only a fresh full
 * sign-in or a valid unlock cookie lets the member in
 * (`lib/passcode/decide.ts`).
 */
export async function PasscodeGate({
  t,
  locale,
  name,
  avatarUrl,
  children,
}: {
  t: Dictionary;
  locale: Locale;
  name: string;
  avatarUrl: string;
  children: ReactNode;
}) {
  const { view, userId } = await resolvePasscodeGate();
  const copy = t.passcode;
  /* C14: one read of whether this member holds a platform key; only asked
     when a lock can be drawn, or a first passcode set (for the one-time Face
     ID offer). A failed read is "no", which leaves the code. */
  const passkey =
    view.kind === "unlocked" || view.kind === "locked" || (view.kind === "setup" && view.mode === "first")
      ? await passkeyOfferedThisRequest()
      : false;

  switch (view.kind) {
    case "open":
      return <>{children}</>;
    case "unlocked":
      return (
        <PasscodeGuard
          copy={copy}
          locale={locale}
          length={view.length}
          mint={view.mint}
          name={name}
          avatarUrl={avatarUrl}
          passkey={passkey}
          userId={userId ?? undefined}
        >
          {children}
        </PasscodeGuard>
      );
    case "setup":
      /* A first passcode may be followed once by the Face ID offer, only for a
         member who holds no key yet (`biometric-offer.ts`). */
      return (
        <PasscodeSetup
          copy={copy}
          locale={locale}
          mode={view.mode}
          name={name}
          avatarUrl={avatarUrl}
          overlay
          offerBiometric={view.mode === "first" && !passkey}
          userId={userId ?? undefined}
        />
      );
    case "locked":
      return (
        <PasscodeLock
          copy={copy}
          locale={locale}
          mode={view.mode}
          length={view.length}
          lockedUntil={view.lockedUntil}
          name={name}
          avatarUrl={avatarUrl}
          passkey={passkey && view.mode === "code"}
          userId={userId ?? undefined}
        />
      );
  }
}
