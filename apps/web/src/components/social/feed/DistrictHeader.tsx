"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { BackChevron } from "@/components/social/profile/BackChevron";

/**
 * The head of a district feed.
 *
 * The place name is the title and it is also the control: a chevron beside it
 * opens the other places somebody is in, because the question "am I looking at
 * the right district" is asked far more often than any other on this screen,
 * and answering it should not cost a trip back to a directory.
 *
 * **There is no filter button beside it, and there was one.** It carried a
 * sliders glyph and the accessible name "Filter what you see", and what it
 * actually did was jump the chip row to Apartments. The chip row sits directly
 * underneath, is always visible, names all five kinds and carries their counts,
 * so the button was a second control for a job already done, doing it worse and
 * describing itself wrongly. Neither of those survives a read.
 *
 * Only places the person is actually in are listed. Offering every open place
 * here would make this a directory wearing a header, and the directory already
 * exists at `/around/settings`, which is where the last row goes.
 */
export function DistrictHeader({
  name,
  city,
  places,
  currentSlug,
  trailing,
}: {
  name: string;
  city: string;
  places: { slug: string; name: string; city: string }[];
  currentSlug: string;
  /** Join, supplied by the page. It belongs in this row rather than floating
      above it, where it was the only thing on a line of its own. */
  trailing?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const others = places.filter((place) => place.slug !== currentSlug);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="nf-district__head">
      {/* The back control lives here rather than in a PageHeader above, because
          two headers on one screen is exactly the jam this page had: the place
          name was printed twice, once as a title and once as the switcher. */}
      <BackChevron fallback="/around" />

      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          className="nf-district__place"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="min-w-0">
            <span className="nf-district__name">{name}</span>
            <span className="nf-district__city">{city}</span>
          </span>
          <UiIcon name="chevron-down" size={18} />
        </button>

        {open ? (
          <>
            <button
              type="button"
              aria-label="Close"
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div ref={menuRef} role="menu" className="nf-post__menu nf-district__menu">
              {others.length === 0 ? (
                <p className="nf-district__only">
                  This is the only place you are in so far.
                </p>
              ) : (
                others.map((place) => (
                  <Link
                    key={place.slug}
                    role="menuitem"
                    href={`/around/${place.slug}`}
                    className="nf-post__menu-item"
                    onClick={() => setOpen(false)}
                  >
                    {place.name}, {place.city}
                  </Link>
                ))
              )}
              {/* Two rows, because there are now two destinations and they are
                  not the same thing: the combined timeline of the places you
                  are in, and the directory of every place there is. This row
                  used to be one link labelled "All places" pointing at the
                  directory, which is what `/around` was. */}
              <Link
                role="menuitem"
                href="/around"
                className="nf-post__menu-item"
                onClick={() => setOpen(false)}
              >
                All your places
              </Link>
              <Link
                role="menuitem"
                href="/around/settings"
                className="nf-post__menu-item"
                onClick={() => setOpen(false)}
              >
                Manage places
              </Link>
            </div>
          </>
        ) : null}
      </div>

      {trailing}
    </div>
  );
}

export type DistrictChip = "all" | "apartments" | "stories" | "reviews" | "updates";

const CHIPS: { key: DistrictChip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "apartments", label: "Apartments" },
  { key: "stories", label: "Stories" },
  { key: "reviews", label: "Reviews" },
  { key: "updates", label: "Updates" },
];

/**
 * The chip row.
 *
 * Five kinds of thing, filtered in the browser over what the page already
 * holds, so moving between them costs nothing at all. A chip whose kind has
 * nothing in it is still shown and still selectable: hiding it would make the
 * row change shape as a place fills up, and an empty answer with a sentence is
 * more useful than a chip that was never there.
 */
/** The id of one chip, so the panel below can point back at the live one. */
export function districtTabId(chip: DistrictChip): string {
  return `nf-district-tab-${chip}`;
}

/** The id of the region the chips filter. One panel; only the live chip names it. */
export function districtPanelId(chip: DistrictChip): string {
  return `nf-district-panel-${chip}`;
}

export function DistrictChips({
  active,
  counts,
  onPick,
}: {
  active: DistrictChip;
  counts: Partial<Record<DistrictChip, number>>;
  onPick: (chip: DistrictChip) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  /*
   * Arrow keys move between tabs and Tab leaves the set, which is the whole
   * point of a tablist and the half this row was missing. It declared
   * `role="tablist"` and `role="tab"` and then behaved like five ordinary
   * buttons: every chip in the tab order, no arrow keys, and nothing named as
   * the region they control - so a screen reader announced "tab 1 of 5" and
   * then had nowhere to send anybody.
   *
   * Lifted from `ProfileTabs`, which is the one tab set in this repo that was
   * already right, so there is one pattern here rather than two.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = CHIPS.findIndex((chip) => chip.key === active);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % CHIPS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + CHIPS.length) % CHIPS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = CHIPS.length - 1;
    else return;

    event.preventDefault();
    const target = CHIPS[next];
    if (!target) return;
    onPick(target.key);
    listRef.current?.querySelector<HTMLButtonElement>(`#${districtTabId(target.key)}`)?.focus();
  };

  return (
    <div
      ref={listRef}
      className="nf-district__chips"
      role="tablist"
      aria-label="What to show"
      onKeyDown={onKeyDown}
    >
      {CHIPS.map((chip) => {
        const selected = chip.key === active;
        return (
          <button
            key={chip.key}
            id={districtTabId(chip.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            /* Only the live chip has a panel to name. See ProfileTabs. */
            aria-controls={selected ? districtPanelId(chip.key) : undefined}
            tabIndex={selected ? 0 : -1}
            /* The shared chip's material (`.nf-chip`, chips.css: 44px, the
               control corner, the glass door's edge and rim) and, when chosen,
               the shared selected state (`.nf-chip--active`). The markup stays
               here rather than on `Chip` because these are tabs: `Chip` speaks
               radio, toggle and link, and a tab needs `role="tab"`,
               `aria-selected`, `aria-controls` and this row's roving focus. */
            className={`nf-chip nf-chip--glass nf-district__chip${selected ? " nf-chip--active" : ""}`}
            onClick={() => onPick(chip.key)}
          >
            {chip.label}
            {counts[chip.key] ? (
              <span className="nf-numeric">{counts[chip.key]}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
