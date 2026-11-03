import Link from "next/link";
import { LiveRefresh } from "../_components/LiveRefresh";
import { ReadOnlyNote } from "../_components/panels";
import { formatDate, formatMoney, getDictionary, plural, type Dictionary, type Locale } from "@vallo/i18n";
import { fill } from "../_components/copy";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CalmNote, DeskHead, EmptyChart, Framed, Kpi, NumberedPager, Panel, TableNote, Waiting, lastMonths } from "../money/_desk/Desk";
import { Donut, RankBars, RankFrame, SeriesChart, SeriesLegend, StatusBar, type Series } from "../money/_desk/charts";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import type { FirmRosters } from "@/lib/admin/reads/supply";
import { PersonTier } from "@/app/admin/_components/PersonTier";
import type { BadgeTier } from "@/lib/admin/reads/badges";
import { percentChange } from "@/lib/admin/reads/money-derive";
import {
  SUPPLY_ROLE_KEYS,
  type SupplyConsole,
  type SupplyRoleKey,
} from "@/lib/admin/reads/money-types";

/**
 * The supply desk, drawn from one `SupplyConsole` (`getSupplyDesk` in
 * `lib/admin/reads/supply.ts`), or from nothing when that read could not
 * answer, in which case every panel says what it shows and draws no number.
 *
 * THE ROLE VOCABULARY is the product's own (`lib/supply/roles.ts`,
 * `lib/supply/workspaces-queries.ts`): owner and agent are kinds of PERSON, a
 * firm is an agency business, and a host is every other business on the
 * stays side. Four doors, no fifth.
 */

/**
 * A role's name, one and many. `one` is the console's own lister words
 * (`shell.overview`), with the host this desk adds; `many` is this desk's.
 */
export function roleLabels(t: Dictionary): Record<SupplyRoleKey, { one: string; many: string }> {
  const o = t.admin.shell.overview;
  const c = t.admin.supply;
  return {
    owner: { one: o.owner, many: c.many.owner },
    agent: { one: o.agent, many: c.many.agent },
    firm: { one: o.firm, many: c.many.firm },
    host: { one: c.host, many: c.many.host },
  };
}

/** Property types in words: the overview's own kinds where it has them, this desk's for the rest. */
function propertyTypeLabels(t: Dictionary): Record<string, string> {
  const k = t.admin.shell.overview.kinds;
  return {
    ...t.admin.supply.propertyType,
    shortlet: k.shortlets,
    hotel: k.hotels,
    land: k.land,
    restaurant: k.restaurants,
  };
}

/** Dash patterns so four series never rest on colour alone (research part four). */
const ROLE_DASH: Record<SupplyRoleKey, string | undefined> = {
  owner: undefined,
  agent: "8 4",
  firm: "3 4",
  host: "1 5",
};

export type SupplyFilter = { role?: SupplyRoleKey; examples: boolean; page: number };

export function SupplyDesk({
  supply,
  filter,
  params,
  locale,
  pageSize,
  rosters,
  tiers = {},
  now,
}: {
  /** Badge tiers keyed by user id, from `public.person_badge`. */
  tiers?: Record<string, BadgeTier>;
  now: number;
  /** `getFirmRosters`: who works at which firm. Null when it could not be read. */
  rosters: FirmRosters | null;
  supply: (SupplyConsole & { complete?: boolean }) | null;
  filter: SupplyFilter;
  params: Record<string, string | undefined>;
  locale: Locale;
  pageSize: number;
}) {
  const t = getDictionary(locale);
  const c = t.admin.supply;
  const ROLE_LABEL = roleLabels(t);
  const PROPERTY_TYPE_LABEL = propertyTypeLabels(t);
  const hrefWith = (next: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { ...params, ...next, page: undefined };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/admin/supply?${qs}` : "/admin/supply";
  };

  const examplesToggle = (
    <Link
      href={hrefWith({ examples: filter.examples ? undefined : "1" })}
      className="nf-md-toggle"
      aria-current={filter.examples ? "true" : undefined}
    >
      <UiIcon name={filter.examples ? "eye" : "eye-off"} size={16} />
      {filter.examples ? c.includingExamples : c.examplesLeftOut}
    </Link>
  );

  return (
    <div className="nf-console nf-md nf-md--supply">
      <LiveRefresh />
      <DeskHead
        title={t.admin.shell.nav.supply}
        lede={c.lede}
        aside={examplesToggle}
      />
      <ReadOnlyNote locale={locale} />

      <div className="nf-md-kpis" role="list" aria-label={c.byRole}>
        {SUPPLY_ROLE_KEYS.map((role) => {
          const count = supply?.counts[role];
          return (
            <div role="listitem" key={role} className="contents">
              <Kpi
                locale={locale}
                label={ROLE_LABEL[role].many}
                value={count ? String(count.now) : null}
                delta={
                  count
                    ? { percent: percentChange(count.now, count.weekAgo), against: t.admin.shell.overview.vsLastWeek }
                    : null
                }
                note={
                  !count
                    ? c.accountsInRole
                    : count.now === 0
                      ? c.noneYet[role]
                      : c.noneWeekAgo
                }
                href={hrefWith({ role: filter.role === role ? undefined : role })}
                current={filter.role === role}
              />
            </div>
          );
        })}
      </div>

      {supply && supply.complete === false && (
        <p className="nf-md-panel__hint">{c.incomplete}</p>
      )}
      {supply && !filter.examples && supply.examplesExcluded > 0 && (
        <p className="nf-md-panel__hint">{plural(supply.examplesExcluded, c.examplesExcluded, locale)}</p>
      )}

      <div className="nf-md-grid nf-md-grid--main">
        <Panel
          title={filter.role ? fill(c.byRoleOf, { role: ROLE_LABEL[filter.role].many }) : c.byRole}
          hint={supply ? plural(supply.total, c.accounts, locale) : undefined}
        >
          {!supply ? (
            <Waiting title={c.unreadTitle} body={c.unreadTable} />
          ) : supply.rows.length === 0 ? (
            <div className="nf-md-scroll"><table className="nf-md-table">
              <SupplyHead c={c} />
              <tbody>
                <TableNote
                  columns={6}
                  note={{
                    title: filter.role
                      ? (filter.examples ? c.noneYet : c.noneYetOutside)[filter.role]
                      : filter.examples
                        ? c.nobodyYet
                        : c.nobodyYetOutside,
                    fills: c.tableFills,
                    creates: c.tableCreates,
                    action: { href: "/admin/kyc", label: c.openVerification },
                  }}
                />
              </tbody>
            </table></div>
          ) : (
            <>
              <div className="nf-md-scroll"><table className="nf-md-table">
                <SupplyHead c={c} />
                <tbody>
                  {supply.rows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`}>
                      <td className="nf-md-lead nf-md-strong" data-label="">
                        {row.name}
                        {row.userId ? <PersonTier tier={tiers[row.userId]} /> : null}
                      </td>
                      <td data-label={c.role}>{ROLE_LABEL[row.role].one}</td>
                      <td className="nf-md-num" data-label={c.listings}>
                        {row.listings}
                      </td>
                      <td data-label={c.verified}>
                        {row.verified ? (
                          <span className="nf-md-mark nf-md-mark--yes">
                            <UiIcon name="verified" size={16} /> {c.yes}
                          </span>
                        ) : (
                          /* Not verified yet is not a failure: a red cross drew
                             an unverified agent as if a check had been failed
                             (north star 12, point 15: a null never looks
                             negative; C1 sweep). Quiet words, no glyph. */
                          <span className="text-[var(--nf-content-muted)]">{c.no}</span>
                        )}
                      </td>
                      <td className="nf-md-num nf-md-strong" data-label={c.transacted}>
                        {formatMoney(row.transactedMinor, locale, "NGN", { compact: row.transactedMinor >= 100_000_000 })}
                      </td>
                      <td className="nf-md-num" data-label={c.joined}>
                        {formatDate(new Date(row.joinedAt), locale, {
                          month: "short",
                          year: "numeric",
                          timeZone: "Africa/Lagos",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <NumberedPager
                base="/admin/supply"
                params={params}
                page={supply.page}
                total={supply.total}
                pageSize={pageSize}
                noun={c.accountsNoun}
                locale={locale}
              />
            </>
          )}
        </Panel>

        <GrowthPanel supply={supply} locale={locale} now={now} />
      </div>

      <div className="nf-md-grid nf-md-grid--halves">
        <Panel title={c.topAreasTitle}>
          {!supply ? (
            <Waiting title={c.unreadTitle} body={c.unreadAreas} />
          ) : supply.topAreas.length === 0 ? (
            <Framed frame={<RankFrame />}>
              <CalmNote
                title={c.noLiveTitle}
                fills={c.areasFills}
                creates={c.noLiveCreates}
                action={{ href: "/admin/listings", label: c.openListingReview }}
              />
            </Framed>
          ) : (
            <RankBars rows={supply.topAreas.slice(0, 5).map((a) => ({ label: a.area, count: a.count }))} />
          )}
        </Panel>
        <Panel title={c.byTypeTitle}>
          {!supply ? (
            <Waiting title={c.unreadTitle} body={c.unreadTypes} />
          ) : supply.byPropertyType.length === 0 ? (
            <Framed
              frame={
                <Donut
                  label={c.byTypeLabel}
                  totalLabel={c.total}
                  totalValue="0"
                  slices={["home", "apartment", "land", "hotel", "shortlet", "restaurant"].map((t) => ({
                    label: PROPERTY_TYPE_LABEL[t] ?? t,
                    count: 0,
                  }))}
                />
              }
            >
              <CalmNote
                title={c.noLiveTitle}
                fills={c.typesFills}
                creates={c.noLiveCreates}
                action={{ href: "/admin/listings", label: c.openListingReview }}
              />
            </Framed>
          ) : (
            <Donut
              label={c.byTypeLabel}
              totalLabel={c.total}
              totalValue={String(supply.byPropertyType.reduce((s, x) => s + x.count, 0))}
              slices={supply.byPropertyType.map((p) => ({
                label: PROPERTY_TYPE_LABEL[p.type] ?? p.type,
                count: p.count,
              }))}
            />
          )}
        </Panel>
      </div>

      <RostersPanel rosters={rosters} examples={filter.examples} locale={locale} tiers={tiers} />
    </div>
  );
}

const MEMBER_TONE: Record<string, StatusTone> = {
  pending: "warning",
  active: "success",
  revoked: "danger",
};

/**
 * Who works at which firm (`firm_members`): exact counts by state on the
 * status four, then each firm's roster under its name, pending first, the
 * principal before staff. Read-only: admitting and revoking are
 * `private.admit_firm_member` and `private.revoke_firm_member`, each writing
 * an audit row, and no console control calls them.
 */
function RostersPanel({
  rosters,
  examples,
  locale,
  tiers,
}: {
  rosters: FirmRosters | null;
  examples: boolean;
  locale: Locale;
  tiers: Record<string, BadgeTier>;
}) {
  const c = getDictionary(locale).admin.supply;
  const memberWord: Record<string, string> = c.memberState;
  const title = c.rostersTitle;
  const day = (iso: string) => formatDate(new Date(iso), locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
  if (!rosters) {
    return (
      <Panel title={title}>
        <Waiting title={c.rostersUnreadTitle} body={c.rostersUnreadBody} />
      </Panel>
    );
  }
  const b = rosters.byStatus;
  return (
    <Panel
      title={title}
      hint={`${fill(c.rostersHint, {
        memberships: plural(rosters.total, c.memberships, locale),
        firms: plural(rosters.firms.length, c.firms, locale),
      })}${!examples && rosters.examplesExcluded > 0 ? fill(c.rostersExcluded, { count: rosters.examplesExcluded }) : ""}`}
    >
      <StatusBar
        locale={locale}
        label={c.membershipsByState}
        segments={[
          { key: "pending", label: c.memberState.pending, count: b.pending, tone: "pending" },
          { key: "active", label: c.memberState.active, count: b.active, tone: "good" },
          { key: "revoked", label: c.memberState.revoked, count: b.revoked, tone: "bad" },
        ]}
      />
      {rosters.firms.length === 0 ? (
        <div className="nf-md-scroll"><table className="nf-md-table mt-md">
          <caption className="sr-only">{c.rostersTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{c.agent}</th>
              <th scope="col">{c.role}</th>
              <th scope="col">{c.state}</th>
              <th scope="col">{c.since}</th>
            </tr>
          </thead>
          <tbody>
            <TableNote
              columns={4}
              note={{
                title: !examples && rosters.examplesExcluded > 0 ? c.noRosterOutside : c.noRoster,
                fills: c.rosterFills,
                creates: c.rosterCreates,
                action: { href: "/admin/businesses", label: c.openBusinessReview },
              }}
            />
          </tbody>
        </table></div>
      ) : (
        rosters.firms.map((firm) => (
          <section key={firm.firmId} className="nf-md-roster mt-md" aria-label={firm.firmName ?? c.aFirm}>
            <div className="nf-md-roster__head">
              <h4 className="nf-md-roster__name">{firm.firmName ?? c.firmNoName}</h4>
              <span className="nf-md-roster__counts">
                {fill(c.firmCounts, { pending: firm.counts.pending, active: firm.counts.active, revoked: firm.counts.revoked })}
              </span>
            </div>
            <div className="nf-md-scroll"><table className="nf-md-table">
              <caption className="sr-only">{fill(c.membersOf, { firm: firm.firmName ?? c.thisFirm })}</caption>
              <thead>
                <tr>
                  <th scope="col">{c.agent}</th>
                  <th scope="col">{c.role}</th>
                  <th scope="col">{c.state}</th>
                  <th scope="col">{c.since}</th>
                </tr>
              </thead>
              <tbody>
                {firm.members.map((m) => (
                  <tr key={m.id}>
                    <td data-label={c.agent}>
                      {m.agentName ?? getDictionary(locale).admin.money.noDisplayName}
                      {m.userId ? <PersonTier tier={tiers[m.userId]} /> : null}
                    </td>
                    <td data-label={c.role}>{m.role === "principal" ? c.principal : m.role === "staff" ? c.staff : m.role}</td>
                    <td data-label={c.state}>
                      <StatusPill tone={MEMBER_TONE[m.status] ?? "neutral"}>
                        {memberWord[m.status] ?? m.status}
                      </StatusPill>
                    </td>
                    <td className="nf-md-date" data-label={c.since}>
                      {m.status === "revoked" && m.revokedAt ? fill(c.revokedOn, { day: day(m.revokedAt) }) : fill(c.admittedOn, { day: day(m.admittedAt) })}
                      {m.status === "revoked" && m.revokeNote ? <span className="nf-md-ref">{m.revokeNote}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        ))
      )}
    </Panel>
  );
}

function GrowthPanel({ supply, locale, now }: { supply: SupplyConsole | null; locale: Locale; now: number }) {
  const t = getDictionary(locale);
  const c = t.admin.supply;
  const ROLE_LABEL = roleLabels(t);
  const series: Series[] = SUPPLY_ROLE_KEYS.map((role, rank) => ({
    name: ROLE_LABEL[role].many,
    values: supply ? supply.growth.map((g) => g.counts[role]) : [],
    rank,
    area: rank === 0,
    dash: ROLE_DASH[role],
  }));
  const legend = <SeriesLegend series={series} />;
  const label = (month: string, year = false) =>
    formatDate(new Date(`${month}-15T12:00:00Z`), locale, {
      month: "short",
      ...(year ? { year: "numeric" } : {}),
      timeZone: "Africa/Lagos",
    });

  if (!supply) {
    return (
      <Panel title={c.growthTitle} aside={legend}>
        <Waiting title={c.unreadTitle} body={c.growthUnreadBody} />
      </Panel>
    );
  }
  if (supply.growth.length < 2) {
    return (
      <Panel title={c.growthTitle} aside={legend}>
        <EmptyChart
          height={220}
          yLabels={["0", "", "", "", ""]}
          xLabels={lastMonths(now, 6).map((m) => label(m))}
          note={{
            title: c.growthNoneTitle,
            fills: c.growthFills,
            creates: c.growthCreates,
            action: { href: "/admin/agents", label: c.openApplications },
          }}
        />
      </Panel>
    );
  }
  return (
    <Panel title={c.growthTitle} aside={legend}>
      <SeriesChart
        locale={locale}
        id="supply-growth"
        xLabels={supply.growth.map((g) => label(g.month))}
        series={series}
        directLabels
        width={380}
        height={300}
        label={c.growthLabel}
        /* Whole counts only: a quarter gridline stays unlabelled (C1 sweep). */
        yLabel={(v) => (Number.isInteger(v) ? String(v) : "")}
        readout={supply.growth.map((g) => ({
          title: label(g.month, true),
          rows: SUPPLY_ROLE_KEYS.map((role) => ({ label: ROLE_LABEL[role].many, value: String(g.counts[role]) })),
        }))}
      />
    </Panel>
  );
}

function SupplyHead({ c }: { c: Dictionary["admin"]["supply"] }) {
  return (
    <thead>
      <tr>
        <th scope="col">{c.name}</th>
        <th scope="col">{c.role}</th>
        <th scope="col" className="nf-md-num">
          {c.listings}
        </th>
        <th scope="col">{c.verified}</th>
        <th scope="col" className="nf-md-num">
          {c.transacted}
        </th>
        <th scope="col" className="nf-md-num">
          {c.joined}
        </th>
      </tr>
    </thead>
  );
}
