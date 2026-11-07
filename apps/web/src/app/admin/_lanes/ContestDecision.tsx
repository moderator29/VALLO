"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmPanel } from "@/components/app/confirm/ConfirmPanel";
import { criterionLabel } from "@/lib/host/review-contest";
import { decideReviewContest } from "@/lib/admin/review-contest-actions";
import { CONTEST_PUBLIC_NOTE_MAX, suggestedPublicNote, type ContestOutcome } from "@/lib/admin/review-contest-decision";
import type { ContestView } from "@/lib/admin/reads/review-contests";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * A LISTER ASKED VALLO TO LOOK AT A REVIEW: the decision, on the report that
 * carries it. What is being judged sits in the card (the review's words, its
 * rating, the reason the lister chose and their note), and the two outcomes
 * each confirm in the shared confirm panel:
 *
 *   Keep the review   it stays up and keeps counting toward the rating
 *   Hide the review   hidden behind a public note, never deleted, and it
 *                     stops counting toward the rating
 *
 * Both close the report with the operator's name on it and tell the lister
 * and the reviewer (the database function does all three). A refusal is
 * said in the banner in the server's sentence; success refreshes the lane.
 */
export function ContestDecision({ contest }: { contest: ContestView }) {
  const router = useRouter();
  const [open, setOpen] = useState<ContestOutcome | null>(null);
  const [note, setNote] = useState(() => suggestedPublicNote(contest.criterion));
  const [done, setDone] = useState(false);
  const [pending, start] = useSafeTransition();

  const reason = criterionLabel(contest.criterion);
  const place = contest.place ?? "The place";
  const rating = contest.rating !== null ? `${contest.rating} of 5` : "No rating";

  const decide = (outcome: ContestOutcome): void => {
    start(async () => {
      try {
        const result = await decideReviewContest({ contestId: contest.id, outcome, publicNote: outcome === "hide" ? note : null });
        if (!result.ok) {
          banner.error(result.error, { retry: () => decide(outcome) });
          return;
        }
        setOpen(null);
        const said =
          outcome === "hide" ? "Hidden, with your note in its place. The lister and the reviewer are told." : "Kept up. The lister and the reviewer are told.";
        /* Decided: the banner says so and the refresh moves the report off
           the lane; until it lands the two outcomes are not offered again. */
        setDone(true);
        banner.success(said);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const close = () => {
    if (pending) return;
    setOpen(null);
  };

  const trimmed = note.trim();

  return (
    <div className="mt-md grid gap-sm" data-testid="contest-decision">
      <div className="nf-panel p-sm">
        <p className="nf-section-label">The review, {rating}</p>
        <p className="mt-2xs whitespace-pre-wrap break-words text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-primary)]">
          {contest.body ? `“${contest.body}”` : "A rating with no words."}
        </p>
        <p className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
          {place}. The lister says: {reason}
          {contest.note ? `. Their note, for Vallo only: “${contest.note}”` : ""}
        </p>
      </div>

      {done ? null : (
        <div className="flex flex-wrap gap-xs">
          <Button variant="secondary" disabled={pending} onClick={() => setOpen("keep")}>
            Keep the review
          </Button>
          <Button variant="secondary" leadingIcon="eye-off" disabled={pending || contest.hidden} onClick={() => setOpen("hide")}>
            Hide with a public note
          </Button>
        </div>
      )}

      <Sheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title={open === "hide" ? "Hide this review?" : "Keep this review up?"}
        hideTitle
        card
        detents={[0.9]}
      >
        {open === "keep" ? (
          <ConfirmPanel
            icon="shield-check"
            tone="success"
            title="Keep this review up?"
            context="It meets the review standards. It stays up and keeps counting toward the rating."
            summary={[
              { label: "Place", value: place },
              { label: "Rating", value: rating },
              { label: "Asked about", value: reason },
            ]}
            next={[
              { icon: "flag", text: "The report closes with your name on it." },
              { icon: "bell", text: "The lister is told it stays up and can still answer it publicly. The reviewer is told too." },
            ]}
            told="The lister and the reviewer are told at once."
            cancel={
              <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={close}>
                Cancel
              </Button>
            }
            primary={
              <Button type="button" size="sm" loading={pending} disabled={pending} onClick={() => decide("keep")}>
                Keep the review
              </Button>
            }
          />
        ) : open === "hide" ? (
          <ConfirmPanel
            icon="eye-off"
            tone="warning"
            title="Hide this review?"
            context="Never deleted: it is hidden from others and stops counting toward the rating."
            summary={[
              { label: "Place", value: place },
              { label: "Rating", value: rating },
              { label: "Asked about", value: reason },
            ]}
            next={[
              { icon: "eye-off", text: "Guests see your public note where the review was." },
              { icon: "flag", text: "The report closes with your name on it." },
              { icon: "bell", text: "The lister and the reviewer are told, with the note." },
            ]}
            told="The lister and the reviewer are told at once."
            cancel={
              <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={close}>
                Cancel
              </Button>
            }
            primary={
              <Button
                type="button"
                size="sm"
                loading={pending}
                disabled={pending || trimmed.length === 0 || trimmed.length > CONTEST_PUBLIC_NOTE_MAX}
                onClick={() => decide("hide")}
              >
                Hide the review
              </Button>
            }
          >
            <label className="block">
              <span className="nf-label">Public note, shown in its place</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={CONTEST_PUBLIC_NOTE_MAX}
                className="nf-field mt-2xs w-full"
                aria-describedby="contest-note-count"
              />
              <span id="contest-note-count" className="mt-2xs block text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                {trimmed.length} of {CONTEST_PUBLIC_NOTE_MAX} characters. Guests, the lister and the reviewer all read it.
              </span>
            </label>
          </ConfirmPanel>
        ) : null}
      </Sheet>
    </div>
  );
}
