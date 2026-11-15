import { getDictionary, type Locale } from "@vallo/i18n";
import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import { getLocale } from "@/lib/locale";
import { ListingPulse } from "@/components/app/listing/ListingPulse";
import { daysLive, listingPulse, timeOnVallo } from "@/lib/listings/stats/format";
import { shownRating } from "@/lib/listings/stats/rating";
import { ListingStatsDesk } from "@/app/admin/analytics/listings/ListingStatsDesk";
import { PageHead, ReadOnlyNote } from "@/app/admin/_components/panels";
import { ListingsWorkspace } from "@/app/agent/listings/ListingsWorkspace";
import { AgentShell } from "@/components/agent/AgentShell";
import { STATS_RANGES, type DayFigures, type RankedRow, type StatsRange } from "@/lib/admin/reads/listing-stats-model";
import { AdminPreviewFrame } from "../f5/AdminPreviewFrame";
import { AGENT_LISTINGS, AGENT_PROFILE } from "../f5/ops-fixtures";
import { ListingCard } from "@/components/app/ListingCard";
import { HomeListingCard } from "@/components/app/home/HomeListingCard";
import { homeCardCopyOf } from "@/components/app/home/home-card-copy";
import { forListingCard } from "@/lib/i18n/slice";
import { SHELF } from "../f3/fixtures";
import "@/app/css/space-card.css";

/**
 * LISTING STATS, FROM FIXTURES (founder, 13 November 2026). Real components,
 * invented figures; nothing here reads a database.
 *
 *   ?v=row     the pulse under a listing's description, in seven states
 *   ?v=admin   Analytics > Listings in the console frame (&range=7d|30d|90d)
 *   ?v=empty   the desk before anything is counted, and before the SQL
 *   ?v=agent   the lister's own rows with their figures
 *   ?v=cards   the signal line (rating, views, saves) on the search card and the home card
 */
export const dynamic = "force-dynamic";

const NOW = new Date("2026-11-13T10:00:00+01:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function fixtureDays(count: number): DayFigures[] {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.parse("2026-11-13T00:00:00Z") - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const views = 40 + ((i * 37) % 55) + Math.round(i * 1.4);
    return { day, views, saves: Math.round(views / 9), enquiries: Math.round(views / 22), viewings: Math.round(views / 40) };
  });
}

const row = (key: string, label: string, sub: string | null, views: number, saves: number, listings = 1): RankedRow => ({
  key,
  label,
  sub,
  listings,
  views,
  saves,
  enquiries: Math.round(views / 20),
  viewings: Math.round(views / 45),
});

const TOP: RankedRow[] = [
  row("7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13", "Two bedroom flat with a generator", "Yaba, Lagos", 1240, 88),
  row("00000000-0000-4000-8000-000000000102", "Self contain near the university gate", "Akoka, Lagos", 860, 61),
  row("00000000-0000-4000-8000-000000000103", "Three bedroom terrace, gated estate", "Gwarinpa, Abuja", 702, 74),
  row("00000000-0000-4000-8000-000000000104", "Mini flat, prepaid meter", "Ikeja, Lagos", 455, 19),
  row("00000000-0000-4000-8000-000000000105", "Studio apartment with water heater", "Wuse 2, Abuja", 310, 22),
];
const AREAS: RankedRow[] = [
  row("yaba|lagos", "Yaba", "Lagos", 2210, 140, 9),
  row("gwarinpa|abuja", "Gwarinpa", "Abuja", 1530, 118, 6),
  row("ikeja|lagos", "Ikeja", "Lagos", 990, 52, 7),
  row("lekki|lagos", "Lekki", "Lagos", 640, 41, 4),
];
const LISTERS: RankedRow[] = [
  row("a1", "Amaka Homes", null, 2890, 190, 8),
  row("a2", "Tunde Realty", null, 1460, 96, 5),
  row("a3", "Hauwa Properties", null, 700, 37, 3),
];

export default async function ListingStatsPreview({ searchParams }: { searchParams: Promise<{ v?: string; range?: string }> }) {
  const [{ v = "row", range: rangeParam }, locale] = await Promise.all([searchParams, getLocale() as Promise<Locale>]);
  const t = getDictionary(locale);
  const range: StatsRange = STATS_RANGES.find((r) => r === rangeParam) ?? "30d";

  if (v === "admin" || v === "empty") {
    const n = { "7d": 7, "30d": 30, "90d": 90 }[range];
    const all = fixtureDays(n * 2);
    const ok = <T,>(data: T) => ({ state: "ok" as const, data });
    const empty = v === "empty";
    const zero = all.map((d) => ({ ...d, views: 0, saves: 0, enquiries: 0, viewings: 0 }));
    return (
      <AdminPreviewFrame t={t}>
        <div className="nf-admin-stack">
          <PageHead title={listingStatsEn.desk.title} lede={listingStatsEn.desk.lede} />
          <ReadOnlyNote locale={locale} />
          <ListingStatsDesk
            locale={locale}
            range={range}
            days={empty ? ok({ previous: zero.slice(0, n), current: zero.slice(n) }) : ok({ previous: all.slice(0, n), current: all.slice(n) })}
            topViews={ok(empty ? [] : TOP)}
            topSaves={ok(empty ? [] : [...TOP].sort((a, b) => b.saves - a.saves))}
            areas={ok(empty ? [] : AREAS)}
            listers={ok(empty ? [] : LISTERS)}
          />
          {empty ? (
            <ListingStatsDesk
              locale={locale}
              range={range}
              days={{ state: "missing" }}
              topViews={{ state: "missing" }}
              topSaves={{ state: "missing" }}
              areas={{ state: "missing" }}
              listers={{ state: "missing" }}
            />
          ) : null}
        </div>
      </AdminPreviewFrame>
    );
  }

  if (v === "cards") {
    const cards = [
      { stats: { views: 1234, saves: 24, shares: 7 }, rating: 4.6, reviewCount: 12, isDemo: false },
      { stats: { views: 40, saves: 2, shares: 0 }, rating: 0, reviewCount: 0, isDemo: false },
      { stats: { views: 3, saves: 0, shares: 0 }, rating: 0, reviewCount: 0, isDemo: true },
      { stats: undefined, rating: 0, reviewCount: 0, isDemo: true },
    ].map((over, i) => ({ ...SHELF[i]!, ...over }));
    const copy = homeCardCopyOf(t);
    const cardCopy = forListingCard(t);
    return (
      <main className="nf-shell mx-auto max-w-3xl py-section">
        <h1 className="nf-h2">The signal line on the cards</h1>
        <p className="nf-caption mt-xs">
          Reviewed (4.6 from 12 reviews) with 1.2k views and 24 saves; not yet rated (2.5, New) with 40 views and 2 saves; an
          example with 3 views; an example before anything is counted (the rating alone).
        </p>
        <ul className="mt-lg grid gap-md" data-testid="search-cards">
          {cards.map((listing, i) => (
            <li key={listing.id}>
              <ListingCard listing={listing} locale={locale} t={cardCopy} layout="row" brief index={i} />
            </li>
          ))}
        </ul>
        <h2 className="nf-h3 mt-lg">Home cards</h2>
        <ul className="mt-sm grid gap-md sm:grid-cols-2" data-testid="home-cards">
          {cards.map((listing) => (
            <li key={listing.id}>
              <HomeListingCard listing={listing} locale={locale} copy={copy} layout="card" />
            </li>
          ))}
        </ul>
      </main>
    );
  }

  if (v === "agent") {
    const stats = Object.fromEntries(
      AGENT_LISTINGS.map((listing, i) => [listing.id, { views: [1240, 0, 87, 12][i % 4]!, saves: [88, 0, 6, 1][i % 4]! }]),
    );
    const listings = AGENT_LISTINGS.map((listing, i) => ({ ...listing, publishedAt: listing.publishedAt ?? daysAgo([12, 0, 75, 3][i % 4]!) }));
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={AGENT_PROFILE}>
        <h1 className="nf-h1 mb-lg">{t.agentListings.workspace.title}</h1>
        <ListingsWorkspace t={t.agentListings} reference={t.listingReference} listings={listings} locale={locale} stats={stats} statsAt={NOW.getTime()} />
      </AgentShell>
    );
  }

  const states: { name: string; publishedAt: string; figures: { views: number; saves: number; shares?: number } | null; rating?: number; reviews?: number; demo?: boolean }[] = [
    { name: "Listed today, nobody has looked yet", publishedAt: daysAgo(0), figures: { views: 0, saves: 0, shares: 0 } },
    { name: "Twelve days live, reviewed", publishedAt: daysAgo(12), figures: { views: 340, saves: 18, shares: 7 }, rating: 4.6, reviews: 12 },
    { name: "One of each", publishedAt: daysAgo(1), figures: { views: 1, saves: 1, shares: 1 } },
    { name: "Four months live, compact figures", publishedAt: daysAgo(130), figures: { views: 12_480, saves: 1_999, shares: 1_204 }, rating: 3.5, reviews: 240 },
    { name: "An example listing: its counts, no time on Vallo", publishedAt: daysAgo(30), figures: { views: 50, saves: 3, shares: 2 }, demo: true },
    { name: "Before the shares SQL: views and saves only", publishedAt: daysAgo(4), figures: { views: 22, saves: 4 } },
    { name: "The read failed: the rating alone", publishedAt: daysAgo(4), figures: null },
  ];
  return (
    <main className="nf-shell mx-auto max-w-3xl py-section">
      <h1 className="nf-h2">Listing pulse</h1>
      <div className="mt-lg grid gap-lg">
        {states.map((s) => {
          const days = s.demo || !s.figures ? null : daysLive(s.publishedAt, NOW);
          return (
            <section key={s.name} className="nf-panel nf-panel--card p-card" data-state={s.name}>
              <p className="nf-overline text-[var(--nf-content-muted)]">{s.name}</p>
              <h2 className="nf-h3 mt-xs">{t.catalogue.detail.description}</h2>
              <p className="mt-xs text-[var(--nf-content-secondary)]">
                A bright two bedroom flat on a quiet street, five minutes from the bus stop. Prepaid meter, borehole water and a
                shared generator for the compound.
              </p>
              <ListingPulse
                className="mt-sm"
                tiles={listingPulse({ figures: s.figures, locale })}
                rating={shownRating({ rating: s.rating, reviewCount: s.reviews }, locale)}
                age={days === null ? null : timeOnVallo(days, locale)}
              />
            </section>
          );
        })}
      </div>
    </main>
  );
}
