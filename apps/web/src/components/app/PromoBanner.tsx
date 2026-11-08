import Link from "next/link";

import { Icon3D, type Icon3DName } from "@/components/ui/Icon3D";
import { UiIcon } from "@/design-system/icons/UiIcon";

import "./promo-banner.css";

/**
 * A "NEW FEATURE" BANNER (8 November 2026), for any surface that wants to
 * point at something new: Roommates, the feed, Circle. Royal blue ground
 * (a night island in both themes), the eyebrow badge, a bold title, one
 * line, one clear action, and one of the founder's 3D objects standing at
 * the end edge with a slow float. The whole banner is the link. Server safe.
 */
export function PromoBanner({
  eyebrow,
  title,
  body,
  href,
  cta,
  art,
  testId,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  art: Icon3DName;
  testId?: string;
}) {
  return (
    <Link href={href} className="nf-promo" data-theme="dark" data-testid={testId}>
      <span className="nf-promo__glow" aria-hidden="true" />
      <span className="nf-promo__words">
        <span className="nf-promo__eyebrow">{eyebrow}</span>
        <span className="nf-promo__title">{title}</span>
        <span className="nf-promo__body">{body}</span>
        <span className="nf-promo__cta">
          {cta}
          <UiIcon name="arrow-right" size={16} />
        </span>
      </span>
      <span className="nf-promo__art" aria-hidden="true">
        <Icon3D name={art} size={104} classic />
      </span>
    </Link>
  );
}
