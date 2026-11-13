import Link from "next/link";
import { formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { SORTS } from "@/lib/listings/search-params";
import { ViewToggle } from "@/components/app/filters/ViewToggle";
import { ShelfChipRow, type SheetChip } from "./ShelfChipRow";
import { quickChips } from "./quick-chips";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { FilterDrawer } from "@/components/app/filters/FilterDrawer";
import type { ListingFacts } from "@/lib/listings/filter";
import type { Anchor } from "@/lib/listings/commute";
import { kindLabel } from "@/lib/listings/search-params";
import { ICON } from "@/components/app/Screen";
import { RecentSearches } from "./RecentSearches";
import { PillLanding, PillOrigin } from "./SearchPillMorph";
import {
  MARKET_PARAM,
  shelfActiveCount,
  toShelfFiltersHref,
  toShelfHref,
  toShelfViewHref,
  type ShelfQuery,
} from "./shelf-query";
import "@/app/css/catalogue.css";
import "./search-v2.css";

/**
 * The top of the results shelf, to 3EB3E2A9: the glass field with its
 * filter square, then the capsule row that reads the real filter state
 * back. Every capsule opens the sheet, because the sheet is where each of
 * them is changed; the words on them are the address bar's, so a shared link
 * shows the same chips.
 */
function carriedParams(query: ShelfQuery): [string, string][] {
  const href = toShelfHref(query);
  const index = href.indexOf("?");
  if (index === -1) return [];
  return [...new URLSearchParams(href.slice(index + 1))].filter(([key]) => key !== "q");
}

export function ShelfBar({
  query,
  facts,
  locale,
  t,
  openFilters = false,
  leading,
  anchors = [],
}: {
  query: ShelfQuery;
  facts: ListingFacts[];
  locale: Locale;
  t: Dictionary;
  openFilters?: boolean;
  /**
   * A control placed before the search field, on the bar's own row.
   *
   * `/search` puts the platform's back control here and it is the only caller
   * that does. The route declares `/home` above it in
   * `lib/nav/route-parents.ts` and drew nothing, and nothing could be drawn
   * ABOVE this component either: the bar is `position: sticky; top: 0` and
   * cancels the shell's top padding with a negative margin, so anything
   * inserted before it stops being flush with the header and starts scrolling
   * under it. The row is therefore where the control belongs, which is also
   * where a phone's search screen puts it.
   *
   * A slot rather than a fixed control, so the preview deck that mounts this
   * bar with fixtures is not given a back arrow it did not ask for.
   */
  leading?: React.ReactNode;
  /** V-43: the anchors a renter can pick; none means the group is not drawn. */
  anchors?: Anchor[];
}) {
  const copy = t.catalogue.shelf;
  const sheetHref = toShelfFiltersHref(query);

  /* UX-07: the chip names the market it is filtering by; it read "Any market"
     on a Rent search while the count said one filter was on. */
  const marketLabel =
    query.intent === "sale"
      ? copy.marketBuy
      : query.kind
        ? kindLabel(query.kind, t.experienceLabels.kinds)
        : query.intent === "rent"
          ? copy.marketRent
          : copy.anyMarket;
  const bedsLabel =
    query.bedrooms !== undefined ? copy.beds.replace("{count}", String(query.bedrooms)) : copy.bedsAny;
  const priceLabel =
    query.minMinor !== undefined && query.maxMinor !== undefined
      ? `${formatMoney(query.minMinor, locale)} to ${formatMoney(query.maxMinor, locale)}`
      : query.minMinor !== undefined
        ? `${formatMoney(query.minMinor, locale)}+`
        : query.maxMinor !== undefined
          ? `${copy.price} to ${formatMoney(query.maxMinor, locale)}`
          : copy.price;
  const shown =
    (query.intent || query.kind ? 1 : 0) +
    (query.bedrooms !== undefined ? 1 : 0) +
    (query.minMinor !== undefined || query.maxMinor !== undefined ? 1 : 0);
  const more = Math.max(0, shelfActiveCount(query) + (query.kind ? 1 : 0) - shown);

  const chips: SheetChip[] = [
    { key: "market", label: marketLabel, icon: "home", on: Boolean(query.intent || query.kind), href: sheetHref },
    { key: "beds", label: bedsLabel, icon: "bed", on: query.bedrooms !== undefined, href: sheetHref },
    {
      key: "price",
      label: priceLabel,
      icon: "wallet",
      on: query.minMinor !== undefined || query.maxMinor !== undefined,
      href: sheetHref,
    },
    { key: "more", label: more > 0 ? `${copy.more} (${more})` : copy.more, icon: "sliders", on: more > 0, href: sheetHref },
  ];
  const sv = t.searchV2;
  const currentSort = SORTS.find((sort) => sort.key === query.sort) ?? SORTS[0]!;
  const viewHrefs = {
    list: toShelfViewHref(query, "list"),
    rows: toShelfViewHref(query, "rows"),
    map: toShelfViewHref(query, "map"),
  };

  return (
    <div className="nf-shelf-bar nf-glass--chrome">
      <div className="mx-auto flex max-w-3xl items-center gap-inline">
        {leading}
        {/* The reference's search box: the field, the filters and the order in
            one well, so the words get the width a phone has. */}
        <div className="nf-shelf-box">
        {/* The results header's field lands from the pill that sent the
            search (`SearchPillMorph.tsx`); it is the same GET form either way. */}
        <PillLanding path="/search" action="/search" method="get" role="search" className="nf-shelf-field">
          <UiIcon name="search" size={ICON.inline} />
          <label htmlFor="shelf-q" className="sr-only">
            {copy.search}
          </label>
          <input
            id="shelf-q"
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            defaultValue={query.q ?? ""}
            placeholder={sv.placeholder}
            className="nf-shelf-field__input"
          />
          {/* Typing a new search must not silently drop the filters set. */}
          {carriedParams(query).map(([key, value]) => (
            <input key={key} type="hidden" name={key === MARKET_PARAM ? MARKET_PARAM : key} value={value} />
          ))}
          <button type="submit" aria-label={copy.search} className="nf-shelf-field__go">
            <UiIcon name="arrow-right" size={ICON.inline} />
          </button>
          <PillOrigin path="/search" />
        </PillLanding>
        <FilterDrawer
          query={query}
          facts={facts}
          locale={locale}
          copy={t.catalogue.filters}
          costCopy={t.moveIn}
          compoundCopy={t.shape.compound}
          sortCopy={t.shape.sorts}
          serviceCopy={t.shape.service}
          cashCopy={t.shape.cash}
          unitCopy={t.shape.unit}
          anchors={anchors}
          commuteCopy={t.shape.commute}
          kindCopy={t.experienceLabels}
          noFloodLabel={{ label: t.shape.neighbours.filterNoFlood, hint: t.shape.neighbours.filterNoFloodHint }}
          feesBasis={t.trustVisible.fees.sortBasis}
          searchCopy={sv.filters}
          openOnMount={openFilters}
        />
        {/* THE ORDER, BESIDE THE FILTERS, as the founder's reference draws
            the search bar. A native disclosure, so an ordering stays a link
            a back button can walk and no script has to open it; the phone's
            view switch is the last item of its menu, as it was. */}
        <details className="nf-shelf-sort nf-shelf-sort--square shrink-0" data-testid="sort-control">
          <summary
            aria-label={sv.sortCurrent.replace("{sort}", t.shape.sorts[currentSort.key])}
            className="nf-shelf-square"
          >
            <UiIcon name="sort" size={ICON.inline} />
          </summary>
          <ul className="nf-shelf-sort__menu" aria-label={copy.sort}>
            {SORTS.map((sort) => {
              const active = sort.key === query.sort;
              return (
                <li key={sort.key}>
                  <Link
                    href={toShelfHref({ ...query, sort: sort.key })}
                    prefetch
                    aria-current={active ? "true" : undefined}
                    className="nf-shelf-sort__item"
                  >
                    {t.shape.sorts[sort.key]}
                    {active && <UiIcon name="check" size={16} />}
                  </Link>
                </li>
              );
            })}
            <li className="mt-2xs border-t border-[var(--nf-panel-hair)] pt-2xs">
              <ViewToggle current={query.view} hrefs={viewHrefs} className="nf-viewtoggle--menu" />
            </li>
          </ul>
        </details>
        </div>
      </div>
      {/* B2: the phone's recent hunts, offered when the field is empty. */}
      <RecentSearches
        inputId="shelf-q"
        path="/search"
        copy={{ title: t.catalogue.recent.title, clear: t.catalogue.recent.clear, clearLabel: t.catalogue.recent.clearLabel }}
        palette={t.experienceDiscover.palette}
        className="mx-auto max-w-3xl"
      />

      <ShelfChipRow
        label={copy.filters}
        query={query}
        quick={quickChips(query)}
        quickCopy={sv.quick}
        chips={chips}
      />
    </div>
  );
}
