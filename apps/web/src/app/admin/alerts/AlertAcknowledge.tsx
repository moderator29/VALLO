"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { acknowledgeRiskAlert } from "@/lib/admin/actions";
import { ACK_COPY } from "./ack-copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * C13: "I have this" on an open alert.
 *
 * One tap, no sheet: taking an alert decides nothing about it, it only puts a
 * name on it so nobody else chases the same fault. The server action checks
 * the admin role, the database refuses a name that is not the caller's, and a
 * refusal (already taken, not switched on yet) is said in plain words in the
 * banner. On success the queue re-renders from the database.
 */
export function AlertAcknowledge({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();

  function acknowledge() {
    start(async () => {
      try {
        const result = await acknowledgeRiskAlert({ alertId });
        if (!result.ok) {
          banner.error(result.error, { retry: acknowledge });
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="mt-md">
      <Button
        variant="secondary"
        leadingIcon="user-check"
        loading={pending}
        disabled={pending}
        onClick={acknowledge}
      >
        {ACK_COPY.button}
      </Button>
    </div>
  );
}
