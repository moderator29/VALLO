import type { CSSProperties } from "react";
import { RATING_SCALE } from "@/lib/listings/stats/rating";

/**
 * FIVE STARS FILLED TO THE HALF (founder, 14 November 2026). The platform's
 * own star primitive (`.nf-stars` in `app/css/symbols.css`): a rail of five
 * muted stars with the lit fraction laid on it and cut at the rating, so 2.5
 * is two whole stars and exactly half of the third. This component only
 * snaps the figure to halves and sets the size.
 *
 * Decorative by default: the figure and its sentence are said by whoever
 * draws it. Pass `label` to make it speak on its own. Server and client safe.
 */
export function StarMeter({
  stars,
  size = 12,
  label,
  className,
}: {
  /** 0 to 5, in halves. */
  stars: number;
  /** The height of a star in pixels. */
  size?: number;
  label?: string;
  className?: string;
}) {
  const value = Math.max(0, Math.min(RATING_SCALE * 2, Math.round(stars * 2))) / 2;
  const style = { "--nf-stars-value": value, fontSize: `${size / 16}rem` } as CSSProperties;
  return (
    <span
      className={["nf-stars", className ?? ""].filter(Boolean).join(" ")}
      style={style}
      data-stars={value}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
