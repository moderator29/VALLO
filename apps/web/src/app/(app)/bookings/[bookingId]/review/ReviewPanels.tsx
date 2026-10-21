import { ButtonLink } from "@/components/ui/Button";
import type { ListingReview, ReviewSubject } from "@/lib/reviews/queries";
import type { Dictionary } from "@vallo/i18n/core";
import { ICON } from "@/components/app/Screen";
import { Reveal } from "@/components/site/Reveal";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * The two panels of `/bookings/[bookingId]/review` that are not the form:
 * the stay being reviewed, and the review already written. Lifted out of the
 * page so the orphans sweep's fixture harness draws the real markup; the page
 * still reads the stay and decides which state shows.
 */
type ReviewWords = Dictionary["memberFlows"]["review"];

export function ReviewSubjectPanel({ subject, words: w }: { subject: ReviewSubject; words: ReviewWords }) {
  return (
    <Reveal>
      <section className="nf-panel nf-panel--card block p-card">
        <h2 className="nf-h3">{subject.title}</h2>
        {subject.location.length > 0 && (
          <p className="mt-row flex items-center gap-inline nf-body-sm text-[var(--nf-content-muted)]">
            <UiIcon name="location" size={ICON.inline} className="shrink-0" />
            <span className="truncate">{subject.location}</span>
          </p>
        )}
        <p className="mt-row nf-body-sm text-[var(--nf-content-muted)]">
          {w.checkedOut.replace("{date}", subject.checkOutDisplay)}
        </p>
      </section>
    </Reveal>
  );
}

export function AlreadyReviewedPanel({
  subject,
  review,
  words: w,
}: {
  subject: ReviewSubject;
  review: ListingReview;
  words: ReviewWords;
}) {
  return (
    <>
      <Reveal>
        <section className="nf-panel nf-panel--card block p-card">
          <h2 className="nf-h3">{w.alreadyTitle}</h2>
          <p className="mt-row nf-body-sm leading-relaxed text-[var(--nf-content-secondary)]">
            {w.alreadyBody.replace("{title}", subject.title)}
          </p>

          <div className="nf-hairline mt-block pt-block">
            <p className="flex items-center gap-xs">
              <span className="flex items-center gap-3xs" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <UiIcon
                    key={i}
                    name="star"
                    size={ICON.inline}
                    className={
                      i < review.rating
                        ? "text-[var(--nf-rating)]"
                        : "text-[var(--nf-content-muted)] opacity-40"
                    }
                  />
                ))}
              </span>
              <span className="nf-body-sm font-normal text-[var(--nf-content-secondary)]">
                {w.starLabel
                  .replace("{value}", String(review.rating))
                  .replace("{max}", "5")
                  .replace("{label}", w.ratings[review.rating as keyof ReviewWords["ratings"]] ?? "")}
              </span>
            </p>
            {review.body && (
              <p className="mt-heading nf-body leading-relaxed text-[var(--nf-content-primary)]">
                {review.body}
              </p>
            )}
            <p className="mt-heading nf-caption text-[var(--nf-content-muted)]">
              {review.author} &middot; {review.when}
            </p>
          </div>
        </section>
      </Reveal>

      <Reveal delay={80} className="mt-block flex flex-wrap gap-row">
        <ButtonLink href={subject.href} variant="primary">
          {w.seeOnListing}
        </ButtonLink>
        <ButtonLink href="/bookings?side=stays&from=stays" variant="secondary">
          {w.seeStays}
        </ButtonLink>
      </Reveal>
    </>
  );
}
