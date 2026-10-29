"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { declineRefundRequest } from "@/lib/after-gate/refund-decision-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * V-24. Declining a guest's refund request, with the reason the guest reads.
 * Closed until opened, so the clock stays a list and not a wall of forms.
 */
export function DeclineRefundRequest({
  requestId,
  copy,
}: {
  requestId: string;
  copy: { decline: string; declineReason: string; declineSubmit: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {copy.decline}
      </Button>
    );
  }
  return (
    <form
      className="grid w-full gap-xs"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await declineRefundRequest({ requestId, reason });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <label className="nf-label" htmlFor={`decline-${requestId}`}>
        {copy.declineReason}
      </label>
      <textarea
        id={`decline-${requestId}`}
        className="nf-field min-h-[4.5rem]"
        maxLength={1000}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={pending || reason.trim().length < 3}>
        {copy.declineSubmit}
      </Button>
      {error && (
        <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
