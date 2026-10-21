import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from "react";
import "@/app/css/site.css";
import { EdgeLapRing } from "./EdgeLapRing";

/**
 * THE EDGE LAP: a thin light that runs round a container's rim, the logo
 * pill's "snake" given to any premium container (the founder, 29 September
 * 2026). The material is `.nf-edge-lap` in `app/css/site.css`; this is the
 * component form so a builder can wrap a block without remembering the
 * class, and tune it without writing CSS.
 *
 *   as       the element ("div" by default); give it a radius and the ring
 *            follows the corner
 *   speed    seconds per lap (6 by default; the logo runs 7.5, the dock's
 *            "+" 5)
 *   ink      the light's colour (the brand glow by default)
 *
 * Decorative and server-safe. The ring is one empty `aria-hidden` child after
 * the host's own (`.nf-edge-lap__ring`): its light turns on the compositor,
 * so the main thread does no work per frame (site.css says why). It stops,
 * and settles to a faint steady rim, under reduced motion, data saver and
 * the Calm and Off settings.
 * Ration it: the landing's two capsules, a hero's one card.
 */
type EdgeLapOwnProps<E extends ElementType> = {
  as?: E;
  speed?: number;
  ink?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export type EdgeLapProps<E extends ElementType = "div"> = EdgeLapOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof EdgeLapOwnProps<E>>;

export function EdgeLap<E extends ElementType = "div">({
  as,
  speed,
  ink,
  className,
  style,
  children,
  ...rest
}: EdgeLapProps<E>) {
  const Tag: ElementType = as ?? "div";
  const tuned: CSSProperties = {
    ...style,
    ...(speed ? ({ "--nf-edge-lap-speed": `${speed}s` } as CSSProperties) : null),
    ...(ink ? ({ "--nf-edge-lap-ink": ink } as CSSProperties) : null),
  };
  return (
    <Tag {...rest} className={["nf-edge-lap", className ?? ""].filter(Boolean).join(" ")} style={tuned}>
      {children}
      <EdgeLapRing />
    </Tag>
  );
}
