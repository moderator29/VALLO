"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { decideIdentityCheck } from "@/lib/admin/identity-check-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * Approve or refuse one Dojah check, the same shape as `DocumentDecision`:
 * approving is one tap, refusing asks for the sentence the person is sent.
 */
export function IdentityCheckDecision({ checkId, canApprove }: { checkId: string; canApprove: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problemId = useId();
  const [pending, start] = useTransition();

  function decide(approve: boolean) {
    setError(null);
    start(async () => {
      try {
        const result = await decideIdentityCheck(approve ? { checkId, approve: true } : { checkId, approve: false, reason });
        if (!result.ok) {
          /* A word about the reason stays under the reason; anything else
             is the outcome, and the banner says it. */
          const about = result.fieldErrors?.["reason"];
          if (about) setError(about);
          else banner.error(result.error, { retry: () => decide(approve) });
          return;
        }
        setReason("");
        setShowReason(false);
        banner.success(approve ? "Identity check approved" : "Identity check sent back with your reason");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="nf-admin-decision mt-row" data-testid="identity-check-decision">
      {showReason && (
        <label className="block">
          <span className="nf-label">What is wrong with it</span>
          <textarea
            className="nf-field min-h-[64px] resize-y"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? problemId : undefined}
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
      {/* The field keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
      <FieldProblem id={problemId} message={error} />
    </div>
  );
}
