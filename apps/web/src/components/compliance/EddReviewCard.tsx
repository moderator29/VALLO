"use client";

import { useActionState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Check";
import type { ActionResult } from "@/lib/actions/envelope";
import { approveEddDecision, decideEddReview } from "@/lib/compliance/edd-actions";
import type { EddStage } from "@/lib/compliance/edd";
import { useActionBanner } from "@/components/ui/use-action-banner";

/**
 * SCUML items 20, 15 and 19: one enhanced due diligence review on the
 * compliance desk. Undecided: record the source of funds and an outcome.
 * Decided by somebody else: approve. Decided by you: wait for a second person
 * (the database refuses your approval anyway). Staff only.
 */
export type EddCardView = {
  reviewId: string;
  item: 15 | 20;
  stage: EddStage;
  heading: string;
  lines: string[];
  decisionId: string | null;
  decisionLine: string | null;
};

type Copy = Dictionary["compliancePep"]["lane"];

export function EddReviewCard({ view, copy }: { view: EddCardView; copy: Copy }) {
  const [decideState, decide, deciding] = useActionState<ActionResult<null> | null, FormData>(decideEddReview, null);
  const [approveState, approve, approving] = useActionState<ActionResult<null> | null, FormData>(approveEddDecision, null);
  const id = `edd-${view.reviewId}`;
  /* Saved or refused, said by the one banner at the top of the screen (founder, 7 November 2026). */
  useActionBanner(decideState, { ok: copy.decisionSaved });
  useActionBanner(approveState, { ok: copy.approved });

  return (
    <li className="nf-admin-case" data-testid="edd-review">
      <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">{view.heading}</p>
      {view.lines.map((line) => (
        <p key={line} className="nf-caption mt-2xs text-[var(--nf-content-muted)]">
          {line}
        </p>
      ))}
      {view.decisionLine ? <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{view.decisionLine}</p> : null}

      {view.stage === "undecided" ? (
        <form action={decide} className="mt-group grid gap-sm">
          <input type="hidden" name="reviewId" value={view.reviewId} />
          <input type="hidden" name="item" value={String(view.item)} />
          <div>
            <label htmlFor={`${id}-sof`} className="nf-label block">
              {copy.sourceOfFunds}
            </label>
            <textarea
              id={`${id}-sof`}
              name="sourceOfFunds"
              required
              minLength={2}
              maxLength={1000}
              rows={3}
              aria-describedby={`${id}-sof-help`}
              className="nf-field mt-xs w-full"
            />
            <p id={`${id}-sof-help`} className="nf-caption mt-2xs text-[var(--nf-content-muted)]">
              {copy.sourceOfFundsHelp}
            </p>
          </div>
          <fieldset>
            <legend className="nf-label mb-inline">{copy.outcome}</legend>
            <div className="flex flex-wrap gap-xs">
              <Radio name="outcome" value="cleared" required>
                {copy.cleared}
              </Radio>
              <Radio name="outcome" value="refer">
                {copy.refer}
              </Radio>
            </div>
          </fieldset>
          <div>
            <label htmlFor={`${id}-note`} className="nf-label block">
              {copy.note}
            </label>
            <input id={`${id}-note`} name="note" maxLength={1000} className="nf-field mt-xs min-h-[44px] w-full" />
          </div>
          {/* The decision stays one thumb away on a phone while the source of
              funds above it is read (the console's decision bar). */}
          <div className="nf-admin-decision">
            <Button type="submit" variant="primary" full loading={deciding}>
              {copy.decide}
            </Button>
          </div>
        </form>
      ) : null}

      {view.stage === "awaiting_second" && view.decisionId ? (
        <form action={approve} className="mt-group">
          <input type="hidden" name="decisionId" value={view.decisionId} />
          <input type="hidden" name="item" value={String(view.item)} />
          <div className="nf-admin-decision">
            <Button type="submit" variant="primary" full loading={approving}>
              {copy.approve}
            </Button>
          </div>
        </form>
      ) : null}

      {view.stage === "own_decision" ? <p className="nf-caption mt-inline text-[var(--nf-content-muted)]">{copy.ownDecision}</p> : null}

    </li>
  );
}
