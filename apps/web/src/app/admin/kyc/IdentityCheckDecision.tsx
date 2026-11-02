"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { decideIdentityCheck } from "@/lib/admin/identity-check-actions";

/**
 * Approve or refuse one Dojah check, the same shape as `DocumentDecision`:
 * approving is one tap, refusing asks for the sentence the person is sent.
 */
export function IdentityCheckDecision({ checkId, canApprove }: { checkId: string; canApprove: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function decide(approve: boolean) {
    setError(null);
    start(async () => {
      const result = await decideIdentityCheck(approve ? { checkId, approve: true } : { checkId, approve: false, reason });
      if (!result.ok) {
        setError(result.fieldErrors?.["reason"] ?? result.error);
        return;
      }
      setReason("");
      setShowReason(false);
      router.refresh();
    });
  }

  return (
    <div className="nf-admin-decision mt-row" data-testid="identity-check-decision">
      {showReason && (
        <label className="block">
          <span className="nf-label">What is wrong with it</span>
          <textarea
            className="nf-field min-h-[64px] resize-y"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="The selfie is too dark to compare with your ID photo. Try again facing a window, with your whole face in the frame."
          />
          <span className="nf-caption mt-inline-tight block">
            This is sent to them word for word, so it has to be something they can act on.
          </span>
        </label>
      )}
      <div className="nf-admin-decision__buttons mt-row flex flex-wrap gap-inline">
        {canApprove && (
          <Button type="button" size="md" disabled={pending} onClick={() => decide(true)}>
            Approve identity
          </Button>
        )}
        {showReason ? (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => decide(false)}>
            {pending ? "Sending" : "Send it back"}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setShowReason(true)}>
            Refuse
          </Button>
        )}
        {showReason && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setShowReason(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="nf-body-sm mt-row font-semibold text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
