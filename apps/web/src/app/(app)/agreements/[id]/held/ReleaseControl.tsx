"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DragToConfirm } from "@/components/ui/DragToConfirm";
import { releaseHeldPayment } from "@/lib/money/arrangement-actions";
import { RELEASE_ARMED_LABEL, RELEASE_SWIPE_LABEL } from "@/lib/money/copy";

/**
 * Step 10: the renter releases the protected payment. A money swipe (it never
 * auto-resets); the server refuses anything the database would. Payluk's
 * webhook, not this control, marks it released.
 */
export function ReleaseControl({
  agreementId,
  arrangementId,
  milestonePosition,
  label,
}: {
  agreementId: string;
  arrangementId: string;
  milestonePosition?: number;
  label?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-sm" data-testid="held-release">
      <DragToConfirm
        money
        label={label ?? RELEASE_SWIPE_LABEL}
        armedLabel={RELEASE_ARMED_LABEL}
        confirmingLabel="Asking our licensed provider to release it"
        confirmedLabel="Release asked for"
        errorLabel={error ?? "The release did not go through. The money stays held."}
        onConfirm={async () => {
          setError(null);
          const result = await releaseHeldPayment({ agreementId, arrangementId, milestonePosition });
          if (!result.ok) {
            setError(result.error);
            return false;
          }
          router.refresh();
          return true;
        }}
      />
      {error && (
        <p role="alert" className="nf-caption text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
