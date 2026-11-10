import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "@/app/css/legal-preface.css";

/**
 * THE PREFACE TO A LEGAL DOCUMENT (founder, November 2026, "high end" legal
 * pages). Three presentation parts that sit ABOVE the legal text and never
 * replace a word of it: a short version card, a collapsible contents, and an
 * at-a-glance block for the tables and flows. The card and the glance say, in
 * their own words, that the sections below are the agreement.
 *
 * Server-safe. The contents is a native `<details>` (no script, keyboard and
 * screen reader friendly); on a wide screen it also sticks under the top.
 */

export type ShortVersionItem = { icon: UiIconName; text: ReactNode };

export function LegalShortVersion({
  title = "The short version",
  items,
  version,
  updated,
}: {
  title?: string;
  items: ShortVersionItem[];
  /** The version string from lib/legal/versions.ts. */
  version: string;
  /** The last-updated line from the same file. */
  updated: string;
}) {
  return (
    <section className="nf-legal-short" aria-labelledby="legal-short-title" data-testid="legal-short-version">
      <div className="nf-legal-short__head">
        <h2 id="legal-short-title" className="nf-legal-short__title">
          {title}
        </h2>
        <p className="nf-legal-short__meta">
          Version {version}. Last updated {updated}.
        </p>
      </div>
      <ul className="nf-legal-short__list">
        {items.map((item, i) => (
          <li key={i} className="nf-legal-short__item">
            <span className="nf-legal-short__icon" aria-hidden="true">
              <UiIcon name={item.icon} size={18} />
            </span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      <p className="nf-legal-short__note">This is a summary to help you read. The full text below is the agreement.</p>
    </section>
  );
}

export function LegalContents({
  sections,
  sticky = true,
}: {
  sections: { id: string; title: string }[];
  sticky?: boolean;
}) {
  return (
    <details className="nf-legal-toc" data-sticky={sticky ? "true" : undefined} data-testid="legal-contents">
      <summary>
        <span>Contents</span>
        <UiIcon name="chevron-down" size={18} />
      </summary>
      <nav aria-label="Contents">
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}

export function LegalGlance({ title = "At a glance", children }: { title?: string; children: ReactNode }) {
  return (
    <section className="nf-legal-glance" aria-labelledby="legal-glance-title">
      <h2 id="legal-glance-title" className="nf-legal-glance__title">
        {title}
      </h2>
      <p className="nf-legal-glance__note">Tables and steps that sum up the sections below. Where they differ, the sections below govern.</p>
      {children}
    </section>
  );
}
