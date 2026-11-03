"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { joinArea, leaveArea } from "@/lib/social/areas-actions";
import { Button } from "@/components/ui/Button";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Join or leave a place.
 *
 * Optimistic, because a membership toggle that waits on a round trip on a
 * Nigerian mobile connection feels broken even when it works. The optimism is
 * reverted the moment the server disagrees, and `router.refresh()` makes the
 * page tell the truth again either way, so a reload can never disagree with
 * what the button says. That last part is the rule: the UI may be ahead of the
 * database for a second, and it may never be wrong about it after a reload.
 */
export function JoinButton({
  areaId,
  joined,
  signedIn,
  size = "md",
}: {
  areaId: string;
  joined: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  /*
   * Where to come back to after signing in.
   *
   * This was hard-coded to `/around`, which was right for exactly as long as
   * `/around` was the directory this button sat on. It now sits on three
   * different screens, so it returns to the one the person actually tapped on
   * rather than to whichever screen used to be the only one.
   */
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [isJoined, setIsJoined] = useState(joined);
  const [error, setError] = useState<string | null>(null);

  const label = isJoined ? "Joined" : "Join";

  const toggle = () => {
    if (!signedIn) {
      const query = search.toString();
      const here = `${pathname}${query ? `?${query}` : ""}`;
      router.push(`/sign-in?next=${encodeURIComponent(here || "/around")}`);
      return;
    }
    const next = !isJoined;
    setIsJoined(next);
    setError(null);

    startTransition(async () => {
      try {
        const result = next
          ? await joinArea({ areaId })
          : await leaveArea({ areaId });
        if (!result.ok) {
          setIsJoined(!next);
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2xs">
      {/* The shared lit primary to join and the glass door once joined (the
          orphans sweep): both 44px tall on the control corner. `sm` is the
          shared small button, `md` the shared medium one. */}
      <Button
        onClick={toggle}
        disabled={pending}
        aria-pressed={isJoined}
        variant={isJoined ? "secondary" : "primary"}
        size={size}
      >
        {label}
      </Button>
      {error ? (
        <span role="alert" className="max-w-[14rem] text-right text-[length:var(--nf-text-overline)] text-[var(--nf-state-error)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
