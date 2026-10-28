import Link from "next/link";
import { PersonTier } from "@/app/admin/_components/PersonTier";
import type { BadgeTier } from "@/lib/admin/reads/badges";
import { countOf, formatDate, formatMoney, plural, type Locale, type Dictionary } from "@vallo/i18n/core";
import type { BookingsDesk as BookingsDeskData } from "@/lib/admin/reads/bookings";
import { BOOKING_STATUSES } from "@/lib/admin/bookings-queries";
import { LiveRefresh } from "../_components/LiveRefresh";
import type { AdminUi } from "../_components/ui";
import type { AdminCommon } from "../_components/copy";
import { QueueFilters, queueNarrowed, type QueueQuery, type QueueStatusOption } from "../_components/QueueFilters";
import { CalmNote, DeskHead, EmptyChart, Kpi, NumberedPager, Panel, TableNote, Waiting } from "../money/_desk/Desk";
import { SeriesChart, StatusBar } from "../money/_desk/charts";

/**
 * The bookings desk in the console register: five KPI cards of exact counts,
 * the bookings made per day (drawn only once there are two days of them),
 * one status bar on the status four with a word on every segment, the
 * shared filter, and every stay in a numbered table whose rows open the
 * stay's own page, where the cancel and refund decision lives
 * unchanged. Figures come from `getBookingsDesk` (`lib/admin/reads/bookings.ts`).
 */

export function dayLabel(day: string, locale: Locale, withYear = false): string {
  return formatDate(new Date(`${day}T12:00:00+01:00`), locale, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "Africa/Lagos",
  });
}

export function BookingsDesk({
  desk,
  t,
  ui,
  common,
  query,
  params,
  locale,
  waitingTables,
  tiers = {},
}: {
  /** Badge tiers keyed by user id, from `public.person_badge`. */
  tiers?: Record<string, BadgeTier>;
  desk: BookingsDeskData | null;
  t: Dictionary;
  ui: AdminUi;
  common: AdminCommon;
  query: QueueQuery;
  params: Record<string, string | undefined>;
  locale: Locale;
  /** Restaurant tables waiting on an answer, or null when the count could not be read. */
  waitingTables: number | null;
}) {
  const copy = t.admin.bookings;
  const statuses: QueueStatusOption[] = BOOKING_STATUSES.map((value) => ({ value, label: ui.statusLabel(value) }));
  const filterHref = (status: string | undefined) => (status ? `/admin/bookings?status=${status}` : "/admin/bookings");
  const c = desk?.counts;
  const narrowed = queueNarrowed(query);

  return (
    <div className="nf-console nf-md">
      <LiveRefresh />
      <DeskHead
        title={copy.title}
        lede="Every stay booked on the platform, from request to check-out."
        aside={
          /* THE RESERVATION OVERSIGHT LINK, kept: restaurant tables reuse the
             booking enum but are a different loop with their own queue. */
          <span className="flex flex-wrap gap-xs">
            <Link href="/admin/bookings/reservations" className="nf-md-toggle">
              Restaurant tables
              <span className="nf-numeric">
                {waitingTables === null ? " · count unavailable" : waitingTables === 0 ? " · none waiting" : ` · ${waitingTables} waiting`}
              </span>
            </Link>
            {/* Visit ops: the inspection requests, as a calendar. */}
            <Link href="/admin/bookings/visits" className="nf-md-toggle">
              {t.visitOps.admin.openCalendar}
            </Link>
          </span>
        }
      />

      <div className="nf-md-kpis nf-md-kpis--5">
        <Kpi label="Requested" value={c ? String(c.requested) : null} note="Waiting on the host's answer" href={filterHref(query.status === "PENDING" ? undefined : "PENDING")} current={query.status === "PENDING"} />
        <Kpi label="Confirmed" value={c ? String(c.confirmed) : null} note="Accepted, not yet over" href={filterHref(query.status === "CONFIRMED" ? undefined : "CONFIRMED")} current={query.status === "CONFIRMED"} />
        <Kpi label="In stay now" value={c ? String(c.inStay) : null} note="Confirmed, and today is inside the dates" />
        <Kpi label="Cancelled" value={c ? String(c.cancelled) : null} note="By the guest, the host or the console" href={filterHref(query.status === "CANCELLED" ? undefined : "CANCELLED")} current={query.status === "CANCELLED"} />
        <Kpi label="Refunded" value={c ? String(c.refunded) : null} note="Stays with money returned to the guest" />
      </div>
      {desk && !desk.complete && (
        <p className="nf-md-panel__hint">There are more stays than this desk reads in one pass, so these counts are at least these numbers.</p>
      )}

      <div className="nf-md-grid nf-md-grid--main">
        <VolumePanel desk={desk} locale={locale} />
        <Panel title="By status" hint={c ? `${countOf(c.total, "stays", locale)} ever` : undefined}>
          {c ? (
            <>
            <StatusBar
              label="Stays by status"
              segments={[
                { key: "requested", label: "Requested", count: c.requested, tone: "pending" },
                { key: "confirmed", label: "Confirmed", count: c.confirmed, tone: "info" },
                { key: "completed", label: "Completed", count: c.completed, tone: "good" },
                { key: "ended", label: "Cancelled or no-show", count: c.cancelled + c.noShow, tone: "bad" },
              ]}
            />
            {c.total === 0 && (
              <div className="mt-md">
                <CalmNote
                  title="No stay to split yet"
                  fills="Every stay by where it stands: requested, confirmed, completed, or cancelled and no-show."
                  creates="Each stay moves along this bar as the host answers and the dates pass."
                />
              </div>
            )}
            </>
          ) : (
            <Waiting title="Stays could not be read" body="Every stay by status. The read did not answer just now; reload in a moment." />
          )}
        </Panel>
      </div>

      <QueueFilters
        base="/admin/bookings"
        query={query}
        common={common}
        statuses={statuses}
        searchLabel={copy.searchLabel}
        searchPlaceholder="A listing, a guest's name, or a booking id"
      />

      <Panel title="Stays" hint={desk ? countOf(desk.table.total, "stays", locale) : undefined}>
        {!desk ? (
          <Waiting title="Stays could not be read" body="Every stay with its guest, dates, money and status. The read did not answer just now." />
        ) : (
          <>
            <div className="nf-md-scroll"><table className="nf-md-table">
              <thead>
                <tr>
                  <th scope="col">Stay</th>
                  <th scope="col">Guest</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="nf-md-num">Paid</th>
                  <th scope="col" className="nf-md-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {desk.table.rows.length === 0 ? (
                  <TableNote
                    columns={6}
                    note={
                      narrowed
                        ? { title: common.noMatchTitle, fills: common.noMatchBody }
                        : {
                            title: "No stay has been booked yet",
                            fills: "Every stay with its guest, dates, what was paid and where it stands.",
                            creates: "A guest booking a published stay creates the first one.",
                            action: { href: "/admin/listings", label: "Open listing review" },
                          }
                    }
                  />
                ) : (
                  desk.table.rows.map((stay) => (
                    <tr key={stay.id}>
                      <td className="nf-md-lead" data-label="">
                        <Link href={`/admin/bookings/${stay.id}`} className="flex min-h-11 min-w-11 items-center font-semibold text-[var(--nf-content-primary)] underline-offset-2 hover:underline">
                          {stay.listingTitle ?? "A listing that is no longer there"}
                        </Link>
                        <span className="block text-[length:var(--nf-text-caption)]">
                          {stay.place ? `${stay.place} · ` : ""}booked {ui.when(stay.createdAt)}
                        </span>
                      </td>
                      <td data-label="Guest">
                        {stay.guestName ?? copy.unnamed}
                        {stay.guestId ? <PersonTier tier={tiers[stay.guestId]} /> : null}
                      </td>
                      <td data-label="Dates" className="whitespace-nowrap">
                        {ui.day(stay.checkIn)} to {ui.day(stay.checkOut)}
                        <span className="block text-[length:var(--nf-text-caption)]">
                          {plural(stay.nights, t.counts.nights, locale)}
                        </span>
                      </td>
                      <td data-label="Status">
                        <ui.StatusChip status={stay.status} />
                        {stay.refundedMinor > 0 && (
                          <span className="block text-[length:var(--nf-text-caption)]">
                            {formatMoney(stay.refundedMinor, locale)} refunded
                          </span>
                        )}
                      </td>
                      <td className="nf-md-num" data-label="Paid">
                        {stay.paidMinor > 0 ? formatMoney(stay.paidMinor, locale) : copy.unpaidChip}
                      </td>
                      <td className="nf-md-num nf-md-strong" data-label="Total">
                        {formatMoney(stay.totalMinor, locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
            {desk.table.total > 0 && (
              <NumberedPager base="/admin/bookings" params={params} page={desk.table.page} total={desk.table.total} pageSize={desk.table.pageSize} noun="stays" />
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function VolumePanel({ desk, locale }: { desk: BookingsDeskData | null; locale: Locale }) {
  const title = "Stays booked per day";
  if (!desk) {
    return (
      <Panel title={title}>
        <Waiting title="Stays could not be read" body="Stays booked each day for thirty days. The read did not answer just now." />
      </Panel>
    );
  }
  const days = desk.perDay;
  const activeDays = days.filter((d) => d.count > 0).length;
  const ticks = days.map((d, i) => (i % 5 === 0 || i === days.length - 1 ? dayLabel(d.day, locale) : ""));
  if (activeDays < 2) {
    return (
      <Panel title={title} hint="Last 30 days">
        <EmptyChart
          height={200}
          yLabels={["0", "", "", "", ""]}
          xLabels={ticks}
          note={{
            title: activeDays === 0 ? "No stay booked in thirty days" : "One day of bookings so far",
            fills: "How many stays were booked each day over the last thirty days.",
            creates: "Every stay a guest books adds to its day. A line needs two days, so none is drawn.",
            action: { href: "/admin/listings", label: "Open listing review" },
          }}
        />
      </Panel>
    );
  }
  return (
    <Panel title={title} hint="Last 30 days">
      <SeriesChart
        id="bookings-volume"
        xLabels={days.map((d) => dayLabel(d.day, locale))}
        series={[{ name: "Stays booked", values: days.map((d) => d.count), rank: 0, area: true }]}
        label="Stays booked per day, last thirty days"
        /* A count is whole: a gridline at 1.25 stays unlabelled rather than
           read "1" beside a line that is not at one (C1 sweep). */
        yLabel={(v) => (Number.isInteger(v) ? String(v) : "")}
        readout={days.map((d) => ({ title: dayLabel(d.day, locale, true), rows: [{ label: "Stays booked", value: String(d.count) }] }))}
      />
    </Panel>
  );
}
