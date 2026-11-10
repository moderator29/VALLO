"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { chaptersByGroup, type DocChapterIndexEntry } from "./docs-groups";

/**
 * The chapter rail.
 *
 * It lives in the docs layout rather than on a page, so it survives navigation
 * between chapters and the reader keeps their place in the list instead of
 * watching a sidebar rebuild itself on every chapter.
 *
 * From `lg` up it is a sticky column beside the chapter. It was also drawn,
 * below `lg`, as a folded list behind a button; that copy was retired when
 * the chapter page gained the kit's contents card.
 */
export function DocsSidebar({ items }: { items: DocChapterIndexEntry[] }) {
  const pathname = usePathname();
  const panelId = useId();
  /*
   * ON THE KIT (DOCS_AND_PRESENCE_UPGRADE.md 4.1, 9 November 2026): the rail
   * is the wide screen's chapter list and nothing else. A phone no longer
   * gets a folded copy of it above the chapter's own contents card (two
   * contents lists, one on top of the other); it moves between chapters by
   * the shell's "Documentation" link and the previous and next cards. The
   * contents page draws nothing here: that page IS the list of chapters.
   */
  if (pathname === "/docs") return null;

  return (
    <div className="hidden lg:sticky lg:top-24 lg:block lg:w-[248px] lg:shrink-0 lg:self-start">
      <nav id={panelId} aria-label="Documentation chapters">
        <p className="nf-overline px-row pb-inline text-[var(--nf-content-muted)]">Documentation</p>
        <div>
          <ChapterLink href="/docs" active={false} number={null} title="All chapters" />
          {/* The chapters in their groups (the docs track, 13 October 2026):
              each group's name labels the list under it, so a screen
              reader hears "Money, list, 3 items" and not a flat run of
              every title. */}
          {chaptersByGroup(items).map((group) => (
            <div key={group.id} className="mt-group">
              <p
                id={`${panelId}-${group.id}`}
                className="nf-overline px-inline pb-inline-tight text-[var(--nf-content-muted)]"
              >
                {group.label}
              </p>
              <ol aria-labelledby={`${panelId}-${group.id}`} className="space-y-inline-tight">
                {group.items.map((item) => (
                  <li key={item.slug}>
                    <ChapterLink
                      href={`/docs/${item.slug}`}
                      active={pathname === `/docs/${item.slug}`}
                      number={item.number}
                      title={item.title}
                    />
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}

/**
 * One row.
 *
 * The active row is marked three ways and not one: an electric left rail, the
 * platform's shared selected state (the `--nf-selected-*` gradient, rim and
 * bloom, as the console's open rail row draws it; it was a flat 14 per cent
 * brand tint until the second audit's S-F), and `aria-current`, so it reads for somebody looking at it,
 * somebody listening to it, and somebody who cannot separate the two blues.
 * The whole row is the target and it is 44px tall, not a 14px word.
 */
function ChapterLink({
  href,
  active,
  number,
  title,
}: {
  href: string;
  active: boolean;
  number: number | null;
  title: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`nf-tap flex min-h-11 items-center gap-inline rounded-sm border-l-2 py-inline pr-inline pl-inline text-[length:var(--nf-text-caption)] leading-snug transition-colors ${
        active
          ? "border-l-[var(--nf-selected-edge)] bg-[image:var(--nf-selected-fill)] shadow-[var(--nf-selected-shadow-inline)] font-semibold text-[var(--nf-content-on-brand)]"
          : "border-l-transparent text-[var(--nf-content-secondary)] hover:bg-[var(--nf-glass-fill-thin)] hover:text-[var(--nf-content-primary)]"
      }`}
    >
      {number !== null && (
        <span
          aria-hidden="true"
          className={`nf-numeric w-4 shrink-0 text-right text-[length:var(--nf-text-overline)] ${
            active ? "text-[var(--nf-content-on-brand)]" : "text-[var(--nf-content-muted)]"
          }`}
        >
          {number}
        </span>
      )}
      <span className="min-w-0">{title}</span>
    </Link>
  );
}
