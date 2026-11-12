import { Skeleton } from "@/components/ui/Skeleton";
import "@/app/css/space-card.css";

/**
 * THE SPACE CARD'S WAIT: the same outer card, the same inset photo and the
 * same separate info panel, in slabs. The title and the price sit on one row
 * as they do on the real card, then the place and the facts line, so a card
 * that arrives does not change shape under the eye. Server-safe, hidden from
 * assistive technology (the section that holds it announces the wait).
 *
 * `body` SAYS WHICH CARD IS COMING, because the three that land on this
 * shell end differently and a shelf of the wrong one settles when the data
 * arrives. Measured in Chromium at 360, 390 and 440 in both themes, with the
 * card at the width its shelf gives it:
 *
 *   "line"  the search row: a title and price row, the place, one line.
 *   "venue" a restaurant: the same, then the amenity chips, which draw 32px
 *           where a line of text draws 12.
 *   "stay"  a stay: the title wraps to two lines beside the nightly figure,
 *           then the place, the chips, the rating and the total for the
 *           nights. A stay with no reviews and no dates draws shorter; this
 *           reserves the shelf's ordinary card, which carries both.
 */
export function SpaceCardSkeleton({
  variant = "card",
  body = "line",
}: {
  variant?: "card" | "compact";
  body?: "line" | "venue" | "stay";
}) {
  return (
    <div aria-hidden="true" className={`nf-sc nf-sc--${variant} nf-sc--skeleton`}>
      <div className="nf-sc__media">
        <Skeleton className="h-full w-full" radius="none" />
      </div>
      <div className="nf-sc__info">
        <div className="nf-sc__head">
          <Skeleton width="55%" height={body === "stay" ? "2.625rem" : "1rem"} radius="xs" />
          <Skeleton width={variant === "compact" ? "35%" : "28%"} height="1.25rem" radius="xs" />
        </div>
        <Skeleton width="40%" height="0.75rem" radius="xs" />
        {body === "line" ? (
          <Skeleton width="70%" height="0.75rem" radius="xs" />
        ) : (
          <div className="grid gap-2xs">
            <div className="flex gap-xs">
              <Skeleton width="5rem" height="2rem" radius="sm" />
              <Skeleton width="7rem" height="2rem" radius="sm" />
            </div>
            {body === "stay" ? (
              <>
                <Skeleton width="45%" height="1rem" radius="xs" />
                <Skeleton width="60%" height="1rem" radius="xs" />
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
