"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { chaptersByGroup, type DocChapterIndexEntry } from "./docs-groups";

/**
 * The chapter rail.
 *
 * It lives in the docs layout rather than on a page, so it survives navigation
 * between chapters and the reader keeps their place in the list instead of
 * watching a sidebar rebuild itself on every chapter.
 *
 * ONE list of links, drawn two ways.
 *
 * From `lg` up it is an ordinary sticky column and the opener is not rendered.
 * Below that a phone has no room for a permanent 248px rail, so the same list
 * collapses behind a control that says where you currently are, which is the
 * only thing worth spending a line of a 390px screen on. It is a real button
 * with real state rather than a `<details>` element, because the browsers
 * involved disagree about whether CSS may keep details content visible, and a
 * navigation that vanishes on one engine is not a navigation.
 *
 * Choosing a chapter closes it: the pathname changing is the signal, so it
 * closes on a back gesture too, not only on a tap.
 */
export function DocsSidebar({ items }: { items: DocChapterIndexEntry[] }) {
  const pathname = usePathname();
  /* Open for the path it was opened on: choosing a chapter (or a back
     gesture) changes the path, which closes it with no effect to do so. */
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const panelId = useId();

  const current = items.find((item) => pathname === `/docs/${item.slug}`);
  const onContents = pathname === "/docs";

  const label = current ? `${current.number}. ${current.title}` : "Contents";

  return (
    <div className="lg:sticky lg:top-24 lg:w-[248px] lg:shrink-0 lg:self-start">
      {/*
        The phone opener, which the contents page itself does not get: that
        page IS the list of chapters, so a control that unfolds the same
        titles above it is one tap to see what is already on screen.
      */}
      {!onContents && (
        <button
          type="button"
          onClick={() => setOpenAt(open ? null : pathname)}
          aria-expanded={open}
          aria-controls={panelId}
          className="nf-tap flex min-h-11 w-full items-center justify-between gap-row rounded-[var(--nf-radius-control)] border border-[var(--nf-btn-glass-edge)] bg-[image:var(--nf-btn-glass-fill)] shadow-[var(--nf-rim-lit)] px-group py-inline text-left lg:hidden"
        >
          <span className="flex min-w-0 items-center gap-inline">
            <UiIcon
              name="panel-left"
              size={16}
              className="shrink-0 text-[var(--nf-content-muted)]"
            />
            <span className="min-w-0 text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
              {label}
            </span>
          </span>
          <UiIcon
            name="chevron-down"
            size={16}
            className={`shrink-0 text-[var(--nf-content-muted)] transition-transform duration-[var(--nf-duration-base)] ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      )}

      {/* ---------------------------------------------------- the list */}
      <nav
        id={panelId}
        aria-label="Documentation chapters"
        className={`${open ? "mt-inline block" : "hidden"} lg:mt-0 lg:block`}
      >
        <p className="nf-overline hidden px-row pb-inline text-[var(--nf-content-muted)] lg:block">
          Documentation
        </p>
        <div className="rounded-[var(--nf-container-radius)] border border-[var(--nf-panel-edge)] bg-[image:var(--nf-panel-fill-card)] p-inline lg:border-0 lg:bg-none lg:bg-transparent lg:p-0">
          <ChapterLink href="/docs" active={onContents} number={null} title="All chapters" />
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
      className={`nf-tap flex min-h-11 items-center gap-inline rounded-[var(--nf-radius-sm)] border-l-2 py-inline pr-inline pl-inline text-[length:var(--nf-text-caption)] leading-snug transition-colors ${
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
