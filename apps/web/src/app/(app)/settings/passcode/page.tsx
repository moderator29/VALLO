import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { getShellIdentity } from "@/lib/app/shell-queries";
import { readPasscodeSession, readPasscodeStatus, sessionSignedInWithin } from "@/lib/passcode/state";
import { FRESH_RESET_SECONDS } from "@/lib/passcode/rules";
import { PasscodeSettings } from "./PasscodeSettings";
import { PasskeyIdleSetting } from "./PasskeyIdleSetting";
import { TurnOffPasscode } from "./TurnOffPasscode";
import { passkeyUnlockOffered } from "@/lib/passcode/passkey-unlock";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getDictionary(await getLocale()).passcode.screenTitle,
    robots: { index: false, follow: false },
  };
}

/* The member's own lock, read fresh every time. */
export const dynamic = "force-dynamic";

/**
 * Settings, Security: the passcode. docs/PASSCODE.md.
 *
 * Change the code, or its length (6 or 4), which is the same thing: a hash
 * cannot be shortened, so a new length is a new code. The current code is
 * asked first unless the member signed in within the last fifteen minutes,
 * the same window `passcode_set` accepts as proof. Forgot it: "Use your
 * password instead" signs out and a fresh sign-in sets a new one.
 */
export default async function PasscodeSettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.passcode;
  const [session, identity] = await Promise.all([readPasscodeSession(), getShellIdentity()]);

  let state: "signed-out" | "unset" | "set" | "unavailable" = "signed-out";
  let length: 4 | 6 = 6;
  let askCurrent = true;
  if (session.state === "signed-in") {
    const status = await readPasscodeStatus(session.supabase);
    if (status.state === "unset") state = "unset";
    else if (status.state === "set" || status.state === "reset_required") {
      state = "set";
      length = status.length;
    } else state = "unavailable";
    askCurrent = !sessionSignedInWithin(session, FRESH_RESET_SECONDS);
  }

  const hasPasskey = state === "set" ? await passkeyUnlockOffered().catch(() => false) : false;

  return (
    <PageFrame title={copy.screenTitle} fallback="/settings" width="narrow">
      <PasscodeSettings
        copy={copy}
        locale={locale}
        state={state}
        length={length}
        askCurrent={askCurrent}
        name={identity.signedIn && identity.userName !== "Guest" ? identity.userName : ""}
        avatarUrl={identity.avatarUrl}
      />
      {state === "set" ? (
        <>
          <PasskeyIdleSetting hasPasskey={hasPasskey} copy={copy} />
          {/* The way back to no passcode (13 November 2026): proven, never a tap alone. */}
          <TurnOffPasscode copy={copy} locale={locale} length={length} passkey={hasPasskey} />
        </>
      ) : null}
    </PageFrame>
  );
}
