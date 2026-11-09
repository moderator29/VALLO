"use client";

import { banner } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { revokeShareLink } from "@/lib/share/actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-07 CARRY-OVER: CLOSE THIS LINK. Two taps (the second is the
 * confirmation, with what it means), then the page reloads with a fresh door.
 * States: resting, confirming, closing, a failed close in words.
 */

type Copy = Dictionary["frontDoor"]["status"];

export function RevokeDoor({ token, copy }: { token: string; copy: Copy }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useSafeTransition();

  return (
    <div className="flex flex-col gap-row" data-testid="revoke-door">
      {confirming ? (
        <>
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.revokeNote}</p>
          <div className="flex flex-wrap gap-sm">
            <Button
              variant="secondary"
              loading={pending}
              onClick={() => {
                start(async () => {
                  try {
                    const result = await revokeShareLink({ token });
                    if (!result.ok) {
                      banner.error(copy.revokeFailed);
                      return;
                    }
                    banner.success("Link closed");
                    setConfirming(false);
                    router.refresh();
                  } catch (error) {
                    if (!tapFailedOffline(error)) throw error;
                  }
                });
              }}
            >
              {copy.revokeConfirm}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              {copy.cancel}
            </Button>
          </div>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          {copy.revoke}
        </Button>
      )}
    </div>
  );
}
