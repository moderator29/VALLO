"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { passkeySignInEnabled } from "@/lib/auth/passkey-flag";
import { safeReturnPath } from "@/lib/security/return-path";
import "@/app/css/auth.css";
import { banner } from "@/lib/ui/toast";
import { showSuccess } from "@/lib/ui/success-moments";

/**
 * A3. "Sign in with a passkey", drawn only when the flag is on and the
 * browser has WebAuthn. The account is picked on the device (discoverable
 * credentials), so no email is typed. A cancelled prompt says nothing.
 */
/**
 * Where a passkey sign-in lands: `next` through the one return-path guard,
 * else home. The check here used to be "starts with one slash", which let
 * `/\evil.example` through, and a browser reads that backslash as a second
 * slash, so the router left the site.
 */
export function passkeyLanding(next: string | undefined): string {
  return (next && safeReturnPath(next, "")) || "/home";
}

export function PasskeySignIn({ label, next, failed }: { label: string; next?: string; failed: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  /* False on the server and in the first client pass, so hydration agrees. */
  const supported = useSyncExternalStore(
    () => () => {},
    () => "PublicKeyCredential" in window,
    /* Drawn from the server (U1, the first 400ms): every browser this
       platform supports has passkeys, so the server answers yes and the rare
       one without takes the door away after hydration, rather than every
       browser growing the door in late and pushing the screen down. */
    () => true,
  );
  if (!passkeySignInEnabled() || !supported) return null;
  return (
    <div className="grid gap-xs">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        full
        leadingIcon="key"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            /* Fetched now, not with the screen: supabase-js is about 65KB
               gzipped, and every visit to sign in paid for it whether or not
               passkeys were switched on (R3-18). */
            const { passkeyClient } = await import("@/lib/auth/passkey-client");
            const auth = passkeyClient().auth as unknown as {
              signInWithPasskey: () => Promise<{ error: { name?: string } | null }>;
            };
            const { error: failure } = await auth.signInWithPasskey();
            if (failure) {
              /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
              if (!/abort|cancel|NotAllowed/i.test(failure.name ?? "")) banner.error(failed, { "data-testid": "banner-auth" });
              return;
            }
            /* "Signed in. Welcome back." at the top of wherever it lands. */
            showSuccess("signed-in");
            router.replace(passkeyLanding(next));
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
    </div>
  );
}
