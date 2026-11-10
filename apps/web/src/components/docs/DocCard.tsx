import Link from "next/link";
import { Children, type ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "@/app/css/docs-kit.css";

/**
 * THE INDEX CARD (DOCS_AND_PRESENCE_UPGRADE.md 4.2). One card for every list
 * of documents on the platform: the legal index, the help centre, the guides
 * and the staff manual. A tinted icon container, the title, one plain sentence
 * of what is inside, and a chevron. The icon container is what lets a reader
 * scan nine documents in four seconds, so it is a real element with one size,
 * radius and tint everywhere, in both themes.
 *
 * Server-safe: no state, no effects. The press feedback and the arrival are
 * CSS (docs-kit.css), and both stand still under reduced motion.
 */
export function DocCard({
  href,
  icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: UiIconName;
  title: string;
  /** One sentence: what a reader finds inside. */
  description: string;
  /** An optional small line under the description (a date, a count). */
  meta?: ReactNode;
}) {
  return (
    <Link href={href} className="nf-doc-card nf-tap">
      <span className="nf-doc-card__icon" aria-hidden="true">
        <UiIcon name={icon} size={22} />
      </span>
      <span className="nf-doc-card__text">
        <span className="nf-doc-card__title">{title}</span>
        <span className="nf-doc-card__body">{description}</span>
        {meta ? <span className="nf-doc-card__meta">{meta}</span> : null}
      </span>
      <UiIcon name="chevron-right" size={18} className="nf-doc-card__chevron" />
    </Link>
  );
}

/** A column of cards that becomes two columns where the width allows. */
export function DocCardGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="nf-doc-card-grid" aria-label={label}>
      {Children.map(children, (child) => (child ? <li className="nf-doc-card-grid__item">{child}</li> : null))}
    </ul>
  );
}


/**
 * The grid, taking its cards as data rather than children, which is how the
 * offers, platform and staff-manual chapters build theirs.
 */
export function DocCards({
  label,
  items,
  children,
}: {
  label?: string;
  items?: { href: string; title: string; line?: string; description?: string; icon: UiIconName }[];
  children?: ReactNode;
}) {
  return (
    <DocCardGrid label={label}>
      {items
        ? items.map((i) => (
            <DocCard key={i.href} href={i.href} icon={i.icon} title={i.title} description={i.line ?? i.description ?? ""} />
          ))
        : children}
    </DocCardGrid>
  );
}
