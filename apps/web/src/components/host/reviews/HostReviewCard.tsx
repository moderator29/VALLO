"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { answerHotelReview, contestHotelReview, withdrawHotelReviewAnswer } from "@/lib/host/review-actions";
import { CONTEST_CRITERIA, CONTEST_NOTE_MAX, contestWords, type ContestCriterion } from "@/lib/host/review-contest";
import type { HostReview } from "@/lib/host/reviews";
import { useHostPageCopy } from "@/components/host/host-copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * ONE REVIEW OF THE HOST'S HOTEL (C4): what the guest wrote, the host's one
 * public answer (written, corrected or taken back in place), and "Ask Vallo
 * to look at this review", which opens the published criteria in a sheet.
 * A hidden review is shown to the host with the note the public sees in its
 * place, so the host always knows what a guest can read.
 */
export function HostReviewCard({ review, when }: { review: HostReview; when: string }) {
  const router = useRouter();
  const w = useHostPageCopy().reviewCard;
  const [pending, start] = useSafeTransition();
  const [writing, setWriting] = useState(false);
  const [reply, setReply] = useState(review.reply?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [contesting, setContesting] = useState(false);
  const [criterion, setCriterion] = useState<ContestCriterion | null>(null);
  const [note, setNote] = useState("");
  const [contestError, setContestError] = useState<string | null>(null);

  const saveReply = () =>
    start(async () => {
      try {
        setError(null);
        const result = await answerHotelReview({ reviewId: review.id, body: reply });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setWriting(false);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const withdraw = () =>
    start(async () => {
      try {
        setError(null);
        const result = await withdrawHotelReviewAnswer({ reviewId: review.id });
        if (!result.ok) setError(result.error);
        else {
          setReply("");
          router.refresh();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const sendContest = () =>
    start(async () => {
      try {
        setContestError(null);
        const result = await contestHotelReview({ reviewId: review.id, criterion, note: note.trim() || undefined });
        if (!result.ok) {
          setContestError(result.error);
          return;
        }
        setContesting(false);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const openContest = review.contest?.status === "open";

  return (
    <article className="nf-hreview" data-testid="host-review">
      <header className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="nf-decide__title">{review.author}</p>
          <p className="nf-decide__sub">
            {review.place} · {when}
          </p>
        </div>
        <span className="nf-hreview__stars" role="img" aria-label={w.outOfFive.replace("{rating}", String(review.rating))}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} {...(n > review.rating ? { "data-off": "" } : {})}>
              <UiIcon name="star" size={16} filled={n <= review.rating} />
            </span>
          ))}
        </span>
      </header>

      {review.body ? <p className="nf-hreview__body">{review.body}</p> : <p className="nf-hreview__hidden">{w.noWords}</p>}

      {review.hiddenAt ? (
        <p className="nf-hreview__hidden">
          <StatusBadge tone="neutral" kind="dot">
            {w.hidden}
          </StatusBadge>{" "}
          {w.hiddenInstead.replace("{note}", review.hiddenNote ?? w.removedByVallo)}
        </p>
      ) : null}

      {review.contest ? (
        <p className="nf-caption">
          <StatusBadge tone={openContest ? "pending" : review.contest.status === "hidden" ? "success" : "neutral"} kind="dot">
            {openContest ? w.askedVallo : w.decided}
          </StatusBadge>{" "}
          {contestWords(review.contest.status, review.contest.publicNote, w.contestStatus)}
        </p>
      ) : null}

      {review.reply && !writing ? (
        <div className="nf-hreview__reply">
          <p className="nf-section-label">{w.yourReply}</p>
          <p className="mt-2xs whitespace-pre-line">{review.reply.body}</p>
        </div>
      ) : null}

      {writing ? (
        <div className="grid gap-xs">
          <TextArea
            label={w.replyLabel}
            rows={4}
            maxLength={1200}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            hint={w.replyHint}
          />
          <div className="nf-hreview__actions">
            <Button variant="primary" size="md" loading={pending} disabled={pending || reply.trim().length === 0} onClick={saveReply}>
              {review.reply ? w.saveReply : w.postReply}
            </Button>
            <Button variant="secondary" size="md" disabled={pending} onClick={() => setWriting(false)}>
              {w.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="nf-hreview__actions">
            <Button variant="secondary" size="md" leadingIcon="chat-bubble" disabled={pending} onClick={() => setWriting(true)}>
              {review.reply ? w.editReply : w.reply}
            </Button>
          </div>
          {/* The quieter doors sit on a foot under a hairline, their words in
              line with the card's text, instead of wrapping under the reply
              button at a different indent. */}
          {review.reply || (!review.hiddenAt && !openContest) ? (
            <div className="nf-hreview__foot">
              {review.reply ? (
                <Button variant="quiet" size="md" disabled={pending} onClick={withdraw}>
                  {w.takeBack}
                </Button>
              ) : null}
              {!review.hiddenAt && !openContest ? (
                <Button variant="quiet" size="md" leadingIcon="flag" disabled={pending} onClick={() => setContesting(true)}>
                  {w.askVallo}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {error ? (
        <p className="nf-rcal-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      <Sheet
        open={contesting}
        onOpenChange={(next) => !pending && setContesting(next)}
        title={w.contestTitle}
        detents={[0.92]}
        footer={
          <div className="flex flex-wrap gap-sm">
            <Button variant="secondary" size="lg" full disabled={pending} onClick={() => setContesting(false)}>
              {w.cancel}
            </Button>
            <Button variant="primary" size="lg" full loading={pending} disabled={pending || !criterion} onClick={sendContest}>
              {w.send}
            </Button>
          </div>
        }
      >
        <div className="grid gap-md">
          <p className="nf-body">{w.contestBody}</p>
          <fieldset className="grid gap-xs">
            <legend className="nf-section-label mb-xs">{w.whichStandard}</legend>
            {CONTEST_CRITERIA.map((value) => (
              <label key={value} className="nf-hreview-choice">
                <input
                  type="radio"
                  name={`contest-${review.id}`}
                  value={value}
                  checked={criterion === value}
                  onChange={() => setCriterion(value)}
                  className="nf-hreview-choice__input"
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{w.criteria[value].label}</span>
                  <span className="nf-caption block">{w.criteria[value].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <TextArea
            label={w.noteLabel}
            rows={3}
            maxLength={CONTEST_NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            hint={w.noteHint}
          />
          {contestError ? (
            <p className="nf-rcal-panel__error" role="alert">
              {contestError}
            </p>
          ) : null}
        </div>
      </Sheet>
    </article>
  );
}
