"use client";

import { useState } from "react";
import "@/app/css/calls.css";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { completeReviewCall } from "@/lib/calls/review-actions";
import { lagosInputToIso, outcomeFormErrors, type FormErrors } from "@/lib/calls/screen";
import type { ReviewCompletionOutcome } from "@/lib/calls/types";
import type { CallsCopy } from "../views";
import { banner } from "@/lib/ui/toast";
import { FieldProblem } from "@/components/ui/FieldProblem";

const OUTCOMES: ReviewCompletionOutcome[] = [
  "REVIEW_COMPLETED",
  "MORE_INFORMATION_REQUIRED",
  "FOLLOW_UP_REQUIRED",
  "ESCALATED",
  "NO_SHOW",
];

/**
 * THE OUTCOME FORM. One of the five outcomes `completeReviewCall` takes
 * (CANCELLED is the cancel form's), a summary, and a due date when the
 * outcome is a follow-up. Checked here first (`outcomeFormErrors`) so a
 * missing field is said beside the field, and checked again by the server.
 * Recording an outcome ends a live review call and closes the review; it
 * changes no verification, badge or listing status by itself.
 */
/* What recording the outcome did, said by the one banner (founder, 7 November 2026). */
const WORDS = { recorded: "Outcome recorded" };

export function ReviewOutcomeForm({
  reviewId,
  copy,
  onDone,
}: {
  reviewId: string;
  copy: CallsCopy;
  onDone?: () => void;
}) {
  const s = copy.staff;
  const [outcome, setOutcome] = useState<ReviewCompletionOutcome | "">("");
  const [summary, setSummary] = useState("");
  const [followUpDue, setFollowUpDue] = useState("");
  const [errors, setErrors] = useState<FormErrors<"outcome" | "summary" | "followUpDue">>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = outcomeFormErrors({ outcome, summary, followUpDue }, Date.now(), s.errors);
    setErrors(found);
    if (Object.keys(found).length > 0 || !outcome) return;
    setBusy(true);
    const due = outcome === "FOLLOW_UP_REQUIRED" ? lagosInputToIso(followUpDue) : null;
    const answer = await completeReviewCall({
      reviewId,
      outcome,
      summary: summary.trim(),
      ...(due ? { followUpDueAt: due } : {}),
    }).catch(() => null);
    setBusy(false);
    if (!answer || !answer.ok) {
      banner.error(answer ? answer.error : copy.connecting.body);
      return;
    }
    banner.success(WORDS.recorded);
    onDone?.();
  };

  return (
    <form className="nf-review-call__card" onSubmit={(e) => void submit(e)} noValidate data-testid="review-outcome-form">
      <fieldset className="nf-review-call__radios" aria-describedby={errors.outcome ? "review-outcome-error" : undefined}>
        <legend className="nf-review-call__label">{s.outcome}</legend>
        {OUTCOMES.map((o) => (
          <label key={o} className="nf-review-call__radio">
            <input
              type="radio"
              name="review-outcome"
              value={o}
              checked={outcome === o}
              onChange={() => setOutcome(o)}
              data-testid={`review-outcome-${o}`}
            />
            {s.outcomes[o]}
          </label>
        ))}
      </fieldset>
      {/* The choice keeps its words for a screen reader; the banner says them (founder, 7 November 2026). */}
      <FieldProblem id="review-outcome-error" message={errors.outcome} />
      <TextArea
        label={s.outcomeSummary}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        maxLength={4000}
        rows={4}
        error={errors.summary}
        data-testid="review-outcome-summary"
      />
      {outcome === "FOLLOW_UP_REQUIRED" ? (
        <TextField
          type="datetime-local"
          label={s.followUpDue}
          value={followUpDue}
          onChange={(e) => setFollowUpDue(e.target.value)}
          error={errors.followUpDue}
          data-testid="review-outcome-due"
        />
      ) : null}
      <div>
        <Button type="submit" variant="primary" size="md" loading={busy} data-testid="review-outcome-submit">
          {s.complete}
        </Button>
      </div>
    </form>
  );
}
