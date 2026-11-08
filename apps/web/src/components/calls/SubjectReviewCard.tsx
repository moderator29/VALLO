"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/css/calls.css";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { respondToReviewCall } from "@/lib/calls/review-actions";
import { subjectStatusWords } from "@/lib/calls/reviews";
import { fill, lagosInputToIso, lagosWords } from "@/lib/calls/screen";
import type { SubjectReview } from "@/lib/calls/types";
import { resolveDeepLink } from "./CallLayer";
import type { CallsCopy } from "./views";
import { banner } from "@/lib/ui/toast";

/**
 * THE REVIEW CALL INVITATION, as the person it is about sees it: from "the
 * Vallo review team" (never a staff member's name), why, which of their
 * cases, when in Lagos time, and three answers. When the team is calling,
 * Join opens the ringing call through the same layer as a Messages call.
 *
 * The line that a review call verifies nothing by itself is part of the
 * contract and is always drawn.
 */
const ANSWERABLE = new Set(["REQUESTED", "SCHEDULED", "RESCHEDULE_REQUESTED"]);

export function SubjectReviewCard({ review, copy, preview = false }: { review: SubjectReview; copy: CallsCopy; preview?: boolean }) {
  const router = useRouter();
  const r = copy.review;
  const [proposing, setProposing] = useState(false);
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const answer = async (response: "ACCEPT" | "DECLINE" | "PROPOSE") => {
    let proposedFor: string | undefined;
    if (response === "PROPOSE") {
      const iso = lagosInputToIso(at);
      if (!iso) {
        banner.error(copy.staff.errors.time);
        return;
      }
      proposedFor = iso;
    }
    setBusy(response);
    const result = await respondToReviewCall({ reviewId: review.id, response, ...(proposedFor ? { proposedFor } : {}) }).catch(() => null);
    setBusy(null);
    if (!result || !result.ok) {
      banner.error(result ? result.error : copy.connecting.body);
      return;
    }
    /* Said by the one banner at the top of the screen (founder, 7 November 2026). */
    banner.success(r.yourAnswerSaved);
    setProposing(false);
    if (!preview) router.refresh();
  };

  return (
    <div className="nf-review-call" data-testid="subject-review">
      <section className="nf-review-call__card">
        <p className="flex items-center gap-xs nf-review-call__label">
          <UiIcon name={review.kind === "VIDEO" ? "video" : "phone"} size={16} filled />
          {r.from}
        </p>
        <div>
          <p className="nf-review-call__label">{r.purpose}</p>
          <p className="nf-review-call__value">{review.purpose}</p>
        </div>
        <div>
          <p className="nf-review-call__label">{r.about}</p>
          <p className="nf-review-call__value">{review.caseWords || copy.staff.caseKinds[review.caseKind]}</p>
        </div>
        <div>
          <p className="nf-review-call__label">{r.when}</p>
          <p className="nf-review-call__value">
            {review.scheduledFor ? `${lagosWords(review.scheduledFor)} (${r.lagosTime})` : r.noTimeYet}
          </p>
        </div>
        <div>
          <p className="nf-review-call__label">{r.status}</p>
          <p className="nf-review-call__value" data-testid="subject-review-status">
            {subjectStatusWords(review.status)}
          </p>
        </div>
        {ANSWERABLE.has(review.status) && review.respondBy ? (
          <p className="nf-call__note">{fill(r.respondBy, { when: `${lagosWords(review.respondBy)} (${r.lagosTime})` })}</p>
        ) : null}
      </section>

      <p className="nf-review-call__disclaimer">
        <UiIcon name="info" size={16} />
        <span>{r.notVerification}</span>
      </p>

      {review.liveCallId ? (
        <section className="nf-review-call__card">
          <p className="font-semibold">{r.liveNow}</p>
          <Button variant="primary" size="lg" full leadingIcon="video" onClick={() => void resolveDeepLink(review.liveCallId)} data-testid="subject-review-join">
            {r.joinNow}
          </Button>
        </section>
      ) : ANSWERABLE.has(review.status) ? (
        <section className="nf-review-call__card">
          <div className="grid gap-xs">
            <Button variant="primary" size="lg" full loading={busy === "ACCEPT"} disabled={busy !== null} onClick={() => void answer("ACCEPT")} data-testid="subject-review-accept">
              {r.accept}
            </Button>
            <Button variant="secondary" size="lg" full disabled={busy !== null} onClick={() => setProposing((v) => !v)} aria-expanded={proposing}>
              {r.propose}
            </Button>
            {proposing ? (
              <div className="grid gap-xs">
                <TextField type="datetime-local" label={`${r.proposeLabel} (${r.lagosTime})`} value={at} onChange={(e) => setAt(e.target.value)} />
                <Button variant="secondary" size="md" loading={busy === "PROPOSE"} onClick={() => void answer("PROPOSE")} data-testid="subject-review-propose">
                  {r.proposeSend}
                </Button>
              </div>
            ) : null}
            <Button variant="dangerQuiet" size="md" full disabled={busy !== null} onClick={() => void answer("DECLINE")} data-testid="subject-review-decline">
              {r.decline}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
