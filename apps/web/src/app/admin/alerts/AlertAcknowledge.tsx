"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { acknowledgeRiskAlert } from "@/lib/admin/actions";
import { ACK_COPY } from "./ack-copy";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * C13: "I have this" on an open alert.
 *
 * One tap, no sheet: taking an alert decides nothing about it, it only puts a
 * name on it so nobody else chases the same fault. The server action checks
 * the admin role, the database refuses a name that is not the caller's, and a
 * refusal (already taken, not switched on yet) is shown in plain words under
 * the button. On success the queue re-renders from the database.
 */
export function AlertAcknowledge({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-md">
      <Button
        variant="secondary"
        leadingIcon="user-check"
        loading={pending}
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setError(null);
              const result = await acknowledgeRiskAlert({ alertId });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.refresh();
            } catch (error) {
              if (!tapFailedOffline(error)) throw error;
            }
          })
        }
      >
        {ACK_COPY.button}
      </Button>
      {error ? (
        <p role="alert" className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-state-warning)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
