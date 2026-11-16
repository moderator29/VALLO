"use client";

import type { Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import type { CategoryFacts } from "@/lib/intelligence/contract";
import { EXPLORE_TABS, tileLine, type ExploreTab, type IntelligenceCopy } from "./model";

/** Each side of Vallo's glyph, from the UI family. */
export const TILE_ICON: Record<ExploreTab, UiIconName> = {
  property: "house",
  stay: "bed",
  restaurant: "utensils",
  roommate: "house-heart",
  person: "circle-people",
};

/** The facts for a tile, when the engine sent them. */
export function factsFor(categories: readonly CategoryFacts[] | undefined, tab: ExploreTab): CategoryFacts | undefined {
  return categories?.find((c) => c.tab === tab);
}

/**
 * EXPLORE VALLO: THE GRID UNDER THE FIELD (round 3, the founder's reference).
 *
 * Four tiles two by two (Properties, Stays, Restaurants, Roommates) and one
 * wide tile under them for People and Circle. Each is the brand's glass: the
 * glyph on a soft brand tile, a bold title, one line under it, and a third
 * line only when the engine counted something real ("3 new this week"). A
 * tile opens its category's own page in place (`onChoose`), lent the shared
 * element name so the tile grows into that page's header.
 */
export function IntelExplore({
  copy,
  locale,
  categories,
  onChoose,
}: {
  copy: IntelligenceCopy;
  locale: Locale;
  categories?: readonly CategoryFacts[];
  onChoose: (tab: ExploreTab, tile: HTMLElement) => void;
}) {
  return (
    <section className="nf-intel-section nf-intel-explore" aria-labelledby="intel-explore" data-testid="intel-explore">
      <h2 id="intel-explore" className="nf-intel-overline">
        {copy.explore.title}
      </h2>
      <ul className="nf-intel-tiles" role="list">
        {EXPLORE_TABS.map((tab, i) => {
          const tile = copy.explore.tiles[tab];
          const line = tileLine(factsFor(categories, tab), locale);
          return (
            <li key={tab} data-wide={tab === "person" ? "true" : undefined} style={{ ["--nf-intel-i" as string]: i }}>
              <button
                type="button"
                className="nf-intel-tilecard"
                data-intel-tile={tab}
                data-testid={`intel-cat-${tab}`}
                onClick={(event) => onChoose(tab, event.currentTarget)}
              >
                <span className="nf-intel-tilecard__icon" aria-hidden="true">
                  <UiIcon name={TILE_ICON[tab]} size={22} />
                </span>
                <span className="nf-intel-tilecard__text">
                  <span className="nf-intel-tilecard__title">{tile.title}</span>
                  <span className="nf-intel-tilecard__sub">{tile.sub}</span>
                  {line ? (
                    <span className="nf-intel-tilecard__line nf-numeric" data-testid="intel-tile-line">
                      {line}
                    </span>
                  ) : null}
                </span>
                <UiIcon name="chevron-right" size={18} className="nf-intel-tilecard__go" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
