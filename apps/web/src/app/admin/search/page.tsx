import type { Metadata } from "next";
import { formatNumber } from "@vallo/i18n";
import { readSearchAliases, readSearchOverview, searchDeskDoor, type SearchOverview } from "@/lib/admin/search-desk";
import { DeskRefused, DeskTable, shortDate } from "../_components/desk-parts";
import { Badge } from "../_components/Badge";
import { CalmNote, KpiStrip, PageHead, Panel, PanelUnavailable, type KpiItem } from "../_components/panels";
import { RangeSelect } from "../_components/RangeSelect";
import { AliasForm, AliasSwitch } from "./AliasForms";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * THE SEARCH DESK (16 November 2026): what people look for in VALLO
 * Intelligence, and the synonyms the search team keeps.
 *
 * Real aggregates only, over 7 or 30 days, from `admin_search_overview`
 * (pending SQL `intelligence_search_2026-11-16.sql`): searches, distinct
 * visits, the share that found nothing, click-through, the median server
 * time, which tabs and kinds were searched and opened, the places named, and
 * the words searched most and the words that found nothing. Word lists show
 * only words at least three distinct visits searched (the privacy floor the
 * database applies), so a single person's search is never on this screen.
 *
 * Opened by an admin, or staff with Analyst, Content or Marketing. Aliases
 * are changed by Content or Marketing (the database decides, and audits).
 * Until the SQL is applied the desk says so instead of showing zeros.
 */

type Params = Record<string, string | string[] | undefined>;

const KIND_WORD: Record<string, string> = {
  place: "Places",
  property: "Homes",
  stay: "Stays",
  restaurant: "Restaurants",
  roommate: "Roommates",
  person: "People",
  community: "Communities",
  post: "Posts",
  screen: "Screens",
  guide: "Help",
  personal: "Their own records",
  all: "All",
};

function share(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "None yet";
}

function ms(value: number | null): string | null {
  return value === null ? null : `${formatNumber(Math.round(value), "en")} ms`;
}

function figures(o: SearchOverview): KpiItem[] {
  return [
    { key: "searches", label: "Searches", value: formatNumber(o.searches, "en"), count: o.searches },
    { key: "visits", label: "Visits that searched", value: formatNumber(o.sessions, "en"), count: o.sessions },
    { key: "zero", label: "Found nothing", value: share(o.zeroResults, o.searches) },
    { key: "ctr", label: "Opened a result", value: share(o.clicks, o.searches), caption: `${formatNumber(o.clicks, "en")} opened` },
    { key: "median", label: "Median server time", value: ms(o.medianTookMs), ...(o.p90TookMs !== null ? { caption: `9 in 10 under ${ms(o.p90TookMs)}` } : {}), pending: "No timed searches in this range." },
  ];
}

function ShareTable({ caption, rows, total }: { caption: string; rows: { key: string; label: string; n: number }[]; total: number }) {
  if (rows.length === 0) return <p className="nf-body-sm text-content-2">Nothing in this range.</p>;
  return (
    <DeskTable
      caption={caption}
      columns={[
        { key: "what", label: caption },
        { key: "n", label: "Count", numeric: true },
        { key: "share", label: "Share", numeric: true },
      ]}
      rows={rows.map((r) => ({ key: r.key, cells: { what: r.label, n: formatNumber(r.n, "en"), share: share(r.n, total) } }))}
    />
  );
}

export default async function SearchDeskPage({ searchParams }: { searchParams: Promise<Params> }) {
  const door = await searchDeskDoor();
  if (door.state !== "ok") return <DeskRefused title="Search" state={door.state} who="This desk is for Analytics, Content and Marketing." />;

  const params = await searchParams;
  const days: 7 | 30 = params.range === "30" ? 30 : 7;
  const [overview, aliases] = await Promise.all([readSearchOverview(door.db, days), readSearchAliases(door.db)]);
  const notSetUp = overview.state === "not-set-up" || aliases.state === "not-set-up";

  return (
    <div className="nf-console nf-admin-stack" data-testid="search-desk">
      <PageHead
        title="Search"
        lede="What people look for in VALLO Intelligence, and the aliases that help it understand them. Figures only: no person and no single search is shown."
        action={<RangeSelect value={days === 30 ? "30" : "7"} options={{ "7": "Last 7 days", "30": "Last 30 days" }} short={{ "7": "7 days", "30": "30 days" }} label="Range" />}
      />

      {notSetUp ? (
        <Panel>
          <CalmNote
            kind="unwired"
            title="Search analytics are not set up yet"
            fills="Searches are not being recorded, so there is nothing to show. Search itself works."
            creates="The founder applies supabase/migrations/pending/intelligence_search_2026-11-16.sql to switch this on."
          />
        </Panel>
      ) : overview.state !== "ok" ? (
        <Panel>
          {overview.state === "forbidden" ? (
            <p className="nf-body">Your staff role does not open these figures.</p>
          ) : (
            <PanelUnavailable what="the search figures" />
          )}
        </Panel>
      ) : (
        <>
          <KpiStrip items={figures(overview.data)} label={`Search, last ${days} days`} />
          <Panel title="Most searched" id="search-top">
            <p className="nf-caption mb-row">Only words at least {overview.data.floor} different visits searched.</p>
            {overview.data.topQueries.length === 0 ? (
              <p className="nf-body-sm text-content-2">No words reach that floor in this range yet.</p>
            ) : (
              <DeskTable
                caption="Most searched words"
                columns={[
                  { key: "query", label: "Words" },
                  { key: "searches", label: "Searches", numeric: true },
                  { key: "sessions", label: "Visits", numeric: true },
                  { key: "zero", label: "Found nothing", numeric: true },
                ]}
                rows={overview.data.topQueries.map((q) => ({
                  key: q.query,
                  cells: { query: q.query, searches: formatNumber(q.searches, "en"), sessions: formatNumber(q.sessions, "en"), zero: formatNumber(q.zero, "en") },
                }))}
              />
            )}
          </Panel>
          <Panel title="Searches that found nothing" id="search-zero">
            <p className="nf-caption mb-row">What people want that Vallo does not have yet. Same floor of {overview.data.floor} visits.</p>
            {overview.data.zeroQueries.length === 0 ? (
              <p className="nf-body-sm text-content-2">No words reach that floor in this range.</p>
            ) : (
              <DeskTable
                caption="Words that found nothing"
                columns={[
                  { key: "query", label: "Words" },
                  { key: "searches", label: "Searches", numeric: true },
                  { key: "sessions", label: "Visits", numeric: true },
                ]}
                rows={overview.data.zeroQueries.map((q) => ({ key: q.query, cells: { query: q.query, searches: formatNumber(q.searches, "en"), sessions: formatNumber(q.sessions, "en") } }))}
              />
            )}
          </Panel>
          <Panel title="Places searched" id="search-places">
            <ShareTable caption="Place" total={overview.data.searches} rows={overview.data.places.map((p) => ({ key: p.place, label: p.place, n: p.n }))} />
          </Panel>
          <Panel title="Tabs" id="search-tabs">
            <ShareTable caption="Tab" total={overview.data.searches} rows={overview.data.tabs.map((t) => ({ key: t.tab, label: KIND_WORD[t.tab] ?? t.tab, n: t.n }))} />
          </Panel>
          <Panel title="What the words pointed at" id="search-kinds">
            <ShareTable caption="Kind" total={overview.data.searches} rows={overview.data.kinds.map((k) => ({ key: k.kind, label: KIND_WORD[k.kind] ?? k.kind, n: k.n }))} />
          </Panel>
          <Panel title="What was opened" id="search-clicks">
            <ShareTable caption="Result kind" total={overview.data.clicks} rows={overview.data.clickedKinds.map((k) => ({ key: k.kind, label: KIND_WORD[k.kind] ?? k.kind, n: k.n }))} />
          </Panel>
        </>
      )}

      {!notSetUp && (
        <Panel title="Aliases" id="search-aliases">
          <p className="nf-body-sm mb-row max-w-[68ch] text-content-2">
            Teach search a word people use. A word alias reads one set of words as another (buka as restaurant). A place alias points at a place Vallo already knows (Lekki 1 as Lekki Phase 1); one that points anywhere else is ignored. Every change is written to the audit log.
          </p>
          {aliases.state !== "ok" ? (
            aliases.state === "forbidden" ? <p className="nf-body">Your staff role does not open the aliases.</p> : <PanelUnavailable what="the aliases" />
          ) : (
            <>
              {aliases.data.canEdit ? <AliasForm /> : <p className="nf-caption">Content and Marketing change aliases. You can see them.</p>}
              {aliases.data.aliases.length === 0 ? (
                <p className="nf-body-sm mt-row text-content-2">No aliases yet.</p>
              ) : (
                <DeskTable
                  caption="Search aliases"
                  columns={[
                    { key: "from", label: "When people type" },
                    { key: "to", label: "Read it as" },
                    { key: "kind", label: "Kind" },
                    { key: "state", label: "State" },
                    { key: "changed", label: "Changed" },
                    { key: "act", label: "Action" },
                  ]}
                  rows={aliases.data.aliases.map((a) => ({
                    key: a.id,
                    cells: {
                      from: a.fromText,
                      to: a.toText,
                      kind: a.kind === "place" ? "Place" : "Word",
                      state: <Badge tone={a.active ? "success" : "info"}>{a.active ? "On" : "Off"}</Badge>,
                      changed: shortDate(a.updatedAt),
                      act: aliases.data.canEdit ? <AliasSwitch id={a.id} active={a.active} label={a.fromText} /> : null,
                    },
                  }))}
                />
              )}
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
