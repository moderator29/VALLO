"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { resolveSeatingDispute } from "@/lib/reservations/seating-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/** Vallo decides: the table was seated, or nobody came. Recorded with who decided. */
export function DisputeDecision({ reservationId }: { reservationId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const decide = (outcome: "SEATED" | "NO_SHOW") =>
    start(async () => {
      try {
        setError(null);
        const result = await resolveSeatingDispute(reservationId, outcome);
        if (!result.ok) {
          setError(result.error);
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
      {error && (
        <p role="alert" className="nf-caption mt-inline text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
