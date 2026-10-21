import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { EdgeLapRing } from "@/components/site/EdgeLapRing";

/**
 * THE HERO BAND: the block at the top of a screen that opens a world or
 * carries a headline number (`docs/design/CLEAN_UNIFIED_DIRECTION.md`
 * section 16, Q2).
 *
 * The material is `.nf-hero-band` (`app/css/controls.css` and
 * `brand-glass.css` for the night, `app/css/light.css` for paper). It takes
 * the page's own palette: at night a raised night surface under the navy
 * glass bloom; by day a white card on the warm paper with a whisper of brand
 * in its corner. It was a night island in both themes, a navy block the
 * height of Home's top on a light page, and the founder found that blue on
 * white too heavy (October 2026): the brand blue is kept for the one action
 * it holds and for what is chosen. The same radius and inner spacing
 * everywhere; no photograph behind it (a hero that is a photograph keeps its
 * own night).
 *
 * Where it goes: Home, the host and agent workspace home (the KPI row sits
 * on it), the profile and trust hero, money and earnings summaries, the
 * booking, stay and agreement live-status headers, success moments. Never on
 * settings, search results, the inbox, threads, forms or admin tables.
 *
 *   label    optional section label above the title (sentence case string;
 *            the class sets it in caps)
 *   title    the headline or the figure's name
 *   sub      one muted sentence under the title
 *   action   the one action (usually a primary `Button`), placed top right
 *            from a tablet up and under the text on a phone
 *   children anything below the head: a figure, a KPI row, a stepper
 *   as       the element ("section" by default)
 *   titleAs  "h2" (default) or "h1": the screen's own title, for a workspace
 *            home whose band IS the page's heading (a page needs one h1)
 *   lap      the edge lap round the rim (`.nf-edge-lap`, site.css): the
 *            workspace home's one band only
 *
 * Server-safe: nothing here holds state.
 */
type HeroBandOwnProps<E extends ElementType> = {
  as?: E;
  label?: ReactNode;
  title?: ReactNode;
  titleAs?: "h1" | "h2";
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
  lap?: boolean;
  children?: ReactNode;
};

export type HeroBandProps<E extends ElementType = "section"> = HeroBandOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof HeroBandOwnProps<E>>;

export function HeroBand<E extends ElementType = "section">({
  as,
  label,
  title,
  titleAs: TitleTag = "h2",
  sub,
  action,
  className,
  lap = false,
  children,
  ...rest
}: HeroBandProps<E>) {
  const Tag: ElementType = as ?? "section";
  const hasHead = label != null || title != null || sub != null || action != null;
  return (
    <Tag {...rest} className={["nf-hero-band", lap ? "nf-edge-lap" : "", className ?? ""].filter(Boolean).join(" ")}>
      {hasHead ? (
        <div className="nf-hero-band__head">
          <div className="nf-hero-band__text">
            {label != null ? <p className="nf-section-label nf-hero-band__label">{label}</p> : null}
            {title != null ? <TitleTag className="nf-hero-band__title">{title}</TitleTag> : null}
            {sub != null ? <p className="nf-hero-band__sub">{sub}</p> : null}
          </div>
          {action != null ? <div className="nf-hero-band__action">{action}</div> : null}
        </div>
      ) : null}
      {children != null ? <div className="nf-hero-band__body">{children}</div> : null}
      {lap ? <EdgeLapRing /> : null}
    </Tag>
  );
}
