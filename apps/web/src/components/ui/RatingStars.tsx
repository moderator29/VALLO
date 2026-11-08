import { UiIcon } from "@/design-system/icons/UiIcon";
import { RATING_MAX } from "@/lib/reviews/model";

/**
 * A row of five stars. Filled stars take the warm-spark rating colour; empty
 * ones are muted. The `size` matches the ICON ladder (inline 20, row 24,
 * section 28), and the component is accessible to screen readers.
 *
 * Shared: every surface that draws stars (listing detail, catalogue card,
 * review form, host review card, agent reviews, professional profile) imports
 * from here, so the colour, weight and behaviour are a single source.
 */
export function RatingStars({
  rating,
  size = 20,
  className,
}: {
  /** Integer 1 to 5, or a fractional average. Floors to whole stars. */
  rating: number;
  /** Pixel size from the ICON ladder. Default is `ICON.inline` (20). */
  size?: number;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(RATING_MAX, Math.floor(rating)));
  return (
    <span
      className={`inline-flex items-center gap-3xs${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={`${rating} out of ${RATING_MAX}`}
    >
      {Array.from({ length: RATING_MAX }, (_, i) => (
        <UiIcon
          key={i}
          name="star"
          size={size}
          filled={i < filled}
          className={
            i < filled
              ? "text-[var(--nf-rating)]"
              : "text-[var(--nf-content-muted)] opacity-40"
          }
        />
      ))}
    </span>
  );
}
