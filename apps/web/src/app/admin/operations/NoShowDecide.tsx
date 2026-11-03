"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { resolveNoShow } from "@/lib/inspections/no-show-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Staff decide a disputed no-show: it stands, or it comes off the record
 * (an overturned one no longer counts toward repeats). One decision per
 * dispute; the database refuses a second, and the alert it opened is
 * resolved with it.
 */
export function NoShowDecide({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  function decide(upheld: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    start(async () => {
      try {
        try {
          const result = await resolveNoShow({ id: inspectionId, upheld });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.refresh();
        } finally {
          inFlight.current = false;
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-xs">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide(true)}>
        It stands
      </Button>
      <Button size="sm" variant="quiet" disabled={pending} onClick={() => decide(false)}>
        Take it off
      </Button>
      {error && (
        <span role="alert" className="nf-admin-dt__sub text-[var(--nf-state-error)]">
          {error}
        </span>
      )}
    </span>
  );
}
