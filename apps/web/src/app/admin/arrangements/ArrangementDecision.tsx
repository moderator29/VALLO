"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { decideArrangement } from "@/lib/admin/arrangement-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { PROSE_KEYBOARD } from "@/lib/ui/field-keyboard";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { banner } from "@/lib/ui/toast";

type Decision = "refund" | "release";

const COPY = {
  reasonLabel: "Reason for the decision",
  reasonHint: "At least 20 characters. It is kept on the payment's record and in the audit log, and it is what the decision is judged on later.",
  refund: "Refund the payer",
  release: "Release to the lister",
  confirmRefund: "Send the refund instruction",
  confirmRelease: "Send the release instruction",
  back: "Go back",
  askRefund: "This instructs the partner to return the whole amount to the payer. It cannot be undone once the partner acts on it.",
  askRelease: "This instructs the partner to pay the whole amount to the lister. It cannot be undone once the partner acts on it.",
  sent: "The instruction was sent. The record changes when the partner reports it.",
  unanswered: "The partner did not answer. Nothing is recorded as moved; the next check reads its answer.",
} as const;

/**
 * The two decisions staff make on a protected payment: return it to the
 * payer, or pay it to the lister. A reason first, then the choice, then a
 * second press that says exactly what will be sent. The press only sends the
 * instruction; the record changes when the partner reports the outcome.
 */
export function ArrangementDecision({ arrangementId, canRefund, canRelease }: { arrangementId: string; canRefund: boolean; canRelease: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [chosen, setChosen] = useState<Decision | null>(null);
  const [pending, start] = useSafeTransition();
  const ready = reason.trim().length >= 20;

  function send(decision: Decision) {
    start(async () => {
      try {
        const result = await decideArrangement({ arrangementId, decision, reason });
        if (!result.ok) {
          banner.error(result.fieldErrors?.["reason"] ?? result.error);
          return;
        }
        if (result.data.submitted) banner.success(COPY.sent);
        else banner.warning(COPY.unanswered);
        setChosen(null);
        setReason("");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="nf-admin-decision" data-testid="arrangement-decision">
      <label className="block">
        <span className="nf-label">{COPY.reasonLabel}</span>
        <textarea
          className="nf-field"
          rows={3}
          maxLength={500}
          {...PROSE_KEYBOARD}
          value={reason}
          disabled={pending || chosen !== null}
          onChange={(e) => setReason(e.target.value)}
          data-testid="arrangement-decision-reason"
        />
        <span className="nf-caption mt-inline-tight block">{COPY.reasonHint}</span>
      </label>
      {chosen === null ? (
        <div className="mt-row flex flex-wrap gap-xs">
          {canRefund ? (
            <Button variant="secondary" disabled={!ready || pending} onClick={() => setChosen("refund")} data-testid="arrangement-decide-refund">
              {COPY.refund}
            </Button>
          ) : null}
          {canRelease ? (
            <Button variant="secondary" disabled={!ready || pending} onClick={() => setChosen("release")} data-testid="arrangement-decide-release">
              {COPY.release}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-row" data-testid="arrangement-decision-confirm">
          <p className="nf-body">{chosen === "refund" ? COPY.askRefund : COPY.askRelease}</p>
          <div className="mt-row flex flex-wrap gap-xs">
            <Button variant="danger" disabled={pending} onClick={() => send(chosen)} data-testid="arrangement-decision-send">
              {chosen === "refund" ? COPY.confirmRefund : COPY.confirmRelease}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setChosen(null)}>
              {COPY.back}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
