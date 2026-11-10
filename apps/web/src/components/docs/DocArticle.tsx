import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "@/app/css/docs-kit.css";

/**
 * THE ARTICLE FURNITURE (DOCS_AND_PRESENCE_UPGRADE.md 2.3 and 4.4). An
 * article opens by telling you what it will say: a category pill, the title,
 * the date it was last checked, one paragraph of scope, the two or three
 * sibling documents a reader may want instead, and then an "at a glance"
 * panel for someone who will not read the whole thing. Then the callouts and
 * cross links the body uses. All server-safe.
 */

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/** "9 November 2026" from an ISO date. A visible recent date reads as maintained. */
export function formatDocDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : DATE.format(d);
}

export function DocHeader({
  category,
  title,
  updated,
  children,
  related,
}: {
  category: { icon: UiIconName; label: string };
  title: string;
  /** ISO date the content was last checked against the product. */
  updated: string;
  /** The intro: one paragraph that states the scope in plain words. */
  children?: ReactNode;
  /** The sibling documents a reader may actually want instead. */
  related?: { href: string; label: string }[];
}) {
  return (
    <header className="nf-doc-head">
      <span className="nf-doc-pill">
        <UiIcon name={category.icon} size={14} />
        {category.label}
      </span>
      <h1 className="nf-doc-head__title">{title}</h1>
      <p className="nf-doc-head__date">
        Last updated <time dateTime={updated.slice(0, 10)}>{formatDocDate(updated)}</time>
      </p>
      {children ? <div className="nf-doc-head__intro">{children}</div> : null}
      {related && related.length > 0 ? (
        <p className="nf-doc-head__related">
          Looking for something else?{" "}
          {related.map((r, i) => (
            <span key={r.href}>
              {i > 0 ? (i === related.length - 1 ? " or " : ", ") : null}
              <DocCrossLink href={r.href}>{r.label}</DocCrossLink>
            </span>
          ))}
          .
        </p>
      ) : null}
    </header>
  );
}

/** The tinted "at a glance" panel: three or four bullets. */
export function DocSummary({ title = "At a glance", items }: { title?: string; items: ReactNode[] }) {
  return (
    <aside className="nf-doc-summary" aria-label={title}>
      <p className="nf-doc-summary__title">
        <UiIcon name="bolt" size={16} />
        {title}
      </p>
      <ul className="nf-doc-summary__list">
        {items.map((item, i) => (
          <li key={i}>
            <UiIcon name="check" size={16} className="nf-doc-summary__tick" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

const CALLOUT_ICON: Record<DocCalloutTone, UiIconName> = {
  note: "info",
  warning: "alert-triangle",
  "not-live": "hourglass",
  tip: "bolt",
};

export type DocCalloutTone = "note" | "warning" | "not-live" | "tip";

/**
 * A note, a warning, a tip, or "this is not live yet". The not-live tone is
 * how a document stays honest about the protected rail and anything else
 * built but switched off: it says so in a shape a reader cannot miss.
 */
export function DocCallout({ tone = "note", title, children }: { tone?: DocCalloutTone; title?: string; children: ReactNode }) {
  return (
    <div className="nf-doc-callout" data-tone={tone} role={tone === "warning" ? "note" : undefined}>
      <span className="nf-doc-callout__icon" aria-hidden="true">
        <UiIcon name={CALLOUT_ICON[tone]} size={18} />
      </span>
      <div className="nf-doc-callout__text">
        {title ? <p className="nf-doc-callout__title">{title}</p> : null}
        <div className="nf-doc-callout__body">{children}</div>
      </div>
    </div>
  );
}

/** The inline pointer to a sibling document. */
export function DocCrossLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="nf-doc-xlink">
      {children}
      <UiIcon name="arrow-up-right" size={14} />
    </Link>
  );
}

/** A section of an article: a numbered, anchored heading the contents card points at. */
export function DocSection({ id, number, title, children }: { id: string; number?: number; title: string; children: ReactNode }) {
  return (
    /* The anchor is the whole section, so a shared link lands on it and the
       contents card can tell which section is being read (a heading alone is
       too thin to cross the reading line). */
    <section id={id} className="nf-doc-section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="nf-doc-section__title">
        {typeof number === "number" ? <span className="nf-doc-section__num">{number}.</span> : null}
        {title}
      </h2>
      <div className="nf-doc-section__body">{children}</div>
    </section>
  );
}
