"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { countOf, type Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PersonRowItem } from "@/components/social/find/PersonCards";
import type { IntelUrlState } from "@/lib/intelligence/client";
import type { CategoryFacts } from "@/lib/intelligence/contract";
import type { DiscoverView } from "./IntelDiscover";
import { TILE_ICON, factsFor } from "./IntelExplore";
import { RecCard, queryLinkFor, type QueryLink } from "./IntelRails";
import {
  BEDROOM_PICKS,
  BUDGET_PICKS,
  GUEST_PICKS,
  fill,
  lagosToday,
  personCardOf,
  shortDay,
  shortNaira,
  stayWindows,
  tileLine,
  type ExploreTab,
  type IntelligenceCopy,
} from "./model";

/**
 * A CATEGORY'S OWN PAGE, OPENED FROM ITS TILE (round 3).
 *
 * The tile grows into this header (`runFlow`), and under the field each side
 * of Vallo offers its own way in:
 *
 *   Properties   rent or buy, bedrooms and a budget, then "Show homes"
 *   Stays        tonight, this weekend or next (Lagos calendar), guests
 *   Restaurants  all restaurants, dinner tonight
 *   Roommates    find one, post a room or yourself, sharing safely
 *   People       find people, Vallo Circle, people to follow
 *
 * then, for the three listing sides, the areas that really hold places of
 * that kind and the newest of them. When a side has no real places yet the
 * page says so plainly, with what to do next, and draws no empty card.
 * Everything chosen here becomes an ordinary search address, so Back works.
 */
export function IntelCategory({
  tab,
  view,
  copy,
  locale,
  onBack,
}: {
  tab: ExploreTab;
  view: DiscoverView;
  copy: IntelligenceCopy;
  locale: Locale;
  onBack: () => void;
}) {
  const data = view.status === "ready" ? view.data : null;
  const facts = factsFor(data?.categories, tab);
  const tile = copy.explore.tiles[tab];
  const line = tileLine(facts, locale);

  return (
    <div className="nf-intel-category" data-testid="intel-category" data-tab={tab}>
      <div className="nf-intel-cathead" data-intel-cathead="" data-testid="intel-cathead">
        <span className="nf-intel-tilecard__icon nf-intel-cathead__icon" aria-hidden="true">
          <UiIcon name={TILE_ICON[tab]} size={26} />
        </span>
        <span className="nf-intel-cathead__text">
          <h1 className="nf-intel-cathead__title">{tile.title}</h1>
          <span className="nf-intel-cathead__sub">{tile.sub}</span>
          {line ? <span className="nf-intel-tilecard__line nf-numeric">{line}</span> : null}
        </span>
      </div>
      <button type="button" className="nf-intel-back" aria-label={copy.category.backLabel} onClick={onBack} data-testid="intel-category-back">
        <UiIcon name="chevron-left" size={20} />
        <span>{copy.category.back}</span>
      </button>
    </div>
  );
}

/** What sits under the field on a category's page. */
export function IntelCategoryBody({
  tab,
  view,
  copy,
  locale,
  signedIn,
  url,
  runQuery,
  onSearch,
}: {
  tab: ExploreTab;
  view: DiscoverView;
  copy: IntelligenceCopy;
  locale: Locale;
  signedIn: boolean;
  url: IntelUrlState;
  runQuery: (q: string) => void;
  onSearch: (next: IntelUrlState) => void;
}) {
  const data = view.status === "ready" ? view.data : null;
  const queryLink = queryLinkFor(url, runQuery);
  const facts = factsFor(data?.categories, tab);
  return (
    <div className="nf-intel-discover nf-intel-catbody" data-testid={`intel-category-${tab}`}>
      {tab === "property" ? <PropertyPicks copy={copy} locale={locale} url={url} onSearch={onSearch} /> : null}
      {tab === "stay" ? <StayPicks copy={copy} locale={locale} url={url} onSearch={onSearch} /> : null}
      {tab === "restaurant" ? (
        <EntryRows
          rows={[
            { id: "browse", icon: "storefront", ...copy.category.restaurant.browse, href: "/restaurants" },
            { id: "tonight", icon: "calendar-clock", ...copy.category.restaurant.tonight, link: queryLink(copy.category.restaurant.tonightQuery) },
          ]}
        />
      ) : null}
      {tab === "roommate" ? (
        <EntryRows
          rows={[
            { id: "find", icon: "users", ...copy.category.roommate.find, href: "/roommates" },
            { id: "post", icon: "plus", ...copy.category.roommate.post, href: "/roommates/new" },
            { id: "safety", icon: "shield-check", ...copy.category.roommate.safety, href: "/roommates/safety" },
          ]}
        />
      ) : null}
      {tab === "person" ? (
        <>
          <EntryRows
            rows={[
              { id: "find", icon: "user-check", ...copy.category.person.find, href: "/around/people" },
              { id: "circle", icon: "circle-people", ...copy.category.person.circle, href: "/circle" },
            ]}
          />
          {data && data.people.length > 0 ? (
            <section className="nf-intel-section" aria-labelledby="intel-cat-people" data-testid="intel-people">
              <h2 id="intel-cat-people" className="nf-intel-overline">
                {copy.people.title}
              </h2>
              <ul className="nf-ppl__list nf-intel-people" role="list">
                {data.people.slice(0, 6).map((person) => (
                  <PersonRowItem key={person.key} card={personCardOf(person, copy, locale)} signedIn={signedIn} openLabel={fill(copy.people.open, { name: person.title })} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "property" || tab === "stay" || tab === "restaurant" ? (
        view.status === "loading" ? (
          <div className="nf-intel-section" aria-busy="true" data-testid="intel-category-loading">
            <span className="sr-only" role="status">
              {copy.loadingDiscover}
            </span>
            <Skeleton width="9rem" height="0.75rem" radius="xs" />
            <div className="nf-intel-skelrail">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} height="2.75rem" radius="pill" />
              ))}
            </div>
          </div>
        ) : facts ? (
          <ListingSide tab={tab} facts={facts} copy={copy} locale={locale} queryLink={queryLink} />
        ) : null
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- a listing side */

const WAITING_LINKS: Record<"property" | "stay" | "restaurant", { act: string; lister: string }> = {
  property: { act: "/saved/searches?brief=1#briefs", lister: "/agent/list" },
  stay: { act: "/stays", lister: "/host/apply" },
  restaurant: { act: "/restaurants", lister: "/host/apply" },
};

function ListingSide({
  tab,
  facts,
  copy,
  locale,
  queryLink,
}: {
  tab: "property" | "stay" | "restaurant";
  facts: CategoryFacts;
  copy: IntelligenceCopy;
  locale: Locale;
  queryLink: QueryLink;
}) {
  if (facts.live === 0) {
    const words = copy.category.waiting[tab];
    const links = WAITING_LINKS[tab];
    return (
      <section className="nf-intel-waiting" aria-labelledby="intel-waiting" data-testid="intel-waiting">
        <span className="nf-intel-waiting__glyph" aria-hidden="true">
          <UiIcon name={TILE_ICON[tab]} size={24} />
        </span>
        <h2 id="intel-waiting" className="nf-intel-waiting__title">
          {words.title}
        </h2>
        <p className="nf-intel-waiting__body">{words.body}</p>
        <div className="nf-intel-waiting__acts">
          <ButtonLink href={links.act} variant="primary" size="sm" data-testid="intel-waiting-act">
            {words.act}
          </ButtonLink>
          <ButtonLink href={links.lister} variant="secondary" size="sm" data-testid="intel-waiting-lister">
            {words.lister}
          </ButtonLink>
        </div>
      </section>
    );
  }
  return (
    <>
      {facts.areas.length > 0 ? (
        <section className="nf-intel-section" aria-labelledby="intel-cat-areas" data-testid="intel-category-areas">
          <h2 id="intel-cat-areas" className="nf-intel-overline">
            {copy.category.areas[tab]}
          </h2>
          <ul className="nf-intel-chiprow" role="list">
            {facts.areas.map((area) => (
              <li key={`${area.name}|${area.city}`}>
                <a className="nf-chip nf-intel-chip" data-testid="intel-category-area" {...queryLink(fill(copy.category.inArea[tab], { area: area.name }))}>
                  <UiIcon name="location" size={14} className="nf-intel-chip__glyph" />
                  <span>{area.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {facts.latest.length > 0 ? (
        <section className="nf-intel-section" aria-labelledby="intel-cat-latest" data-testid="intel-category-latest">
          <h2 id="intel-cat-latest" className="nf-intel-overline">
            {copy.category.latest[tab]}
          </h2>
          <ul className="nf-sx-rail nf-intel-rail" role="list">
            {facts.latest.map((result) => (
              <RecCard key={result.key} result={result} copy={copy} locale={locale} reasonIcon="clock" />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ entry rows */

type EntryRow = { id: string; icon: UiIconName; title: string; sub: string } & ({ href: string } | { link: ReturnType<QueryLink> });

function EntryRows({ rows }: { rows: EntryRow[] }) {
  return (
    <ul className="nf-intel-entries" role="list">
      {rows.map((row) => {
        const inner = (
          <>
            <span className="nf-intel-tilecard__icon" aria-hidden="true">
              <UiIcon name={row.icon} size={20} />
            </span>
            <span className="nf-intel-tilecard__text">
              <span className="nf-intel-tilecard__title">{row.title}</span>
              <span className="nf-intel-tilecard__sub">{row.sub}</span>
            </span>
            <UiIcon name="chevron-right" size={18} className="nf-intel-tilecard__go" />
          </>
        );
        return (
          <li key={row.id}>
            {"href" in row ? (
              <Link href={row.href} className="nf-intel-tilecard nf-intel-tilecard--row" data-testid={`intel-entry-${row.id}`}>
                {inner}
              </Link>
            ) : (
              <a className="nf-intel-tilecard nf-intel-tilecard--row" data-testid={`intel-entry-${row.id}`} {...row.link}>
                {inner}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------- the picks */

function PickGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="nf-intel-pick" role="group" aria-labelledby={id}>
      <p id={id} className="nf-intel-pick__label">
        {label}
      </p>
      <div className="nf-intel-pick__row">{children}</div>
    </div>
  );
}

function Pick({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <button type="button" className={`nf-chip nf-intel-chip nf-intel-pickchip${on ? " nf-chip--active" : ""}`} aria-pressed={on} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  );
}

function PropertyPicks({ copy, locale, url, onSearch }: { copy: IntelligenceCopy; locale: Locale; url: IntelUrlState; onSearch: (next: IntelUrlState) => void }) {
  const c = copy.category.property;
  const [market, setMarket] = useState<"rent" | "buy">("rent");
  const [beds, setBeds] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const budgets = BUDGET_PICKS[market];
  return (
    <section className="nf-intel-picks" aria-label={copy.explore.tiles.property.title} data-testid="intel-property-picks">
      <div className="nf-intel-seg" role="radiogroup" aria-label={c.market}>
        {(["rent", "buy"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={market === m}
            className="nf-intel-seg__opt"
            onClick={() => {
              setMarket(m);
              setMax(null);
            }}
            data-testid={`intel-market-${m}`}
          >
            {m === "rent" ? c.rent : c.buy}
          </button>
        ))}
      </div>
      <PickGroup label={c.bedrooms}>
        <Pick on={beds === null} onClick={() => setBeds(null)}>
          {c.any}
        </Pick>
        {BEDROOM_PICKS.map((n) => (
          <Pick key={n} on={beds === n} onClick={() => setBeds(n)} testId={`intel-beds-${n}`}>
            {countOf(n, "bedrooms", locale)}
          </Pick>
        ))}
      </PickGroup>
      <PickGroup label={c.budget}>
        <Pick on={max === null} onClick={() => setMax(null)}>
          {c.any}
        </Pick>
        {budgets.map((n) => (
          <Pick key={n} on={max === n} onClick={() => setMax(n)} testId={`intel-budget-${n}`}>
            {fill(c.under, { price: shortNaira(n, locale) })}
          </Pick>
        ))}
      </PickGroup>
      <Button
        variant="primary"
        full
        arrow
        data-testid="intel-property-show"
        onClick={() =>
          onSearch({
            ...url,
            q: market === "rent" ? c.queryRent : c.queryBuy,
            tab: "property",
            drop: [],
            filters: { intent: market, ...(beds ? { bedrooms: beds } : {}), ...(max ? { maxPrice: max } : {}) },
          })
        }
      >
        {c.show}
      </Button>
    </section>
  );
}

function StayPicks({ copy, locale, url, onSearch }: { copy: IntelligenceCopy; locale: Locale; url: IntelUrlState; onSearch: (next: IntelUrlState) => void }) {
  const c = copy.category.stay;
  const [when, setWhen] = useState<"tonight" | "weekend" | "nextWeekend" | null>(null);
  const [guests, setGuests] = useState<number | null>(null);
  /* Read once per visit to the page: the Lagos calendar, not the device's. */
  const [windows] = useState(() => stayWindows(lagosToday()));
  return (
    <section className="nf-intel-picks" aria-label={copy.explore.tiles.stay.title} data-testid="intel-stay-picks">
      <PickGroup label={c.when}>
        {(["tonight", "weekend", "nextWeekend"] as const).map((w) => (
          <Pick key={w} on={when === w} onClick={() => setWhen(when === w ? null : w)} testId={`intel-when-${w}`}>
            <span className="nf-intel-pickchip__two">
              <span>{c[w]}</span>
              <span className="nf-intel-pickchip__small nf-numeric">
                {fill(copy.understood.dates, { from: shortDay(windows[w].checkIn, locale), to: shortDay(windows[w].checkOut, locale) })}
              </span>
            </span>
          </Pick>
        ))}
      </PickGroup>
      <PickGroup label={c.guests}>
        {GUEST_PICKS.map((n) => (
          <Pick key={n} on={guests === n} onClick={() => setGuests(guests === n ? null : n)} testId={`intel-guests-${n}`}>
            {countOf(n, "guests", locale)}
          </Pick>
        ))}
      </PickGroup>
      <Button
        variant="primary"
        full
        arrow
        data-testid="intel-stay-show"
        onClick={() =>
          onSearch({
            ...url,
            q: c.query,
            tab: "stay",
            drop: [],
            filters: { ...(when ? windows[when] : {}), ...(guests ? { guests } : {}) },
          })
        }
      >
        {c.show}
      </Button>
    </section>
  );
}
