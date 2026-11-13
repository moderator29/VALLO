import { getDictionary, type Locale } from "@vallo/i18n";
import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import { getLocale } from "@/lib/locale";
import { ListingStatsRow } from "@/components/app/listing/ListingStatsRow";
import { listingStatItems } from "@/lib/listings/stats/format";
import { ListingStatsDesk } from "@/app/admin/analytics/listings/ListingStatsDesk";
import { PageHead, ReadOnlyNote } from "@/app/admin/_components/panels";
import { ListingsWorkspace } from "@/app/agent/listings/ListingsWorkspace";
import { AgentShell } from "@/components/agent/AgentShell";
import { STATS_RANGES, type DayFigures, type RankedRow, type StatsRange } from "@/lib/admin/reads/listing-stats-model";
import { AdminPreviewFrame } from "../f5/AdminPreviewFrame";
import { AGENT_LISTINGS, AGENT_PROFILE } from "../f5/ops-fixtures";

/**
 * LISTING STATS, FROM FIXTURES (founder, 13 November 2026). Real components,
 * invented figures; nothing here reads a database.
 *
 *   ?v=row     the row under a listing's description, in five states
 *   ?v=admin   Analytics > Listings in the console frame (&range=7d|30d|90d)
 *   ?v=empty   the desk before anything is counted, and before the SQL
 *   ?v=agent   the lister's own rows with their figures
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

  const states: { name: string; publishedAt: string; views: number; saves: number; demo?: boolean }[] = [
    { name: "Listed today, nobody has looked yet", publishedAt: daysAgo(0), views: 0, saves: 0 },
    { name: "Twelve days live", publishedAt: daysAgo(12), views: 340, saves: 18 },
    { name: "One view, one save", publishedAt: daysAgo(1), views: 1, saves: 1 },
    { name: "Four months live, compact figures", publishedAt: daysAgo(130), views: 12_480, saves: 1_999 },
    { name: "An example listing: no row at all", publishedAt: daysAgo(30), views: 50, saves: 3, demo: true },
  ];
  return (
    <main className="nf-shell mx-auto max-w-3xl py-section">
      <h1 className="nf-h2">Listing stats row</h1>
      <div className="mt-lg grid gap-lg">
        {states.map((s) => (
          <section key={s.name} className="nf-panel nf-panel--card p-card" data-state={s.name}>
            <p className="nf-overline text-[var(--nf-content-muted)]">{s.name}</p>
            <h2 className="nf-h3 mt-xs">{t.catalogue.detail.description}</h2>
            <p className="mt-xs text-[var(--nf-content-secondary)]">
              A bright two bedroom flat on a quiet street, five minutes from the bus stop. Prepaid meter, borehole water and a
              shared generator for the compound.
            </p>
            <ListingStatsRow
              className="mt-sm"
              label={listingStatsEn.rowLabel}
              items={listingStatItems({ isDemo: Boolean(s.demo), publishedAt: s.publishedAt, figures: { views: s.views, saves: s.saves }, now: NOW, locale })}
            />
          </section>
        ))}
      </div>
    </main>
  );
}
