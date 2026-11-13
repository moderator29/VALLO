"use client";

import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { joinArea, leaveArea } from "@/lib/social/areas-actions";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
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
  const [, startTransition] = useSafeTransition();
  const [isJoined, setIsJoined] = useState(joined);

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

    /* Said on the tap (lib/ui/optimistic.ts); the server answer only corrects. */
    bannerWithUndo(next ? "You joined this area. Its posts are in your feed now." : "You left this area. Its posts leave your feed.", {
      undo: () => (next ? leaveArea({ areaId }) : joinArea({ areaId })),
      undone: next ? "You left this area again." : "You are back in this area.",
      onUndone: () => {
        setIsJoined(!next);
        router.refresh();
      },
    });
    startTransition(async () => {
      try {
        const result = next
          ? await joinArea({ areaId })
          : await leaveArea({ areaId });
        if (!result.ok) {
          setIsJoined(!next);
          banner.error(result.error, { retry: toggle });
          return;
        }
        router.refresh();
      } catch (error) {
        setIsJoined(!next);
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
        aria-pressed={isJoined}
        variant={isJoined ? "secondary" : "primary"}
        size={size}
      >
        {label}
      </Button>
    </div>
  );
}
