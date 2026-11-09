"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * The chapter's contents rail.
 *
 * On a phone it is a disclosure under the chapter heading; from `xl` it is a
 * sticky rail on the right. TRACK M ADDS WHERE YOU ARE: an observer on a thin
 * band near the top of the viewport notices which section you are reading,
 * that heading lights, and a marker slides down the rail's hairline to it in
 * 240ms (transform only, docs-motion.css). The marker is written straight to
 * the element, so scrolling never re-renders the list. Reduced motion, Calm
 * and Off get the marker without the slide.
 *
 * QUIET (Session 3, stage 9): muted ink until a heading is the one being
 * read, and the lit heading changes colour only, never weight, so a heading
 * that wraps in the narrow rail never reflows as you scroll.
 */
export function OnThisPage({ sections }: { sections: { id: string; heading: string }[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const panelId = useId();
  const list = useRef<HTMLUListElement | null>(null);
  const marker = useRef<HTMLSpanElement | null>(null);

  /* Which section is being read: the last one whose top has passed a line a
     quarter of the way down the screen. */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { threshold: 0, rootMargin: "-20% 0px -70% 0px" },
    );
    for (const target of targets) io.observe(target);
    return () => io.disconnect();
  }, [sections]);

  /* The marker follows the lit heading. */
  useEffect(() => {
    const ul = list.current;
    const bar = marker.current;
    /* Measured in the wrapper, the links' offset parent. */
    if (!ul || !bar) return;
    const link = active ? ul.querySelector<HTMLElement>(`a[href="#${CSS.escape(active)}"]`) : null;
    if (!link) {
      bar.dataset.on = "false";
      return;
    }
    const top = link.offsetTop;
    const height = link.offsetHeight;
    bar.style.transform = `translateY(${top}px) scaleY(${height})`;
    bar.dataset.on = "true";
  }, [active]);

  if (sections.length < 2) return null;

  return (
    <nav
      aria-label="On this page"
      className="nf-doc-rail min-w-0 xl:sticky xl:top-24 xl:w-[196px] xl:shrink-0 xl:self-start"
    >
      {/* --------------------------------------------------- phone opener */}
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={panelId}
        className="nf-tap flex min-h-11 w-full items-center justify-between gap-row rounded-control border border-[var(--nf-btn-glass-edge)] bg-[image:var(--nf-btn-glass-fill)] shadow-[var(--nf-rim-lit)] px-group py-inline text-left xl:hidden"
      >
        <span className="flex items-center gap-inline">
          <UiIcon name="document" size={16} className="text-[var(--nf-content-muted)]" />
          <span className="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">
            On this page
          </span>
          <span className="nf-numeric text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {sections.length}
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

      {/* ---------------------------------------------------- the headings */}
      <div id={panelId} className={`${open ? "mt-inline block" : "hidden"} xl:mt-0 xl:block`}>
        <p className="nf-overline hidden items-center gap-inline text-[var(--nf-content-muted)] xl:flex">
          <UiIcon name="document" size={16} />
          On this page
        </p>
        {/* The marker is a sibling of the list, not a child: a list may only
            hold items. The wrapper is the offset parent both are measured in. */}
        <div className="nf-doc-rail__wrap mt-inline">
          <span ref={marker} className="nf-doc-rail__marker" aria-hidden="true" data-on="false" />
          <ul ref={list} className="nf-doc-rail__list space-y-inline-tight border-l border-[var(--nf-border-subtle)]">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={() => setOpen(false)}
                aria-current={active === section.id ? "location" : undefined}
                className="nf-doc-rail__link nf-tap -ml-px flex min-h-11 items-center border-l-2 border-transparent py-inline pl-row text-[length:var(--nf-text-caption)] leading-snug text-[var(--nf-content-muted)] transition-colors hover:text-[var(--nf-content-primary)]"
              >
                {section.heading}
              </a>
            </li>
          ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
