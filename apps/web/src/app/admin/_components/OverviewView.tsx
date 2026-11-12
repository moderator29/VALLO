import { formatDate, formatMoney, formatNumber, getDictionary, type Locale } from "@vallo/i18n";
import { tx } from "@/app/admin/_components/shell-text";
import { AreaTimeChart } from "@/components/agent/charts/AreaTimeChart";
import { GroupedBarChart } from "@/components/agent/charts/GroupedBarChart";
import { MeterBar } from "@/components/agent/charts/MeterBar";
import type { AlertView } from "@/lib/admin/queries";
import type {
  CollectedRange,
  CollectedSeries,
  ConsolePulse,
  JobHealth,
  ListingsByRole,
  SupplyByType,
} from "./console-shapes";
import { alertBadge, alertSubline, niceTicks, periodDelta, sinceLabel } from "./metrics";
import {
  AlertList,
  CalmNote,
  EmptyChart,
  KpiGrid,
  KpiStrip,
  PageHead,
  Panel,
  PanelLink,
  PanelUnavailable,
  type AlertRow,
  type KpiItem,
} from "./panels";
import { RangeSelect } from "./RangeSelect";
import { currentDestination, labelFor, type ShellCopy } from "./nav";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { QueueByDesk } from "./QueueByDesk";
import { QueueFigures } from "./QueueFigures";
import { StaffDoor } from "./StaffDoor";
import type { OverviewCounts } from "./ConsoleOverview";

/** "You were heading to Money": the desk the address asked for, one tap away. */
function HeadingTo({ href, copy, shell }: { href: string; copy: { headingTo: string; continue: string }; shell: ShellCopy }) {
  const desk = currentDestination(href.split("?")[0] ?? href);
  return (
    // A plain link to the desk: by the time the overview is on screen the
    // entry cookie is set (by the overview in the browser, or by
    // `/admin/enter` with JavaScript off), so the desk opens directly.
    <a href={href} className="nf-admin-heading-to">
      <span className="nf-admin-heading-to__text">
        <span className="nf-admin-heading-to__over">{copy.headingTo}</span>
        <span className="nf-admin-heading-to__desk">{desk ? labelFor(desk, shell) : href}</span>
      </span>
      <span className="nf-admin-heading-to__go">
        {copy.continue}
        <UiIcon name="arrow-right" size={16} />
      </span>
    </a>
  );
}

/**
 * THE OVERVIEW, drawn from 5EAA44CB: the pulse strip, four KPI cards, the
 * money area chart with its range, supply by type, new listings per month by
 * who listed them, and the recent alerts.
 *
 * Every figure arrives as a prop from `admin/page.tsx`, which reads it under
 * the admin gate through `lib/admin/reads/overview.ts` and friends. A read
 * that failed arrives as null and its tile or panel says so. Nothing here
 * computes a number that was not handed to it, and no trend is drawn without
 * both periods behind it.
 */
export type OverviewProps = {
  locale: Locale;
  now: number;
  range: CollectedRange;
  /** R-E: the desk address the operator arrived at before being sent here. */
  headingTo?: string | null;
  /** `getQueueCounts().listings`: submitted, under review or approved and not yet live. */
  openReviews: number | null;
  pulse: ConsolePulse | null;
  collected: CollectedSeries | null;
  supply: SupplyByType | null;
  byRole: ListingsByRole | null;
  jobs: JobHealth | null;
  alerts: AlertView[] | "unavailable";
  /** The seven desks' waiting counts (`getQueueCounts`), or null when unread. */
  queue?: OverviewCounts | null;
};

export function alertRows(alerts: readonly AlertView[], now: number, locale: Locale): AlertRow[] {
  return alerts.map((alert) => {
    const badge = alertBadge(alert.severity, alert.status);
    const icon =
      badge.tone === "success"
        ? "check-circle"
        : badge.tone === "error"
          ? "alert-triangle"
          : "info-circle";
    return {
      id: alert.id,
      title: alert.title,
      sub: alertSubline(alert.description, alert.entityType),
      when: sinceLabel(alert.createdAt, now, (d) =>
        formatDate(d, locale, { timeZone: "Africa/Lagos", day: "numeric", month: "short" }),
      ),
      tone: badge.tone,
      word: badge.word,
      icon: { tier: "admin", name: icon },
      href: `/admin/alerts${alert.status === "resolved" ? "?status=resolved" : ""}`,
    };
  });
}

function jobsHealthy(jobs: JobHealth): { healthy: number; total: number } {
  const active = jobs.jobs.filter((job) => job.active);
  const healthy = active.filter((job) => !job.stale && job.lastOutcome !== null && job.lastOutcome !== "failed");
  return { healthy: healthy.length, total: active.length };
}

export function OverviewView(props: OverviewProps) {
  const { locale, pulse } = props;
  const shell = getDictionary(locale).admin.shell;
  const c = shell.overview;
  const n = (value: number) => formatNumber(value, locale);
  const money = (minor: number) => formatMoney(minor, locale);
  const pending = (what: string) => `${what} did not load; it retries every minute`;
  const days = pulse?.daily ?? [];
  const spark = (id: string, pick: (d: ConsolePulse["daily"][number]) => number, label: string) =>
    pulse ? { id, values: days.map(pick), label } : null;
  const jobs = props.jobs ? jobsHealthy(props.jobs) : null;

  const strip: KpiItem[] = [
    {
      key: "live",
      icon: { tier: "admin", name: "clipboard" },
      label: c.listingsLive,
      value: pulse ? n(pulse.listingsLive) : null,
      count: pulse?.listingsLive,
      locale,
      delta: pulse ? periodDelta(pulse.listingsLive, pulse.listingsLiveWeekAgo) : null,
      spark: spark("strip-live", (d) => d.liveAtClose, "Live listings, last 14 days"),
      pending: pending("This figure"),
    },
    {
      key: "signups",
      icon: { tier: "ui", name: "user" },
      label: c.signupsToday,
      value: pulse ? n(pulse.signupsToday) : null,
      count: pulse?.signupsToday,
      locale,
      delta: pulse ? periodDelta(pulse.signupsToday, pulse.signupsYesterday) : null,
      spark: spark("strip-signups", (d) => d.signups, "Sign-ups, last 14 days"),
      caption:
        pulse && typeof pulse.peopleTotal === "number"
          ? tx(locale, "ovPeopleInAll").replace("{count}", n(pulse.peopleTotal))
          : undefined,
      pending: pending("This figure"),
    },
    {
      key: "collected-today",
      icon: { tier: "admin", name: "naira" },
      label: c.collectedToday,
      value: pulse ? money(pulse.collectedTodayMinor) : null,
      minor: pulse?.collectedTodayMinor,
      locale,
      delta: pulse ? periodDelta(pulse.collectedTodayMinor, pulse.collectedYesterdayMinor) : null,
      spark: spark("strip-collected", (d) => d.collectedMinor, "Naira collected, last 14 days"),
      pending: pending("This figure"),
    },
    {
      key: "jobs",
      icon: { tier: "admin", name: "shield-check" },
      label: c.jobsHealthy,
      value: jobs && jobs.total > 0 ? `${Math.round((jobs.healthy / jobs.total) * 100)}%` : null,
      caption: jobs ? c.jobsOf.replace("{healthy}", String(jobs.healthy)).replace("{total}", String(jobs.total)) : undefined,
      pending: pending("The job reads"),
    },
  ];

  const cards: KpiItem[] = [
    {
      key: "live-card",
      icon: { tier: "ui", name: "home" },
      label: c.liveListings,
      value: pulse ? n(pulse.listingsLive) : null,
      count: pulse?.listingsLive,
      locale,
      delta: pulse ? periodDelta(pulse.listingsLive, pulse.listingsLiveWeekAgo) : null,
      caption: pulse ? c.vsLastWeek : c.examplesNotCounted,
      spark: spark("card-live", (d) => d.liveAtClose, "Live listings, last 14 days"),
      href: "/admin/listings",
      pending: pending("This figure"),
    },
    {
      key: "supply-card",
      icon: { tier: "ui", name: "plus" },
      label: c.newSupply,
      value: pulse ? n(pulse.newSupplyWeek) : null,
      count: pulse?.newSupplyWeek,
      locale,
      delta: pulse ? periodDelta(pulse.newSupplyWeek, pulse.newSupplyPrevWeek) : null,
      caption: c.vsLastWeek,
      spark: spark("card-supply", (d) => d.submitted, "Listings submitted, last 14 days"),
      href: "/admin/supply",
      pending: pending("This figure"),
    },
    {
      key: "collected-card",
      icon: { tier: "admin", name: "naira" },
      label: c.collected,
      value: pulse ? money(pulse.collectedWeekMinor) : null,
      minor: pulse?.collectedWeekMinor,
      locale,
      delta: pulse ? periodDelta(pulse.collectedWeekMinor, pulse.collectedPrevWeekMinor) : null,
      caption: c.vsLastWeek,
      spark: spark("card-collected", (d) => d.collectedMinor, "Naira collected, last 14 days"),
      href: "/admin/money",
      pending: pending("This figure"),
    },
    {
      key: "reviews-card",
      icon: { tier: "ui", name: "document" },
      label: c.openReviews,
      value: props.openReviews === null ? null : n(props.openReviews),
      ...(props.openReviews === null ? {} : { count: props.openReviews }),
      locale,
      /* No delta: an open count has no history to compare against until
         something snapshots it. The caption says what the number is instead. */
      delta: null,
      caption: c.waitingDecision,
      spark: spark("card-reviews", (d) => d.submitted, "Listings submitted, last 14 days"),
      href: "/admin/listings",
      pending: pending("The queue count"),
    },
  ];

  return (
    <div className="nf-admin-stack">
      {/* The console's one header (`PageHead`, AD-01): the overview opens on
          the same title every desk does. It was a screen-reader-only h1. */}
      <PageHead title={c.title} />
      {props.headingTo && <HeadingTo href={props.headingTo} copy={shell.entry} shell={shell} />}
      {/* The overview's first answer: what is waiting on a person, as figures. */}
      <QueueFigures t={getDictionary(locale)} locale={locale} counts={props.queue ?? null} />
      {/* The way into the staff desk, beside the figures rather than among
          them: it has no queue and no count (see StaffDoor). */}
      <StaffDoor />
      <KpiStrip items={strip} label={c.pulse} />
      <KpiGrid items={cards} label={c.week} />

      {/* Needs attention and the queue by desk (plan item 14): drawn from
          the same counts as the rail's badges, and left out when those
          counts could not be read. */}
      {props.queue ? <QueueByDesk t={getDictionary(locale)} locale={locale} counts={props.queue} /> : null}

      <div className="nf-admin-grid nf-admin-grid--wide-left">
        <Panel id="ov-collected" title={c.chartTitle}>
          {/* Reference 5 and D74: the range pill, then the one big figure
              with its unit in grey, then the smooth curve. */}
          <RangeSelect
            value={props.range}
            options={{ "30d": c.range30, "90d": c.range90, "12m": c.range12 }}
            short={{ "30d": "30 days", "90d": "90 days", "12m": "12 months" }}
            label={c.chartTitle}
          />
          <CollectedChart series={props.collected} locale={locale} rangeWords={{ "30d": c.range30, "90d": c.range90, "12m": c.range12 }} />
        </Panel>

        <Panel id="ov-supply" title={c.supplyTitle}>
          <SupplyTable supply={props.supply} locale={locale} />
        </Panel>
      </div>

      <div className="nf-admin-grid nf-admin-grid--wide-left">
        <Panel id="ov-roles" title={c.rolesTitle}>
          <RoleChart byRole={props.byRole} locale={locale} />
        </Panel>

        <Panel id="ov-alerts" title={c.alertsTitle} action={<PanelLink href="/admin/alerts">{shell.states.viewAll}</PanelLink>}>
          {props.alerts === "unavailable" ? (
            <PanelUnavailable what={tx(locale, "ovTheAlertDesk")} locale={locale} />
          ) : props.alerts.length === 0 ? (
            <CalmNote
              kind="clear"
              title={c.noAlertsTitle}
              fills={c.noAlertsFills}
              creates={c.noAlertsCreates}
              action={{ href: "/admin/operations", label: "Open Operations" }}
            />
          ) : (
            <AlertList rows={alertRows(props.alerts.slice(0, 5), props.now, locale)} />
          )}
        </Panel>
      </div>
    </div>
  );
}

function monthTick(start: string, locale: Locale, withYear = false): string {
  const date = new Date(`${start.length === 7 ? `${start}-01` : start}T12:00:00+01:00`);
  return formatDate(date, locale, {
    timeZone: "Africa/Lagos",
    month: "short",
    ...(withYear ? { year: "numeric" } : null),
  });
}

function dayTick(start: string, locale: Locale, withYear = false): string {
  const date = new Date(`${start}T12:00:00+01:00`);
  return formatDate(date, locale, {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : null),
  });
}

/**
 * The figure as reference 5 and D74 set it: the number in full ink, the unit
 * (the naira sign) softer, the same size. Split on the first digit, so a
 * locale that writes the sign after the number keeps it after.
 */
function HeroAmount({ text }: { text: string }) {
  const first = text.search(/\d/);
  const last = text.search(/\d[^\d]*$/);
  if (first < 0) return <span className="nf-admin-hero__figure nf-numeric">{text}</span>;
  return (
    <span className="nf-admin-hero__figure nf-numeric">
      {first > 0 ? <span className="nf-admin-hero__unit">{text.slice(0, first)}</span> : null}
      {text.slice(first, last + 1)}
      {last + 1 < text.length ? <span className="nf-admin-hero__unit">{text.slice(last + 1)}</span> : null}
    </span>
  );
}

function CollectedChart({
  series,
  locale,
  rangeWords,
}: {
  series: CollectedSeries | null;
  locale: Locale;
  rangeWords: Record<CollectedSeries["range"], string>;
}) {
  const c = getDictionary(locale).admin.shell.overview;
  if (!series) {
    return <PanelUnavailable what={tx(locale, "ovMoneyCollectedOverTime")} locale={locale} />;
  }
  const total = series.buckets.reduce((sum, b) => sum + b.amountMinor, 0);
  const monthly = series.range === "12m";
  if (total === 0) {
    return (
      <EmptyChart
        height={220}
        yLabels={niceTicks(100_000_000).map((v) => formatMoney(v, locale, "NGN", { compact: true }))}
        xLabels={series.buckets.map((b, i) =>
          monthly || i % (series.range === "90d" ? 3 : 7) === 0 ? (monthly ? monthTick(b.start, locale) : dayTick(b.start, locale)) : "",
        )}
        note={{
          title: c.emptyMoneyTitle,
          fills: c.emptyMoneyFills,
          creates: c.emptyMoneyCreates,
          action: { href: "/admin/money", label: "Open Money" },
        }}
      />
    );
  }
  const payments = series.buckets.reduce((sum, b) => sum + b.count, 0);
  const ticks = niceTicks(Math.max(...series.buckets.map((b) => b.amountMinor)));
  const points = series.buckets.map((b) => ({
    key: b.start,
    tick: monthly ? monthTick(b.start, locale) : dayTick(b.start, locale),
    readout: monthly ? monthTick(b.start, locale, true) : dayTick(b.start, locale, true),
    value: b.amountMinor,
    display: `${formatMoney(b.amountMinor, locale)} · ${formatNumber(b.count, locale)} payments`,
  }));
  return (
    <>
      <div className="nf-admin-hero" data-testid="ov-collected-figure">
        <HeroAmount text={formatMoney(total, locale)} />
        <span className="nf-admin-hero__label">
          {rangeWords[series.range]} · {formatNumber(payments, locale)} payments
        </span>
      </div>
      <AreaTimeChart
        points={points}
        yTicks={ticks.map((v) => ({ value: v, label: formatMoney(v, locale, "NGN", { compact: true }) }))}
        label={c.chartTitle}
        height={220}
        tickEvery={monthly ? 1 : series.range === "90d" ? 2 : 5}
      />
    </>
  );
}

function SupplyTable({ supply, locale }: { supply: SupplyByType | null; locale: Locale }) {
  const c = getDictionary(locale).admin.shell.overview;
  if (!supply) {
    return <PanelUnavailable what={tx(locale, "ovSupplyByType")} locale={locale} />;
  }
  const empty = supply.total === 0;
  const rows = [...supply.rows].sort((a, b) => b.count - a.count);
  const max = rows[0]?.count ?? 0;
  return (
    <div className="nf-admin-dist" role="table" aria-label="Supply by type">
      <div className="nf-admin-dist__row nf-admin-dist__row--head" role="row">
        <span role="columnheader">Type</span>
        <span role="columnheader" className="nf-admin-dist__num">Count</span>
        <span role="columnheader" className="nf-admin-dist__num">%</span>
        <span role="columnheader" className="sr-only">Share</span>
      </div>
      {rows.map((row, i) => {
        const share = supply.total > 0 ? Math.round((row.count / supply.total) * 100) : 0;
        return (
          <div key={row.kind} className="nf-admin-dist__row" role="row">
            <span className="nf-admin-dist__name" role="cell">
              <span className="nf-admin-dist__dot" style={{ opacity: [1, 0.84, 0.69, 0.55, 0.42][Math.min(i, 4)] }} aria-hidden="true" />
              {c.kinds[row.kind]}
            </span>
            <span className="nf-admin-dist__num nf-numeric" role="cell">{formatNumber(row.count, locale)}</span>
            <span className="nf-admin-dist__num nf-numeric" role="cell">{share}%</span>
            <span role="cell">
              <MeterBar value={row.count} max={max} rank={i} />
            </span>
          </div>
        );
      })}
      {empty && (
        <div className="nf-admin-dist__note">
          <CalmNote
            title={c.emptySupplyTitle}
            fills={c.emptySupplyFills}
            creates={c.emptySupplyCreates}
            action={{ href: "/admin/listings", label: "Open the listings queue" }}
          />
        </div>
      )}
    </div>
  );
}

function RoleChart({ byRole, locale }: { byRole: ListingsByRole | null; locale: Locale }) {
  const c = getDictionary(locale).admin.shell.overview;
  if (!byRole) {
    return <PanelUnavailable what={tx(locale, "ovNewListingsByListerRole")} locale={locale} />;
  }
  const total = byRole.months.reduce((sum, m) => sum + m.owner + m.agent + m.firm, 0);
  if (total === 0) {
    return (
      <EmptyChart
        height={200}
        yLabels={niceTicks(10, 5).map((v) => String(v))}
        legend={[c.owner, c.agent, c.firm]}
        xLabels={byRole.months.map((m) => monthTick(m.month, locale))}
        note={{
          title: c.emptyRolesTitle,
          fills: c.emptyRolesFills,
          creates: c.emptyRolesCreates,
          action: { href: "/admin/supply", label: "Open Supply" },
        }}
      />
    );
  }
  const max = Math.max(...byRole.months.flatMap((m) => [m.owner, m.agent, m.firm]));
  return (
    <GroupedBarChart
      label={c.rolesTitle}
      series={[
        { key: "owner", label: c.owner },
        { key: "agent", label: c.agent },
        { key: "firm", label: c.firm },
      ]}
      groups={byRole.months.map((m) => ({
        key: m.month,
        tick: monthTick(m.month, locale),
        readout: monthTick(m.month, locale, true),
        values: [m.owner, m.agent, m.firm],
      }))}
      yTicks={niceTicks(max).map((v) => ({ value: v, label: formatNumber(v, locale) }))}
      height={200}
    />
  );
}
