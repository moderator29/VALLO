"use client";

import { decideSafetyHold } from "@/lib/admin/safety-holds";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * V-63: Clear or Extend one safety hold. The three words come from the server
 * page that draws the row, so this client file never imports the dictionary.
 */
export function SafetyHoldButtons({
  holdId,
  copy,
}: {
  holdId: string;
  copy: { working: string; clear: string; extend: string };
}) {
  const [pending, startTransition] = useSafeTransition();

  function act(action: "clear" | "extend") {
    startTransition(async () => {
      try {
        const result = await decideSafetyHold({ holdId, action });
        if (!result.ok) banner.error(result.error, { retry: () => act(action) });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-xs">
      <Button variant="secondary" size="sm" type="button" disabled={pending} onClick={() => act("clear")}>
        {pending ? copy.working : copy.clear}
      </Button>
      <Button variant="quiet" size="sm" type="button" disabled={pending} onClick={() => act("extend")}>
        {copy.extend}
      </Button>
    </span>
  );
}
