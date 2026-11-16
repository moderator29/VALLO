"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import type { Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
import { PersonRowItem } from "@/components/social/find/PersonCards";
import { intelHref, type IntelUrlState } from "@/lib/intelligence/client";
import type { DiscoverResponse, IntelligenceResult } from "@/lib/intelligence/contract";
import { KIND_ICON } from "./IntelResultItem";
import { CitySkyline } from "./IntelArt";
import { fill, personCardOf, postcardCities, priceOf, type IntelligenceCopy } from "./model";
import "@/components/app/search/search-v2.css";

export type DiscoverView = { status: "loading" } | { status: "ready"; data: DiscoverResponse } | { status: "unavailable" };

type SuggestedRow = { id: string; icon: UiIconName; title: string; sub: string } & ({ href: string } | { query: string });

/** Real destinations, in the order a person usually wants them. Nothing here is a number. */
function suggestedRows(copy: IntelligenceCopy): SuggestedRow[] {
  const r = copy.suggested.rows;
  return [
    { id: "rent", icon: "house", title: r.rent.title, sub: r.rent.sub, href: "/search?market=rent" },
    { id: "weekend", icon: "bed", title: r.weekend.title, sub: r.weekend.sub, query: copy.suggested.weekendQuery },
    { id: "roommate", icon: "house-duplex", title: r.roommate.title, sub: r.roommate.sub, href: "/roommates" },
    { id: "restaurants", icon: "utensils", title: r.restaurants.title, sub: r.restaurants.sub, href: "/restaurants" },
    { id: "circle", icon: "circle-people", title: r.circle.title, sub: r.circle.sub, href: "/circle" },
    { id: "people", icon: "users", title: r.people.title, sub: r.people.sub, href: "/around/people" },
  ];
}

/**
 * MOODS: a feeling, as a search the engine reads into real filters (wifi and
 * a workspace, three bedrooms, this weekend's stays, a pool, a generator).
 * `model.test.ts` holds every one to the filters it must produce, so a mood
 * that stopped meaning a real filter fails there, not on a member's screen.
 */
const MOODS: { id: keyof IntelligenceCopy["moods"]["items"]; icon: UiIconName }[] = [
  { id: "work", icon: "wifi" },
  { id: "family", icon: "users" },
  { id: "weekend", icon: "bed" },
  { id: "pool", icon: "pool" },
  { id: "power", icon: "bolt" },
];

/** How many suggested rows show before "Explore all". */
const SUGGESTED_FIRST = 3;

function plain(event: MouseEvent<HTMLAnchorElement>): boolean {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
}

/**
 * THE EMPTY SCREEN, EDITORIAL AND SPARE: recent searches (a member's own,
 * each removable), what to explore, a few searches to try, popular searches
 * only when there are real ones, the newest listings, and people to follow.
 * A list that is empty is simply not drawn; nothing is padded out.
 */
export function IntelDiscover({
  view,
  copy,
  locale,
  signedIn,
  url,
  runQuery,
  onRemoveRecent,
  onClearRecent,
}: {
  view: DiscoverView;
  copy: IntelligenceCopy;
  locale: Locale;
  signedIn: boolean;
  url: IntelUrlState;
  runQuery: (q: string) => void;
  onRemoveRecent: (q: string) => void;
  onClearRecent: () => void;
}) {
  const [explore, setExplore] = useState(false);
  const data = view.status === "ready" ? view.data : null;
  const rows = suggestedRows(copy);
  const shownRows = explore ? rows : rows.slice(0, SUGGESTED_FIRST);
  /* Only the engine's own examples, known to return results today; the moods
     above carry the fixed starting points. */
  const examples = data ? data.examples.slice(0, 4) : [];
  const cities = data ? postcardCities(data.fresh) : [];
  const queryLink = (q: string) => ({
    href: intelHref({ ...url, q, filters: {}, drop: [] }),
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (!plain(event)) return;
      event.preventDefault();
      runQuery(q);
    },
  });

  return (
    <div className="nf-intel-discover" data-testid="intel-discover">
      {/* ------------------------------------------------ recent searches */}
      {signedIn && data && data.recent.length > 0 ? (
        <section className="nf-intel-section" aria-labelledby="intel-recent" data-testid="intel-recent">
          <div className="nf-intel-head">
            <h2 id="intel-recent" className="nf-intel-overline">
              {copy.recent.title}
            </h2>
            <button type="button" className="nf-intel-textbtn" aria-label={copy.recent.clearLabel} onClick={onClearRecent} data-testid="intel-recent-clear">
              {copy.recent.clear}
            </button>
          </div>
          <ul className="nf-intel-recent" role="list">
            {data.recent.slice(0, 6).map((r) => (
              <li key={r.query} className="nf-intel-recent__item" data-testid="intel-recent-item">
                <a className="nf-intel-recent__run" {...queryLink(r.query)}>
                  <UiIcon name="history" size={18} />
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
        </section>
      ) : null}

      {/* ------------------------------------------------------------ moods */}
      <section className="nf-intel-section" aria-labelledby="intel-moods" data-testid="intel-moods">
        <h2 id="intel-moods" className="nf-intel-overline">
          {copy.moods.title}
        </h2>
        <ul className="nf-intel-moods" role="list">
          {MOODS.map((mood) => {
            const m = copy.moods.items[mood.id];
            return (
              <li key={mood.id}>
                <a className="nf-intel-mood" data-testid={`intel-mood-${mood.id}`} {...queryLink(m.query)}>
                  <span className="nf-intel-mood__icon" aria-hidden="true">
                    <UiIcon name={mood.icon} size={18} />
                  </span>
                  <span className="nf-intel-mood__label">{m.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------- where the new places are */}
      {cities.length > 0 ? (
        <section className="nf-intel-section" aria-labelledby="intel-cities" data-testid="intel-cities">
          <h2 id="intel-cities" className="nf-intel-overline">
            {copy.cities.title}
          </h2>
          <ul className="nf-intel-postcards" role="list" data-count={cities.length}>
            {cities.map((city) => (
              <li key={city}>
                <a className="nf-intel-postcard" aria-label={fill(copy.cities.open, { city })} data-testid="intel-postcard" data-city={city} {...queryLink(city)}>
                  <CitySkyline city={city} />
                  <span className="nf-intel-postcard__foot">
                    <span className="nf-intel-postcard__name">{city}</span>
                    <span className="nf-intel-postcard__go">
                      {copy.cities.explore}
                      <UiIcon name="arrow-right" size={14} />
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------ suggested for you */}
      <section className="nf-intel-section" aria-labelledby="intel-suggested" data-testid="intel-suggested">
        <div className="nf-intel-head">
          <h2 id="intel-suggested" className="nf-intel-overline">
            {copy.suggested.title}
          </h2>
          <button type="button" className="nf-intel-textbtn nf-intel-textbtn--lit" aria-expanded={explore} onClick={() => setExplore((e) => !e)} data-testid="intel-explore-all">
            {explore ? copy.suggested.showFewer : copy.suggested.exploreAll}
          </button>
        </div>
        <ul className="nf-intel-rows nf-intel-rows--flush" role="list">
          {shownRows.map((row) => {
            const link = "href" in row ? { href: row.href } : queryLink(row.query);
            const inner = (
              <>
                <span className="nf-intel-tile" aria-hidden="true">
                  <UiIcon name={row.icon} size={20} />
                </span>
                <span className="nf-intel-row__text">
                  <span className="nf-intel-row__title">
                    <span className="nf-intel-row__name">{row.title}</span>
                  </span>
                  <span className="nf-intel-row__sub">{row.sub}</span>
                </span>
                <UiIcon name="chevron-right" size={18} className="nf-intel-row__chevron" />
              </>
            );
            return (
              <li key={row.id} className="nf-intel-row" data-testid={`intel-suggested-${row.id}`}>
                {"href" in row ? (
                  <Link href={link.href} className="nf-intel-row__link">
                    {inner}
                  </Link>
                ) : (
                  <a className="nf-intel-row__link" {...link}>
                    {inner}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ----------------------------------------------------- try searching */}
      {examples.length > 0 ? (
      <section className="nf-intel-section" aria-labelledby="intel-try" data-testid="intel-try">
        <h2 id="intel-try" className="nf-intel-overline">
          {copy.trySearching.title}
        </h2>
        <ul className="nf-intel-chiprow" role="list">
          {examples.map((example) => (
            <li key={example}>
              <a className="nf-chip nf-intel-chip" data-testid="intel-try-chip" {...queryLink(example)}>
                <UiIcon name="search" size={14} />
                {example}
              </a>
            </li>
          ))}
        </ul>
      </section>
      ) : null}

      {view.status === "loading" ? (
        <div className="nf-intel-section" aria-busy="true" data-testid="intel-discover-loading">
          <span className="sr-only" role="status">
            {copy.loadingDiscover}
          </span>
          <Skeleton width="8rem" height="0.75rem" radius="xs" />
          <div className="nf-intel-skelrail">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height="11rem" radius="xl" />
            ))}
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------------- popular searches */}
      {data && data.popular.length > 0 ? (
        <section className="nf-intel-section" aria-labelledby="intel-popular" data-testid="intel-popular">
          <h2 id="intel-popular" className="nf-intel-overline">
            {copy.popular.title}
          </h2>
          <ul className="nf-intel-chiprow" role="list">
            {data.popular.slice(0, 8).map((p) => (
              <li key={p.query}>
                <a className="nf-chip nf-intel-chip" {...queryLink(p.query)}>
                  {p.query}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ----------------------------------------------------- fresh on Vallo */}
      {data && data.fresh.length > 0 ? (
        <section className="nf-intel-section" aria-labelledby="intel-fresh" data-testid="intel-fresh">
          <div className="nf-intel-head">
            <div>
              <h2 id="intel-fresh" className="nf-intel-overline">
                {copy.fresh.title}
              </h2>
              <p className="nf-intel-hintline">{copy.fresh.hint}</p>
            </div>
          </div>
          <ul className="nf-sx-rail nf-intel-rail" role="list">
            {data.fresh.slice(0, 8).map((result) => (
              <FreshCard key={result.key} result={result} copy={copy} locale={locale} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* -------------------------------------------------- people to follow */}
      {data && data.people.length > 0 ? (
        <section className="nf-intel-section" aria-labelledby="intel-people" data-testid="intel-people">
          <h2 id="intel-people" className="nf-intel-overline">
            {copy.people.title}
          </h2>
          <ul className="nf-ppl__list nf-intel-people" role="list">
            {data.people.slice(0, 5).map((person) => (
              <PersonRowItem key={person.key} card={personCardOf(person, copy, locale)} signedIn={signedIn} openLabel={fill(copy.people.open, { name: person.title })} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FreshCard({ result, copy, locale }: { result: IntelligenceResult; copy: IntelligenceCopy; locale: Locale }) {
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
        reason={result.why ?? null}
        reasonIcon="search"
        extra={result.subtitle && result.place && result.subtitle !== result.place ? <p className="nf-sc__sub">{result.subtitle}</p> : null}
      />
    </li>
  );
}
