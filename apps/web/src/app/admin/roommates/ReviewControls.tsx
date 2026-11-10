"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { decisionProblem, type ReviewDecision } from "@/lib/features/roommates/review";
import type { ReviewQueueRow } from "@/lib/features/roommates/review-queue";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { decideRoomOffer } from "./actions";

const DONE: Record<ReviewDecision, string> = {
  claim: "Picked up. It is now in review and the owner has been told.",
  approve: "Approved. The post is live in Vallo Roommates and the owner has been told.",
  changes: "Changes requested. The owner has been told what to fix.",
  reject: "Declined. The owner has been told why.",
};

/**
 * THE REVIEW DECISION: pick up, approve, ask for changes, decline. The
 * sentence that would stop a decision (no ID sent, an ID still waiting, a
 * failed ID check, too few photos) is shown in a banner BEFORE the round trip,
 * naming the exact cause; the database repeats every rule. A reason is
 * required where the owner reads it.
 */
export function ReviewControls({ row }: { row: ReviewQueueRow }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const subject = { status: row.status, authority: row.authority, declared: row.declared, rentMinor: row.rentMinor, photoCount: row.photoCount, identity: row.ownerIdentity };

  const run = (decision: ReviewDecision) => {
    const stop = decisionProblem(decision, note, subject);
    if (stop) {
      feedback("error");
      setProblem(decision === "changes" || decision === "reject" ? stop : undefined);
      banner.error(stop);
      return;
    }
    setProblem(undefined);
    start(async () => {
      try {
        const r = await decideRoomOffer({ id: row.id, decision, note });
        if (!r.ok) {
          feedback("error");
          banner.error(r.error);
          return;
        }
        feedback("confirm");
        banner.success(DONE[decision]);
        setNote("");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const waiting = row.status === "submitted" || row.status === "in_review";
  if (!waiting && row.status !== "changes_requested") return null;
  return (
    <div className="mt-sm grid gap-xs">
      {waiting || row.status === "changes_requested" ? (
        <>
          <label htmlFor={`rv-${row.id}`} className="sr-only">
            Note to the owner
          </label>
          <textarea
            id={`rv-${row.id}`}
            className="nf-field min-h-[64px] w-full resize-y text-[length:var(--nf-text-body-sm)]"
            value={note}
            maxLength={1000}
            placeholder="What to change, or why it is declined. The owner reads this."
            onChange={(e) => setNote(e.target.value)}
          />
          <FieldProblem id={`rv-${row.id}-problem`} message={problem} />
        </>
      ) : null}
      <div className="flex flex-wrap gap-xs">
        {row.status === "submitted" ? (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run("claim")}>
            Pick up
          </Button>
        ) : null}
        {waiting ? (
          <>
            <Button variant="primary" size="sm" disabled={pending} loading={pending} onClick={() => run("approve")}>
              Approve and go live
            </Button>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run("changes")}>
              Ask for changes
            </Button>
          </>
        ) : null}
        <Button variant="danger" size="sm" disabled={pending} onClick={() => run("reject")}>
          Decline
        </Button>
      </div>
    </div>
  );
}
