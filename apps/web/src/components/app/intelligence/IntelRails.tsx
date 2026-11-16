"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { countOf, type Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
import { intelHref, type IntelUrlState } from "@/lib/intelligence/client";
import type { DiscoverResponse, IntelligenceResult } from "@/lib/intelligence/contract";
import { recentHref, recentListingsServerSnapshot, recentListingsSnapshot, subscribeRecent, type RecentListing } from "@/lib/search/memory";
import { KIND_ICON } from "./IntelResultItem";
import { dayOf, fill, forYouReasonText, priceOf, type IntelligenceCopy } from "./model";
import "@/components/app/search/search-v2.css";

/**
 * THE EMPTY SCREEN'S RAILS (round 3): continue where you left off, for you,
 * popular on Vallo, trending areas. Every one is real or absent: a section
 * with nothing in it is not drawn, and each card says in one line why it is
 * there. Rails scroll sideways and snap, card by card.
 */

export function plain(event: MouseEvent<HTMLAnchorElement>): boolean {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
}

/** A link that runs a search in place on a plain click, and is still a real address for a new tab. */
export type QueryLink = (q: string) => { href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void };

export function queryLinkFor(url: IntelUrlState, runQuery: (q: string) => void, tab?: IntelUrlState["tab"]): QueryLink {
  return (q) => ({
    href: intelHref({ ...url, ...(tab ? { tab } : {}), q, filters: {}, drop: [] }),
    onClick: (event) => {
      if (!plain(event)) return;
      event.preventDefault();
      runQuery(q);
    },
  });
}

/** One real listing as a compact card, with the line that says why it is here. */
export function RecCard({
  result,
  copy,
  locale,
  reason,
  reasonIcon = "search",
}: {
  result: IntelligenceResult;
  copy: IntelligenceCopy;
  locale: Locale;
  reason?: string | null;
  reasonIcon?: UiIconName;
}) {
  const price = priceOf(result, copy, locale);
  return (
    <li>
      <SpaceCard
        href={result.href}
        title={result.title}
        place={result.place ?? result.subtitle ?? null}
        variant="compact"
        photos={result.imageUrl ? [result.imageUrl] : []}
        photoSizes="17rem"
        fallback={
          <span className="nf-intel-nophoto" aria-hidden="true">
            <UiIcon name={KIND_ICON[result.kind]} size={24} />
          </span>
        }
        price={price ? { amount: <span className="nf-numeric">{price.amount}</span>, unit: price.unit } : null}
        reason={reason ?? result.why ?? null}
        reasonIcon={reasonIcon}
        extra={result.subtitle && result.place && result.subtitle !== result.place ? <p className="nf-sc__sub">{result.subtitle}</p> : null}
      />
    </li>
  );
}

/* ------------------------------------------------ continue where you left off */

/**
 * The member's own trail: their newest search as one card to pick up, the
 * places this device opened (`lib/search/memory.ts`, read here in the browser
 * only, never sent), then the rest of their recent searches, each removable.
 */
export function IntelContinue({
  data,
  signedIn,
  copy,
  locale,
  queryLink,
  onRemoveRecent,
  onClearRecent,
}: {
  data: DiscoverResponse | null;
  signedIn: boolean;
  copy: IntelligenceCopy;
  locale: Locale;
  queryLink: QueryLink;
  onRemoveRecent: (q: string) => void;
  onClearRecent: () => void;
}) {
  const opened = useSyncExternalStore(subscribeRecent, recentListingsSnapshot, recentListingsServerSnapshot);
  const recent = signedIn && data ? data.recent.slice(0, 6) : [];
  const [last, ...rest] = recent;
  if (!last && opened.length === 0) return null;
  const searchedOn = last ? dayOf(last.at, locale) : null;

  return (
    <section className="nf-intel-section" aria-labelledby="intel-continue" data-testid="intel-continue">
      <div className="nf-intel-head">
        <h2 id="intel-continue" className="nf-intel-overline">
          {copy.continue.title}
        </h2>
        {recent.length > 0 ? (
          <button type="button" className="nf-intel-textbtn" aria-label={copy.recent.clearLabel} onClick={onClearRecent} data-testid="intel-recent-clear">
            {copy.recent.clear}
          </button>
        ) : null}
      </div>

      {last ? (
        <div className="nf-intel-recentwrap" data-testid="intel-recent">
          <div className="nf-intel-pickup" data-testid="intel-recent-item">
            <a className="nf-intel-pickup__run" {...queryLink(last.query)} data-testid="intel-pickup">
              <span className="nf-intel-tile" aria-hidden="true">
                <UiIcon name="history" size={20} />
              </span>
              <span className="nf-intel-pickup__text">
                <span className="nf-intel-pickup__over">{copy.continue.lastSearch}</span>
                <span className="nf-intel-pickup__q">{last.query}</span>
                {searchedOn ? <span className="nf-intel-pickup__when">{fill(copy.continue.searchedOn, { date: searchedOn })}</span> : null}
              </span>
              <UiIcon name="arrow-right" size={18} className="nf-intel-pickup__go" />
            </a>
            <button
              type="button"
              className="nf-intel-recent__x nf-tap"
              aria-label={fill(copy.recent.remove, { query: last.query })}
              onClick={() => onRemoveRecent(last.query)}
              data-testid="intel-recent-remove"
            >
              <UiIcon name="close" size={16} />
            </button>
          </div>
          {rest.length > 0 ? (
            <ul className="nf-intel-recent" role="list">
              {rest.map((r) => (
                <li key={r.query} className="nf-intel-recent__item" data-testid="intel-recent-item">
                  <a className="nf-intel-recent__run" {...queryLink(r.query)}>
                    <UiIcon name="search" size={18} />
                    <span className="nf-intel-recent__q">{r.query}</span>
                  </a>
                  <button
                    type="button"
                    className="nf-intel-recent__x nf-tap"
                    aria-label={fill(copy.recent.remove, { query: r.query })}
                    onClick={() => onRemoveRecent(r.query)}
                    data-testid="intel-recent-remove"
                  >
                    <UiIcon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {opened.length > 0 ? (
        <div className="nf-intel-subrail" data-testid="intel-opened">
          <p className="nf-intel-subhead">{copy.continue.openedTitle}</p>
          <ul className="nf-sx-rail nf-intel-rail" role="list">
            {opened.map((entry) => (
              <OpenedCard key={entry.id} entry={entry} copy={copy} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function OpenedCard({ entry, copy }: { entry: RecentListing; copy: IntelligenceCopy }) {
  return (
    <li>
      <SpaceCard
        href={recentHref(entry)}
        title={entry.title}
        place={entry.place || null}
        variant="compact"
        photos={entry.photo ? [entry.photo] : []}
        photoSizes="17rem"
        fallback={
          <span className="nf-intel-nophoto" aria-hidden="true">
            <UiIcon name="house" size={24} />
          </span>
        }
        price={entry.price ? { amount: <span className="nf-numeric">{entry.price}</span>, unit: entry.priceNote ?? null } : null}
        reason={copy.continue.opened}
        reasonIcon="history"
      />
    </li>
  );
}

/* --------------------------------------------------------------- for you */

const RAIL_ICON = { matches: "heart", lastSearch: "search", newSince: "clock" } as const satisfies Record<string, UiIconName>;

export function IntelForYou({ data, copy, locale }: { data: DiscoverResponse | null; copy: IntelligenceCopy; locale: Locale }) {
  const rails = (data?.forYou ?? []).filter((r) => r.items.length > 0);
  if (rails.length === 0) return null;
  return (
    <section className="nf-intel-section" aria-labelledby="intel-foryou" data-testid="intel-foryou">
      <h2 id="intel-foryou" className="nf-intel-overline">
        {copy.forYou.title}
      </h2>
      {rails.map((rail) => (
        <div key={rail.id} className="nf-intel-subrail" data-testid={`intel-foryou-${rail.id}`}>
          <p className="nf-intel-subhead">
            <UiIcon name={RAIL_ICON[rail.id]} size={16} />
            {fill(copy.forYou.rails[rail.id], { query: rail.query ?? "" })}
          </p>
          <ul className="nf-sx-rail nf-intel-rail" role="list">
            {rail.items.map(({ result, reason }) => (
              <RecCard key={result.key} result={result} copy={copy} locale={locale} reason={forYouReasonText(reason, copy, locale)} reasonIcon={RAIL_ICON[rail.id]} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------ popular and trending */

export function IntelPopular({ data, copy, queryLink }: { data: DiscoverResponse | null; copy: IntelligenceCopy; queryLink: QueryLink }) {
  if (!data || data.popular.length === 0) return null;
  return (
    <section className="nf-intel-section" aria-labelledby="intel-popular" data-testid="intel-popular">
      <div>
        <h2 id="intel-popular" className="nf-intel-overline">
          {copy.popular.title}
        </h2>
        <p className="nf-intel-hintline">{copy.popular.hint}</p>
      </div>
      <ul className="nf-intel-chiprow" role="list">
        {data.popular.slice(0, 8).map((p) => (
          <li key={p.query}>
            <a className="nf-chip nf-intel-chip" data-testid="intel-popular-chip" {...queryLink(p.query)}>
              <UiIcon name="trending-up" size={14} className="nf-intel-chip__glyph" />
              <span>{p.query}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IntelTrending({ data, copy, locale, queryLink }: { data: DiscoverResponse | null; copy: IntelligenceCopy; locale: Locale; queryLink: QueryLink }) {
  const areas = data?.trending ?? [];
  if (areas.length === 0) return null;
  return (
    <section className="nf-intel-section" aria-labelledby="intel-trending" data-testid="intel-trending">
      <div>
        <h2 id="intel-trending" className="nf-intel-overline">
          {copy.trending.title}
        </h2>
        <p className="nf-intel-hintline">{copy.trending.hint}</p>
      </div>
      <ol className="nf-intel-trend" role="list">
        {areas.map((a, i) => (
          <li key={`${a.area}|${a.city}`}>
            <a className="nf-intel-trend__item" data-testid="intel-trending-area" {...queryLink(`${a.area}, ${a.city}`)}>
              <span className="nf-intel-trend__rank nf-numeric" aria-hidden="true">
                {i + 1}
              </span>
              <span className="nf-intel-trend__text">
                <span className="nf-intel-trend__name">{a.area}</span>
                <span className="nf-intel-trend__meta">
                  {a.city} · <span className="nf-numeric">{countOf(a.newListings, "newThisMonth", locale)}</span>
                </span>
              </span>
              <UiIcon name="trending-up" size={18} className="nf-intel-trend__go" />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
