"use client";

import type { Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { PersonRowItem } from "@/components/social/find/PersonCards";
import type { DiscoverResponse } from "@/lib/intelligence/contract";
import { CitySkyline } from "./IntelArt";
import { IntelExplore } from "./IntelExplore";
import { IntelContinue, IntelForYou, IntelPopular, IntelTrending, RecCard, queryLinkFor } from "./IntelRails";
import type { IntelUrlState } from "@/lib/intelligence/client";
import { fill, personCardOf, postcardCities, type ExploreTab, type IntelligenceCopy } from "./model";
import "@/components/app/search/search-v2.css";

export type DiscoverView = { status: "loading" } | { status: "ready"; data: DiscoverResponse } | { status: "unavailable" };

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

/**
 * THE DISCOVERY HOME (round 3, after the founder's reference): calm, card
 * based, one clear order under the field.
 *
 *   Explore Vallo          the two-by-two grid of categories, and People
 *   Try searching          searches the engine ran and found answers for
 *   Continue               the member's last search, places this device opened
 *   For you                the member's own rails, each card saying why
 *   Popular on Vallo       searches above the privacy floor
 *   Trending areas         areas with the most new real listings
 *   Start with a mood      feelings as real filters
 *   Where the new places are, Fresh on Vallo, People to follow
 *
 * The grid, the moods and the searches to try never depend on the catalogue,
 * so a day with no listings at all still reads as a whole page. Everything
 * else is real or not drawn; nothing is padded out.
 */
export function IntelDiscover({
  view,
  copy,
  locale,
  signedIn,
  url,
  runQuery,
  onChooseCategory,
  onRemoveRecent,
  onClearRecent,
}: {
  view: DiscoverView;
  copy: IntelligenceCopy;
  locale: Locale;
  signedIn: boolean;
  url: IntelUrlState;
  runQuery: (q: string) => void;
  onChooseCategory: (tab: ExploreTab, tile: HTMLElement) => void;
  onRemoveRecent: (q: string) => void;
  onClearRecent: () => void;
}) {
  const data = view.status === "ready" ? view.data : null;
  const queryLink = queryLinkFor(url, runQuery);
  /* Only the engine's own examples, known to return results today. */
  const examples = data ? data.examples.slice(0, 5) : [];
  const cities = data ? postcardCities(data.fresh) : [];

  return (
    <div className="nf-intel-discover" data-testid="intel-discover">
      <IntelExplore copy={copy} locale={locale} categories={data?.categories} onChoose={onChooseCategory} />

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
                  <UiIcon name="search" size={14} className="nf-intel-chip__glyph" />
                  <span>{example}</span>
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
              <Skeleton key={i} height="2.75rem" radius="pill" />
            ))}
          </div>
        </div>
      ) : null}

      <IntelContinue data={data} signedIn={signedIn} copy={copy} locale={locale} queryLink={queryLink} onRemoveRecent={onRemoveRecent} onClearRecent={onClearRecent} />
      <IntelForYou data={data} copy={copy} locale={locale} />
      <IntelPopular data={data} copy={copy} queryLink={queryLink} />
      <IntelTrending data={data} copy={copy} locale={locale} queryLink={queryLink} />

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

      {/* ----------------------------------------------------- fresh on Vallo */}
      {data && data.fresh.length > 0 ? (
        <section className="nf-intel-section" aria-labelledby="intel-fresh" data-testid="intel-fresh">
          <div>
            <h2 id="intel-fresh" className="nf-intel-overline">
              {copy.fresh.title}
            </h2>
            <p className="nf-intel-hintline">{copy.fresh.hint}</p>
          </div>
          <ul className="nf-sx-rail nf-intel-rail" role="list">
            {data.fresh.slice(0, 8).map((result) => (
              <RecCard key={result.key} result={result} copy={copy} locale={locale} />
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
