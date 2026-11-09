"use client";
import "@/app/css/auth.css";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { signInWithAppleIdToken } from "@/lib/auth/actions";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { banner } from "@/lib/ui/toast";

/**
 * SIGN IN WITH APPLE INSIDE THE iOS SHELL (STORE-02).
 *
 * The web redirect cannot complete in the shell: the round trip leaves the web
 * view for the system browser, and the session would land in the browser's
 * cookie jar, not the app's (STORE-03). So the shell uses Apple's own sheet
 * through the `SignInWithApple` plugin (`@capacitor-community/apple-sign-in`),
 * which returns an identity token to this page; the server action hands that
 * token to Supabase and writes the session cookies into THIS web view's jar.
 *
 * The plugin is reached through the injected bridge by name, not imported, the
 * same way `components/app/push/enrol.ts` reaches the push plugin, so the
 * website bundle carries none of it. When the running binary was built
 * without the plugin, the button is not drawn at all.
 *
 * THE NONCE. Apple puts SHA-256(nonce) in the token; Supabase is given the raw
 * nonce and checks the hash itself. A token replayed from another sign-in
 * carries a different hash and is refused.
 */

type ApplePlugin = {
  authorize: (options: {
    clientId: string;
    redirectURI: string;
    scopes?: string;
    state?: string;
    nonce?: string;
  }) => Promise<{ response?: { identityToken?: string } }>;
};

type Bridge = {
  isPluginAvailable?: (name: string) => boolean;
  registerPlugin?: <T>(name: string) => T;
  Plugins?: Record<string, unknown>;
};

function bridge(): Bridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: Bridge }).Capacitor;
}

function pluginAvailable(): boolean {
  try {
    return bridge()?.isPluginAvailable?.("SignInWithApple") === true;
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function NativeAppleSignIn({
  label,
  next,
  round = false,
}: {
  label: string;
  next?: string | undefined;
  /** The Slate round door (`SocialDoors`): the mark alone, the label as its
      name. Otherwise a full-width Slate row with the mark and the words. */
  round?: boolean;
}) {
  const a = useClientCopy().authFlow;
  const router = useRouter();
  const available = useSyncExternalStore(noSubscribe, pluginAvailable, () => false);
  const [busy, setBusy] = useState(false);
  /* Said by the one banner at the top of the screen, with Try again
     (founder, 7 November 2026); a second tap opens Apple's sheet afresh. */
  const say = (text: string) =>
    banner.error(text, { retry: () => void start(), "data-testid": "banner-auth" });

  if (!available) return null;

  const start = async () => {
    setBusy(true);
    try {
      const { Capacitor } = await import("@capacitor/core");
      const plugin = Capacitor.registerPlugin<ApplePlugin>("SignInWithApple");
      const nonce = randomNonce();
      const result = await plugin.authorize({
        /* On iOS the sheet signs for the app's own bundle identifier; these
           two fields are required by the plugin's signature and used only on
           the web fallback, which this component never takes. */
        clientId: "com.vallospaces.app",
        redirectURI: `${window.location.origin}/auth/callback`,
        scopes: "email name",
        nonce: await sha256Hex(nonce),
      });
      const idToken = result.response?.identityToken;
      if (!idToken) {
        say(a.appleUnfinished);
        return;
      }
      const outcome = await signInWithAppleIdToken({ idToken, nonce, next });
      if (!outcome.ok) {
        say(outcome.message);
        return;
      }
      router.replace(outcome.next);
      router.refresh();
    } catch {
      /* A cancelled sheet rejects too; the person chose not to, and a quiet
         line is the right answer to that. */
      say(a.appleFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={round ? "nf-slate-social-slot" : undefined}>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        data-testid="apple-native-sign-in"
        aria-label={round ? label : undefined}
        title={round ? label : undefined}
        className={
          round
            ? "nf-slate-social"
            : "nf-btn nf-btn--glass nf-btn--lg nf-btn--full nf-slate-pill nf-slate-pill--quiet"
        }
      >
        <AppleMark />
        {round ? null : label}
      </button>
    </div>
  );
}

/** Apple's mark, in the button's own text colour as Apple's guidelines allow. */
export function AppleMark() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="20"
      viewBox="0 0 814 1000"
      className="nf-auth__door-mark"
      fill="currentColor"
    >
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}
