import {
  formatDate,
  formatMoney,
  formatNumber,
  formatRating,
  type Dictionary,
  type Locale,
} from "@vallo/i18n/core";
import { fill } from "../_copy";
import type {
  AgentAnalytics,
  CalendarPressure,
  ListingPerformance,
  RequestOutcomes,
  SettledPoint,
} from "@/lib/agent/analytics-queries";
import { CALENDAR_WINDOW_NIGHTS } from "@/lib/agent/analytics-queries";
import { HOLD_WINDOW_HOURS } from "@/lib/agent/bookings-model";
import type { ListingStatus } from "@/lib/agent/listings-queries";
import { Amount, Figure } from "@/components/ui/Amount";
import { Progress } from "@/components/ui/Progress";
import { ButtonLink } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Icon3D } from "@/components/ui/Icon3D";
import { PeriodBars } from "@/components/ui/charts/PeriodBars";
import { absentMonths, lagosMonth, monthPoint, moneyTicks } from "@/components/agent/charts/month-points";
import { State } from "@/components/ui/State";

/**
 * The agent's analytics console.
 *
 * A server component, like the earnings workspace beside it: nothing on this
 * screen mutates anything, so there is no reason to ship any of it as client
 * JavaScript. Every figure arrives already computed by analytics-queries.ts and
 * this file only decides how to draw it. That split is deliberate rather than
 * tidy: the rules about which numbers may exist belong in one file, and a
 * component that did its own arithmetic on the way to the screen would be a
 * second place for one of them to be broken.
 *
 * THE RULE THIS WHOLE FILE OBEYS. A missing figure is drawn as missing. There
 * is no branch anywhere below that substitutes a zero, an average, a dash
 * standing in for a plausible value, or a bar of nominal height so a chart does
 * not look bare. When a read failed the panel says it could not be read; when a
 * read succeeded and found nothing, the panel says there is nothing. Those two
 * sentences are different and the screen never blurs them, because a host who
 * reads "no requests" during an outage will conclude their listings are dead.
 */

export type AnalyticsCopy = Dictionary["agentAnalytics"];

/**
 * "1 hour" and "{count} hours", borrowed from the bookings card.
 *
 * Passed in rather than re-keyed under agentAnalytics because those two
 * sentences already exist, correctly, in all four languages. Adding a second
 * pair would mean three more translations of a phrase this repository has
 * already translated, and the two copies would eventually disagree.
 */
export type HoursCopy = { one: string; other: string };

/* --------------------------------------------------------------- fragments */

/**
 * A headline tile.
 *
 * Not the agent dashboard's stat tile, which required a signed
 * month-over-month delta on every instance. That component has since been
 * deleted, because it turned out to have no caller in the product once the
 * preview screenshot that was keeping it alive stopped drawing it; this note
 * survives because the REASON it was refused still governs this file. There
 * is no honest delta available
 * for three of these four figures: a lifetime total has nothing to compare
 * against, a rating moves so slowly that a month's change is mostly noise, and
 * a forward calendar figure has no previous value at all. A tile that demanded
 * one would have been fed an invented number, which is the exact failure this
 * screen exists to avoid.
 *
 * The figure is never truncated. A clipped number is not a shortened number, it
 * is a wrong one, so the tile grows and the digits stay whole.
 */
function Tile({
  icon,
  label,
  value,
  note,
}: {
  icon: UiIconName;
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    /* The figure tile of reference 45 (section 17): label first with its
       lean glyph, the big figure, then the quiet note. `.nf-kpi` material. */
    <div className="nf-kpi">
      <p className="nf-kpi__head">
        <UiIcon name={icon} size={16} className="nf-kpi__glyph" />
        <span className="nf-kpi__label">{label}</span>
      </p>
      <p className="nf-kpi__figure">{value}</p>
      {note ? <p className="nf-kpi__sub">{note}</p> : null}
    </div>
  );
}

/** The size and weight every headline figure is set at. */
const TILE_FIGURE =
  "text-[length:var(--nf-text-h4)] font-semibold tracking-tight text-[var(--nf-content-primary)] sm:text-[length:var(--nf-text-h3)]";

/**
 * What a tile shows when its own source could not be read.
 *
 * Set in the muted tone at the same size as a figure, so the tile keeps its
 * shape in the grid and the absence reads as an absence rather than as a
 * rendering fault. It is deliberately not a zero and deliberately not a dash.
 */
function Unknown({ label }: { label: string }) {
  return (
    <span className="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-muted)]">{label}</span>
  );
}

/**
 * A panel whose read failed.
 *
 * The warning surface rather than the error surface: nothing is broken for the
 * host and nothing they did caused it, the platform simply cannot answer right
 * now. Both tokens are real ones from tokens.css.
 */
function Unavailable({ children }: { children: string }) {
  return (
    <p
      className="rounded-[var(--nf-container-radius)] p-md text-[length:var(--nf-text-caption)] font-semibold leading-relaxed"
      style={{ background: "var(--nf-state-warning-surface)", color: "var(--nf-state-warning)" }}
      role="status"
    >
      {children}
    </p>
  );
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="nf-panel nf-panel--card block p-md sm:p-panel">
      <h2 className="nf-h3">{title}</h2>
      {blurb ? (
        <p className="mt-xs max-w-[68ch] text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {blurb}
        </p>
      ) : null}
      <div className="mt-md">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ trend */

function monthLabel(point: SettledPoint, locale: Locale, style: "short" | "long"): string {
  const date = new Date(Date.UTC(point.year, Math.max(0, point.month - 1), 1));
  return style === "short"
    ? formatDate(date, locale, { month: "short" })
    : formatDate(date, locale, { month: "long", year: "numeric" });
}

/**
 * Settled money by month, as bars, on the chart system (B-26).
 *
 * BARS RATHER THAN A LINE. A monthly settled total is a discrete bucket, not
 * a continuous signal. A line draws a value for every instant between two
 * months, so a host reading it halfway between June and August sees a figure
 * that was never true of any day, and the smoothing flatters a jagged history
 * into a trend. Bars can only claim what actually happened (chart rule 1).
 *
 * The rules this panel used to carry by hand now live in `PeriodBars`: a
 * month that settled nothing is no bar (the ledger is complete, so zero is a
 * fact), a genuinely tiny month is never drawn as nothing (the 2px floor),
 * the best month is labelled at its tip, and every month reaches the table
 * twin with its amount. The peak sentence stays under it, because it is the
 * scale in words and a reader without the picture gets it too.
 *
 * NOTHING SETTLED YET (reference 7083): the six months ending now are drawn
 * as hatched slots with the existing empty sentence over them, so a young
 * account sees the frame its history will fill rather than a bare line of
 * text. The slots are periods, never amounts.
 */
function SettledTrend({
  t,
  points,
  locale,
}: {
  t: AnalyticsCopy;
  points: SettledPoint[];
  locale: Locale;
}) {
  if (points.length === 0) {
    return (
      <PeriodBars
        points={absentMonths(lagosMonth(new Date()), 6, locale)}
        yTicks={[]}
        label={t.trend.title}
        periodHead={t.trend.title}
        valueHead={t.headline.settled}
        empty={t.trend.empty}
      />
    );
  }

  const peak = points.reduce((most, point) => Math.max(most, point.agentShareMinor), 0);
  if (peak <= 0) {
    return <State compact kind="empty" icon="chart-growth" title={t.trend.empty} />;
  }

  const best = points.reduce((top, point) =>
    point.agentShareMinor > top.agentShareMinor ? point : top,
  );
  const viz = points.map((point) =>
    monthPoint({ key: point.key, year: point.year, month: point.month, minor: point.agentShareMinor }, locale),
  );
  const peakLine = `${t.trend.peak}: ${monthLabel(best, locale, "long")}, ${formatMoney(best.agentShareMinor, locale)}`;

  return (
    <div>
      <PeriodBars
        points={viz}
        yTicks={moneyTicks(viz, locale)}
        label={t.trend.title}
        summary={peakLine}
        periodHead={t.trend.title}
        valueHead={t.headline.settled}
        emphasis="peak"
      />

      {/* The scale, stated: name the tallest bar and every other one can be
          read against it, with or without the picture. */}
      <p className="mt-sm text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
        {t.trend.peak}: <span className="font-semibold">{monthLabel(best, locale, "long")}</span>
        {", "}
        <Amount
          minorUnits={best.agentShareMinor}
          locale={locale}
          className="font-semibold text-[var(--nf-content-primary)]"
        />
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- requests */

/**
 * One outcome and its count.
 *
 * `alarm` is only ever passed for the unanswered group, and only lights up when
 * that group is non-empty. A permanently red row would teach a host to ignore
 * the colour; a row that turns red the day something is actually going wrong
 * keeps meaning something.
 */
function OutcomeRow({
  label,
  count,
  locale,
  alarm = false,
}: {
  label: string;
  count: number;
  locale: Locale;
  alarm?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-md border-b border-[var(--nf-border-subtle)] py-xs last:border-b-0">
      <span className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">{label}</span>
      <Figure
        value={count}
        locale={locale}
        className={
          alarm
            ? "text-[length:var(--nf-text-body-sm)] font-bold text-[var(--nf-state-error)]"
            : "text-[length:var(--nf-text-body-sm)] font-bold text-[var(--nf-content-primary)]"
        }
      />
    </li>
  );
}

function RequestsPanel({
  t,
  hours,
  outcomes,
  locale,
}: {
  t: AnalyticsCopy;
  hours: HoursCopy;
  outcomes: RequestOutcomes;
  locale: Locale;
}) {
  if (outcomes.received === 0) {
    return <State compact kind="empty" icon="chat-duo" title={t.requests.empty} />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ul>
        <OutcomeRow label={t.requests.received} count={outcomes.received} locale={locale} />
        <OutcomeRow label={t.requests.confirmed} count={outcomes.confirmed} locale={locale} />
        <OutcomeRow label={t.requests.cancelled} count={outcomes.cancelled} locale={locale} />
        <OutcomeRow label={t.requests.waiting} count={outcomes.waiting} locale={locale} />
        <OutcomeRow
          label={t.requests.lapsed}
          count={outcomes.lapsed}
          locale={locale}
          alarm={outcomes.lapsed > 0}
        />
      </ul>

      <div>
        <h3 className="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">
          {t.requests.answerTitle}
        </h3>
        {/* Three states, not two. "We could not read your history" and "you
            have answered nothing" arrive at the same empty median, and telling
            a host the second when the first happened is a false statement
            about their own conduct. */}
        {!outcomes.answerTimingReadable ? (
          <p className="mt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
            {t.requests.answerUnavailable}
          </p>
        ) : outcomes.medianAnswerHours === null ? (
          <p className="mt-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
            {t.requests.answerNone}
          </p>
        ) : (
          <>
            {/* The phrase, not a bare number with a unit glued on. "3 hours"
                is written differently in the four languages this ships in, and
                the two strings that already say it correctly live on the
                bookings card, so they are reused rather than retranslated. */}
            <p className="nf-numeric mt-2xs text-[length:var(--nf-text-h4)] font-bold tracking-tight text-[var(--nf-content-primary)]">
              {outcomes.medianAnswerHours === 1
                ? hours.one
                : fill(hours.other, {
                    count: formatNumber(outcomes.medianAnswerHours, locale),
                  })}
            </p>
            <p className="mt-xs max-w-[46ch] text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
              {outcomes.answered === 1
                ? t.requests.answerBodyOne
                : fill(t.requests.answerBody, { count: formatNumber(outcomes.answered, locale) })}
            </p>
          </>
        )}

        {/* Only drawn when there is something to explain. A host with nothing
            lapsed does not need a paragraph about a failure mode they have
            never had. */}
        {outcomes.lapsed > 0 ? (
          <p className="mt-md max-w-[46ch] text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
            {fill(t.requests.lapsedNote, { hours: HOLD_WINDOW_HOURS })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- calendar */

function CalendarPanel({
  t,
  calendar,
  locale,
}: {
  t: AnalyticsCopy;
  calendar: CalendarPressure;
  locale: Locale;
}) {
  if (calendar.listings === 0) {
    return <State compact kind="empty" icon="calendar-check" title={t.calendar.none} />;
  }

  const open = Math.max(0, calendar.offeredNights - calendar.bookedNights - calendar.blockedNights);

  return (
    <div>
      <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
        {calendar.listings === 1
          ? fill(t.calendar.bodyOne, { offered: formatNumber(calendar.offeredNights, locale) })
          : fill(t.calendar.body, {
              count: formatNumber(calendar.listings, locale),
              offered: formatNumber(calendar.offeredNights, locale),
            })}
      </p>

      {/* The accessible name and the value text are both supplied, because a
          progressbar announcing a bare percentage would say "twenty per cent"
          with no subject. */}
      <Progress
        className="mt-sm"
        value={calendar.bookedNights}
        max={calendar.offeredNights}
        label={t.calendar.booked}
        valueText={`${formatNumber(calendar.bookedNights, locale)} / ${formatNumber(
          calendar.offeredNights,
          locale,
        )}`}
        showValue
        locale={locale}
      />

      <ul className="mt-sm grid grid-cols-3 gap-sm">
        <li>
          <p className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{t.calendar.booked}</p>
          <Figure
            value={calendar.bookedNights}
            locale={locale}
            className="text-[length:var(--nf-text-body-sm)] font-bold text-[var(--nf-content-primary)]"
          />
        </li>
        <li>
          <p className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{t.calendar.blocked}</p>
          <Figure
            value={calendar.blockedNights}
            locale={locale}
            className="text-[length:var(--nf-text-body-sm)] font-bold text-[var(--nf-content-primary)]"
          />
        </li>
        <li>
          <p className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{t.calendar.open}</p>
          <Figure
            value={open}
            locale={locale}
            className="text-[length:var(--nf-text-body-sm)] font-bold text-[var(--nf-content-primary)]"
          />
        </li>
      </ul>

      {calendar.blockedNights > 0 ? (
        <p className="mt-sm max-w-[62ch] text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {t.calendar.blockedNote}
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- listings */

function ratingCell(
  t: AnalyticsCopy,
  row: ListingPerformance,
  locale: Locale,
): React.ReactNode {
  if (row.rating === null || row.reviews === 0) {
    return <span className="text-[var(--nf-content-muted)]">{t.listings.noRating}</span>;
  }
  const rating = formatRating(row.rating, locale);
  return row.reviews === 1
    ? fill(t.listings.ratingWithOne, { rating })
    : fill(t.listings.ratingWith, { rating, count: formatNumber(row.reviews, locale) });
}

function ListingsPanel({
  t,
  statusLabels,
  rows,
  locale,
}: {
  t: AnalyticsCopy;
  statusLabels: Record<ListingStatus, string>;
  rows: ListingPerformance[];
  locale: Locale;
}) {
  if (rows.length === 0) {
    return <State compact kind="empty" icon="home-ring" title={t.listings.empty} />;
  }

  return (
    <>
      {/*
        Phone: stacked cards, not a shrunken table.

        This is the same decision the earnings ledger made and for the same
        reason. Six columns on a 390px screen either scroll sideways or shrink
        their figures, and neither is how somebody compares two properties.
        Both branches read the identical rows, so the two renderings can never
        disagree about a number.
      */}
      <ul className="space-y-sm sm:hidden">
        {rows.map((row) => (
          <li
            key={row.listingId}
            className="nf-panel nf-panel--card block p-sm"
          >
            <div className="flex items-baseline justify-between gap-sm">
              <p className="min-w-0 flex-1 text-[length:var(--nf-text-body-sm)] font-semibold">{row.title}</p>
              <Amount
                minorUnits={row.settledShareMinor}
                locale={locale}
                className="text-[length:var(--nf-text-body-sm)] font-bold"
              />
            </div>
            <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {statusLabels[row.status]}
              {" · "}
              {t.listings.columnRequests} {formatNumber(row.requests, locale)}
              {" · "}
              {t.listings.columnConfirmed} {formatNumber(row.confirmed, locale)}
              {" · "}
              {t.listings.columnNights} {formatNumber(row.nightsSold, locale)}
              {row.savedSignedIn !== null && (
                <>
                  {" · "}
                  {t.listings.saved} {formatNumber(row.savedSignedIn, locale)}
                </>
              )}
            </p>
            <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {ratingCell(t, row, locale)}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <Table caption={t.listings.title} density="compact">
          <THead>
            <TR>
              <TH>{t.listings.columnListing}</TH>
              <TH align="end">{t.listings.columnRequests}</TH>
              <TH align="end">{t.listings.columnConfirmed}</TH>
              <TH align="end">{t.listings.columnNights}</TH>
              <TH align="end">{t.listings.columnSettled}</TH>
              {/* The header carries "signed in" rather than a footnote doing
                  it, because a column called Saved beside a low number tells a
                  host their listing is unwanted, when what they are seeing is
                  how many people bothered to make an account. */}
              <TH align="end">{t.listings.saved}</TH>
              <TH>{t.listings.columnRating}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.listingId}>
                <TD className="font-semibold text-[var(--nf-content-primary)]">
                  {row.title}
                  <span className="block text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-muted)]">
                    {statusLabels[row.status]}
                  </span>
                </TD>
                <TD align="end">{formatNumber(row.requests, locale)}</TD>
                <TD align="end">{formatNumber(row.confirmed, locale)}</TD>
                <TD align="end">{formatNumber(row.nightsSold, locale)}</TD>
                <TD align="end" className="font-semibold text-[var(--nf-content-primary)]">
                  <Amount minorUnits={row.settledShareMinor} locale={locale} />
                </TD>
                <TD align="end">
                  {/* Null is "could not be read", zero is "nobody has". A dash
                      for the first rather than a nought, which would say
                      nobody wants it. */}
                  {row.savedSignedIn === null ? (
                    <span className="text-[var(--nf-content-muted)]">&ndash;</span>
                  ) : (
                    formatNumber(row.savedSignedIn, locale)
                  )}
                </TD>
                <TD>{ratingCell(t, row, locale)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ screen */

export function AnalyticsWorkspace({
  t,
  hours,
  statusLabels,
  analytics,
  locale,
  funnels = null,
  viewsLine,
  absent = [],
  hero = null,
}: {
  t: AnalyticsCopy;
  hours: HoursCopy;
  statusLabels: Record<ListingStatus, string>;
  analytics: AgentAnalytics;
  locale: Locale;
  /** V-73: the per-listing funnel panel, when the counting is running. */
  funnels?: React.ReactNode;
  /** V-73: replaces the "views are not counted" line once they are. */
  viewsLine?: string;
  /**
   * J3 (Space Analytics): the register's metrics no table counts (unique
   * viewers, engaged views, shares, contact reveals), named in the same panel
   * as the other absences so there is one place that says what is not here.
   */
  absent?: string[];
  /**
   * J3: the Space Analytics card (period, headline figure, one chart, every
   * figure as a row to its own page), drawn first: the overview's answer to
   * "how am I doing" before the lifetime tiles. Never drawn over the
   * whole-screen empty state, which says the truer thing to a new lister.
   */
  hero?: React.ReactNode;
}) {
  const { earnings, requests, listings, calendar, reviews } = analytics;

  /*
   * The whole-screen empty state, and the condition is deliberately strict.
   *
   * It fires only when every read SUCCEEDED and every one of them came back
   * with nothing. A single null anywhere means at least one question went
   * unanswered, and an agent who has thirty stays must never be shown "nothing
   * to measure yet" because one table was slow. In that case the panels render
   * and each one says for itself what it does and does not know.
   */
  const nothingHappenedYet =
    listings !== null &&
    listings.length === 0 &&
    requests !== null &&
    requests.received === 0 &&
    reviews !== null &&
    reviews.count === 0 &&
    earnings.readable &&
    earnings.months.length === 0;

  if (nothingHappenedYet) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-md py-10 text-center sm:py-14">
        <span className="grid size-[5.5rem] shrink-0 place-items-center" aria-hidden="true" data-art="analytics">
          <Icon3D name="analytics" size={88} />
        </span>
        <h2 className="nf-h3">{t.emptyTitle}</h2>
        <p className="mx-auto max-w-[42ch] text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {t.emptyBody}
        </p>
        <ButtonLink href="/agent/list" variant="primary">
          {t.emptyAction}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {hero}

      <div className="nf-figure-tiles">
        <Tile
          icon="wallet"
          label={t.headline.settled}
          value={
            earnings.readable ? (
              <Amount
                minorUnits={earnings.totalAgentShareMinor}
                locale={locale}
                className={TILE_FIGURE}
                count
              />
            ) : (
              <Unknown label={t.unavailable} />
            )
          }
        />
        <Tile
          icon="calendar-check"
          label={t.headline.stays}
          value={
            requests ? (
              <Figure value={requests.confirmed} locale={locale} className={TILE_FIGURE}
                count />
            ) : (
              <Unknown label={t.unavailable} />
            )
          }
        />
        <Tile
          icon="star"
          label={t.headline.rating}
          value={
            reviews === null ? (
              <Unknown label={t.unavailable} />
            ) : reviews.average === null ? (
              <Unknown label={t.headline.ratingNone} />
            ) : (
              <Figure
                value={formatRating(reviews.average, locale)}
                locale={locale}
                className={TILE_FIGURE}
                count
              />
            )
          }
          /* The count travels with the average, always. 5.0 from one review
             and 5.0 from two hundred are different facts, and an average shown
             on its own invites a host to read the wrong one. */
          note={
            reviews && reviews.count > 0
              ? reviews.count === 1
                ? t.headline.ratingFromOne
                : fill(t.headline.ratingFrom, { count: formatNumber(reviews.count, locale) })
              : undefined
          }
        />
        <Tile
          icon="calendar-clock"
          label={fill(t.headline.booked, { nights: CALENDAR_WINDOW_NIGHTS })}
          value={
            calendar ? (
              <Figure
                value={calendar.bookedNights}
                locale={locale}
                suffix={`/ ${formatNumber(calendar.offeredNights, locale)}`}
                className={TILE_FIGURE}
                count
              />
            ) : (
              <Unknown label={t.unavailable} />
            )
          }
        />
      </div>

      <Section title={t.trend.title} blurb={t.trend.blurb}>
        {earnings.readable ? (
          <SettledTrend t={t} points={analytics.trend} locale={locale} />
        ) : (
          <Unavailable>{t.unavailable}</Unavailable>
        )}
      </Section>

      <Section title={t.requests.title} blurb={t.requests.blurb}>
        {requests ? (
          <RequestsPanel t={t} hours={hours} outcomes={requests} locale={locale} />
        ) : (
          <Unavailable>{t.unavailable}</Unavailable>
        )}
      </Section>

      <Section title={fill(t.calendar.title, { nights: CALENDAR_WINDOW_NIGHTS })}>
        {calendar ? (
          <CalendarPanel t={t} calendar={calendar} locale={locale} />
        ) : (
          <Unavailable>{t.unavailable}</Unavailable>
        )}
      </Section>

      <Section title={t.listings.title} blurb={t.listings.blurb}>
        {listings ? (
          <ListingsPanel t={t} statusLabels={statusLabels} rows={listings} locale={locale} />
        ) : (
          <Unavailable>{t.unavailable}</Unavailable>
        )}
      </Section>

      {/*
        The absences, stated on the screen rather than only in a comment.

        A host looking at an analytics page assumes it shows everything the
        platform knows, so silence about views and saves would be read as "no
        views and no saves" rather than "not counted". Naming what is missing,
        and why, is the difference between a limited report and a misleading
        one, and it is also the only reason a host will trust the numbers that
        ARE here.
      */}
      {funnels}

      <section className="nf-panel nf-panel--card block p-md sm:p-panel">
        <h2 className="nf-h3">{t.notCounted.title}</h2>
        <ul className="mt-sm space-y-sm">
          {[viewsLine ?? t.notCounted.views, t.notCounted.saves, t.notCounted.occupancy, ...absent].map((line) => (
            <li
              key={line}
              className="max-w-[76ch] text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]"
            >
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
