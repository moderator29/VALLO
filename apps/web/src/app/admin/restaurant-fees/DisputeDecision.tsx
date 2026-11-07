"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { resolveSeatingDispute } from "@/lib/reservations/seating-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/** Vallo decides: the table was seated, or nobody came. Recorded with who decided. */
export function DisputeDecision({ reservationId }: { reservationId: string }) {
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  const decide = (outcome: "SEATED" | "NO_SHOW") =>
    start(async () => {
      try {
        const result = await resolveSeatingDispute(reservationId, outcome);
        if (!result.ok) {
          banner.error(result.error, { retry: () => decide(outcome) });
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return (
    <div className="mt-row">
      <div className="flex flex-wrap gap-inline">
        <Button variant="primary" size="sm" disabled={pending} onClick={() => decide("SEATED")}>
          Count as seated
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => decide("NO_SHOW")}>
          Count as no-show
        </Button>
      </div>
    </div>
  );
}
