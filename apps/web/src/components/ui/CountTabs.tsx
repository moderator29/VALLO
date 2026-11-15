"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { prefersCalm } from "@/lib/ui/calm";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { formatCount, scrollTargetFor } from "./count-tabs-math";
import "./count-tabs.css";

export { formatCount } from "./count-tabs-math";

/**
 * THE COUNT TABS: one sideways-scrolling row of filter tabs, the chosen one
 * filled, the rest quiet, each able to carry a count.
 *
 * Why a part of its own. The inbox, notifications and saved each drew this row
 * by hand from chips, and each got a different thing wrong: a chip that shrank
 * until its count ran under its neighbour, a row that left the chosen tab off
 * the edge, a tablist with no arrow keys. Here the rules are the part's:
 *
 *  - a tab never shrinks (`flex: none`) and is at least 44 px in both axes;
 *  - the row scrolls sideways with no scrollbar, and the chosen tab is brought
 *    into view by scrolling the ROW only, never the page;
 *  - Arrow Left and Right, Home and End move between tabs and choose;
 *  - the count is a number, "9+" past nine, and nothing at zero, with the
 *    whole number in the tab's accessible name.
 *
 * `mode` is the row's meaning. "filter" (the default) narrows a list that is
 * already on the screen: a radiogroup of radios. "tabs" swaps one panel for
 * another: a tablist of tabs, each pointing at `panelId`.
 *
 * Counts are whatever the screen already holds. This part reads nothing.
 */

export type CountTabItem<K extends string = string> = {
  key: K;
  label: string;
  /** Shown as a badge: a number, "9+" past nine, nothing at zero or below. */
  count?: number;
  icon?: UiIconName;
  testId?: string;
};

export type CountTabsProps<K extends string = string> = {
  /** The row's accessible name: what these tabs filter or switch. */
  label: string;
  items: readonly CountTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  mode?: "filter" | "tabs";
  /** Prefix for each tab's id (`${idPrefix}-${key}`), so a panel can name its tab. */
  idPrefix?: string;
  /** In "tabs" mode, the id of the panel the tabs control. */
  panelId?: string;
  /** Words for a count, read after the label: (3) => "3 unread". */
  countLabel?: (count: number) => string;
  /**
   * What a count means. "alert" (the default) is something waiting on the
   * reader, on the platform's count plate. "quiet" is a plain total (how many
   * places a list holds), on a neutral plate, so it never reads as unread.
   */
  countTone?: "alert" | "quiet";
  /** A control after the last tab that scrolls with the row (a "New list" button). */
  trailing?: ReactNode;
  /** Run the row to the screen edges inside a guttered page. */
  bleed?: boolean;
  className?: string;
  testId?: string;
};

export function CountTabs<K extends string = string>({
  label,
  items,
  value,
  onChange,
  mode = "filter",
  idPrefix,
  panelId,
  countLabel,
  countTone = "alert",
  trailing,
  bleed = false,
  className,
  testId,
}: CountTabsProps<K>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const tabs = mode === "tabs";

  /* The chosen tab is brought into view by moving the row, never the page:
     `scrollIntoView` would also scroll the document when the row is below
     the fold. The first paint jumps; a later change glides unless calm. */
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const tab = row.querySelector<HTMLElement>('[data-count-tab][data-selected="true"]');
    const instant = first.current;
    first.current = false;
    if (!tab) return;
    const rowBox = row.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const left = scrollTargetFor({ left: rowBox.left, right: rowBox.right, scrollLeft: row.scrollLeft }, tabBox);
    if (left === null) return;
    if (typeof row.scrollTo === "function") row.scrollTo({ left, behavior: instant || prefersCalm() ? "auto" : "smooth" });
    else row.scrollLeft = left;
  }, [value, items.length]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (!target.hasAttribute("data-count-tab")) return;
    const index = items.findIndex((item) => item.key === value);
    if (items.length === 0) return;
    /* In a right-to-left page the arrows follow the reading direction. */
    const rtl = typeof getComputedStyle === "function" && getComputedStyle(event.currentTarget).direction === "rtl";
    let next = -1;
    if (event.key === "ArrowRight") next = index + (rtl ? -1 : 1);
    else if (event.key === "ArrowLeft") next = index + (rtl ? 1 : -1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    const item = items[(next + items.length) % items.length];
    if (!item) return;
    if (item.key !== value) onChange(item.key);
    const buttons = event.currentTarget.querySelectorAll<HTMLElement>("[data-count-tab]");
    buttons[(next + items.length) % items.length]?.focus();
  }

  const hasValue = items.some((item) => item.key === value);

  return (
    <div className={cn("nf-count-tabs", bleed && "nf-count-tabs--bleed", className)} data-testid={testId}>
      {/* The scroller holds the row of tabs and, after it, the trailing
          control: outside the tablist, whose children may only be tabs. */}
      <div ref={rowRef} className="nf-count-tabs__row">
        <div
          className="nf-count-tabs__list"
          role={tabs ? "tablist" : "radiogroup"}
          aria-label={label}
          aria-orientation={tabs ? "horizontal" : undefined}
          onKeyDown={onKeyDown}
        >
          {items.map((item, index) => {
            const selected = item.key === value;
            const badge = formatCount(item.count);
            /* The badge is a picture of the count ("9+"); the whole number is
               said after the label, in the screen's own words when it gives them. */
            const whole = badge && typeof item.count === "number" ? Math.floor(item.count) : null;
            return (
              <button
                key={item.key}
                type="button"
                id={idPrefix ? `${idPrefix}-${item.key}` : undefined}
                role={tabs ? "tab" : "radio"}
                aria-selected={tabs ? selected : undefined}
                aria-checked={tabs ? undefined : selected}
                aria-controls={tabs ? panelId : undefined}
                /* One stop in the tab order: the chosen tab, or the first when
                   the value names none of them. The arrows reach the rest. */
                tabIndex={selected || (!hasValue && index === 0) ? 0 : -1}
                className="nf-count-tab"
                data-count-tab=""
                data-selected={selected ? "true" : "false"}
                data-testid={item.testId}
                onClick={() => {
                  if (!selected) onChange(item.key);
                }}
              >
                {item.icon ? <UiIcon name={item.icon} size={20} /> : null}
                <span className="nf-count-tab__label">{item.label}</span>
                {badge ? (
                  <span className="nf-count-tab__count" data-tone={countTone} aria-hidden data-count-badge="">
                    {badge}
                  </span>
                ) : null}
                {whole !== null ? <span className="sr-only">{`, ${countLabel ? countLabel(whole) : whole}`}</span> : null}
              </button>
            );
          })}
        </div>
        {trailing ? <span className="nf-count-tabs__trailing">{trailing}</span> : null}
      </div>
    </div>
  );
}
