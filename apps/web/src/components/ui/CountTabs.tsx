"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { feedback } from "@/lib/ui/feedback";
import { motionQuiet } from "@/lib/motion/gate";
import "./count-tabs.css";

/**
 * The count tab row (the founder, 14 November 2026, after Snapchat's chat
 * filters). One scrolling row of filter tabs, the chosen one filled, each tab
 * able to carry a count: a number up to the cap, then "9+", and nothing at
 * zero, because an empty badge is noise.
 *
 * THREE MEANINGS, ONE LOOK, because the same row does three different jobs on
 * the platform and the wrong role is worse than none (the lesson Segmented.tsx
 * already records):
 *
 *   filters  (default) a radiogroup filtering the list below in place. The
 *            inbox's views and the notifications families.
 *   tabs     a real tablist swapping panels, with `itemIdPrefix` and
 *            `panelIdPrefix` wiring `aria-controls` as Segmented does.
 *   links    every tab is a real address (back, share and a reload keep the
 *            tab), marked with `aria-current="page"`. Saved's kinds.
 *
 * Counts come from data the screen already holds. This component fetches
 * nothing and must never be fed by a new poll (handoff section 6.3).
 *
 * The chosen tab scrolls itself into view, sideways only: `scrollIntoView`
 * also scrolls ancestors vertically, which yanked pages whose row sat below
 * the fold, so the row's own `scrollTo` is used instead. Under reduced motion
 * and the calm setting it jumps.
 */

export type CountTab = {
  key: string;
  label: string;
  /** The badge. Hidden at zero or when absent; past `countCap` it says "9+". */
  count?: number;
  /** `links` semantics only: where this tab goes. */
  href?: string;
  "data-testid"?: string;
};

const COUNT_CAP = 9;

/** Exported for the DOM test: the badge's words, capped. */
export function countWords(count: number, cap: number = COUNT_CAP): string {
  return count > cap ? `${cap}+` : `${count}`;
}

export function CountTabs({
  items,
  active,
  onChange,
  semantics = "filters",
  label,
  countCap = COUNT_CAP,
  fade = true,
  bleed = false,
  className,
  itemIdPrefix,
  panelIdPrefix,
  "data-testid": testId,
}: {
  items: readonly CountTab[];
  /** The chosen tab's key. */
  active: string;
  /** Required for `filters` and `tabs`; ignored for `links`. */
  onChange?: (next: string) => void;
  semantics?: "filters" | "tabs" | "links";
  /** The row's accessible name. Required: an unlabelled group is a puzzle. */
  label: string;
  countCap?: number;
  /** The trailing fade, so a cut tab reads as more. */
  fade?: boolean;
  /** Bleed to the screen edge and pad back to the gutter (`--nf-chiprow-bleed`). */
  bleed?: boolean;
  className?: string;
  /** `tabs` semantics: each tab gets `${itemIdPrefix}-${key}`. */
  itemIdPrefix?: string;
  /** `tabs` semantics: each tab controls `${panelIdPrefix}-${key}`. */
  panelIdPrefix?: string;
  "data-testid"?: string;
}) {
  const rowRef = useRef<HTMLElement | null>(null);

  /* The chosen tab keeps itself in view, horizontally only. */
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const el = row.querySelector<HTMLElement>(`[data-counttab="${CSS.escape(active)}"]`);
    if (!el) return;
    const pad = 24;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    let target: number | null = null;
    if (left < row.scrollLeft + pad) target = left - pad;
    else if (right > row.scrollLeft + row.clientWidth - pad) target = right - row.clientWidth + pad;
    if (target !== null) row.scrollTo({ left: Math.max(0, target), behavior: motionQuiet() ? "auto" : "smooth" });
  }, [active]);

  const index = Math.max(
    0,
    items.findIndex((item) => item.key === active),
  );

  /* Arrow keys move between tabs, and selection follows focus (the radio and
     tab patterns both say so; ChipRow and Segmented already behave this way). */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (semantics === "links") return;
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = items[(index + delta + items.length) % items.length]!;
    onChange?.(next.key);
    rowRef.current
      ?.querySelector<HTMLElement>(`[data-counttab="${CSS.escape(next.key)}"]`)
      ?.focus();
  };

  const rowClass = [
    "nf-counttabs nf-scroll-x",
    fade ? "nf-counttabs--fade" : "",
    bleed ? "nf-counttabs--bleed" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const badge = (item: CountTab) =>
    typeof item.count === "number" && item.count > 0 ? (
      <span className="nf-counttabs__count">{countWords(item.count, countCap)}</span>
    ) : null;

  if (semantics === "links") {
    return (
      <nav
        ref={(el) => {
          rowRef.current = el;
        }}
        aria-label={label}
        className={rowClass}
        data-testid={testId}
      >
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href ?? "#"}
            data-counttab={item.key}
            className="nf-counttabs__tab"
            aria-current={item.key === active ? "page" : undefined}
            data-testid={item["data-testid"]}
            scroll={false}
          >
            {item.label}
            {badge(item)}
          </Link>
        ))}
      </nav>
    );
  }

  const tabs = semantics === "tabs";
  return (
    <div
      ref={(el) => {
        rowRef.current = el;
      }}
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={rowClass}
      data-testid={testId}
    >
      {items.map((item, i) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            data-counttab={item.key}
            role={tabs ? "tab" : "radio"}
            id={tabs && itemIdPrefix ? `${itemIdPrefix}-${item.key}` : undefined}
            aria-controls={tabs && panelIdPrefix ? `${panelIdPrefix}-${item.key}` : undefined}
            aria-selected={tabs ? selected : undefined}
            aria-checked={tabs ? undefined : selected}
            /* Roving tabindex: the group is one stop and the arrows move
               within it. When nothing matches `active` the first tab keeps a
               stop, so the row is never unreachable by keyboard. */
            tabIndex={selected || (index === i && !items.some((x) => x.key === active)) ? 0 : -1}
            className="nf-counttabs__tab"
            data-testid={item["data-testid"]}
            onClick={() => {
              /* A choice taken is felt once, and only when it changes something. */
              if (!selected) feedback("select");
              onChange?.(item.key);
            }}
          >
            {item.label}
            {badge(item)}
          </button>
        );
      })}
    </div>
  );
}
