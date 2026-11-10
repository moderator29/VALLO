import Link from "next/link";
import "@/app/host/host-desk.css";
import { countOf, formatMoney, getDictionary, plural, type Locale } from "@vallo/i18n";
import type { HostRoomBooking } from "@/lib/host/room-bookings";
import { clockFor, type DecideItem } from "@/lib/host/decide";
import { stayDateLabel } from "@/lib/stays/date-label";
import type { HostReservationView } from "@/lib/reservations/queries";
import { EmptyState } from "@/components/app/Screen";
import { PageFrame } from "@/components/app/PageFrame";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { DecideClock } from "@/components/host/DecideClock";
import { RoomRequestAnswer } from "@/app/host/bookings/RoomRequestAnswer";
import { Decision } from "@/app/host/reservations/ReservationsBoard";

/**
 * THE DECIDE-BY LIST, DRAWN (C3). `app/host/decide/page.tsx` reads; this
 * draws, so the preview harness can draw it from fixtures too.
 */

export type DecideRowData =
  | (DecideItem & { kind: "room"; booking: HostRoomBooking })
  | (DecideItem & { kind: "table"; table: HostReservationView });

export function DecideView({
  rows: sorted,
  now,
  locale,
  unreadable,
}: {
  rows: DecideRowData[];
  now: number;
  locale: Locale;
  unreadable: boolean;
}) {
  const counts = { spare: 0, soon: 0, late: 0, lapsed: 0 };
  for (const item of sorted) counts[clockFor(item.openedAt, item.deadline, now).urgency] += 1;
  const t = getDictionary(locale);
  const w = t.experienceHost.decideView;

  return (
    <PageFrame
      fallback="/host"
      width="wide"
      title={w.title}
      subtitle={
        sorted.length === 0 ? w.nothingWaiting : w.waiting.replace("{requests}", countOf(sorted.length, "requestsAre", locale))
      }
    >

      <div className="nf-decide">
        <div className="grid gap-md">
          {unreadable ? (
            <p className="nf-body" role="alert">
              {w.unreadable}
            </p>
          ) : null}

          {sorted.length > 0 ? (
            <SummaryCard
              label={w.summaryLabel}
              figure={sorted.length}
              sentence={
                counts.late + counts.soon > 0
                  ? w.closeToLapsing.replace("{count}", countOf(counts.late + counts.soon, "ofThemAre", locale))
                  : w.allSpare
              }
              segments={[
                { key: "late", label: w.lastHour, count: counts.late + counts.lapsed, tone: "error" as const },
                { key: "soon", label: w.lastQuarter, count: counts.soon, tone: "warning" as const },
                { key: "spare", label: w.timeToSpare, count: counts.spare, tone: "brand" as const },
              ].filter((s) => s.count > 0)}
              barLabel={w.barLabel}
            />
          ) : null}

          {sorted.length === 0 && !unreadable ? (
            <EmptyState
              icon="clock-check"
              title={w.caughtUpTitle}
              body={w.caughtUpBody}
            />
          ) : (
            <ul className="nf-decide__list" data-testid="decide-list">
              {sorted.map((item) => (
                <DecideRow key={`${item.kind}-${item.id}`} item={item} now={now} locale={locale} counts={t.counts} answer={t.experienceHost.bookings.answer} words={w} />
              ))}
            </ul>
          )}
        </div>

        <aside className="grid gap-md">
          <ListGroup label={w.clock}>
            <ListRow leading={<Dot tone="brand" />} title={w.timeToSpare} sub={w.spareSub} />
            <ListRow leading={<Dot tone="warning" />} title={w.lastQuarter} sub={w.quarterSub} />
            <ListRow leading={<Dot tone="error" />} title={w.lastHour} sub={w.hourSub} />
          </ListGroup>
          <ListGroup label={w.elseLabel}>
            <ListRow
              leading={
                <IconPlate size="sm">
                  <UiIcon name="calendar-check" size={ICON_PLATE_GLYPH.sm} />
                </IconPlate>
              }
              title={w.roomBookings}
              sub={w.roomBookingsSub}
              href="/host/bookings"
              chevron
            />
            <ListRow
              leading={
                <IconPlate size="sm">
                  <UiIcon name="utensils" size={ICON_PLATE_GLYPH.sm} />
                </IconPlate>
              }
              title={w.reservations}
              sub={w.reservationsSub}
              href="/host/reservations"
              chevron
            />
          </ListGroup>
        </aside>
      </div>
    </PageFrame>
  );
}

function Dot({ tone }: { tone: "brand" | "warning" | "error" }) {
  return (
    <span aria-hidden="true" className="nf-decide__dot" data-tone={tone} />
  );
}

const LAGOS_WHEN = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function DecideRow({
  item,
  now,
  locale,
  counts,
  answer,
  words,
}: {
  item: DecideRowData;
  now: number;
  locale: Locale;
  counts: ReturnType<typeof getDictionary>["counts"];
  /** The room answer sheet's words (RoomRequestAnswer). */
  answer: ReturnType<typeof getDictionary>["experienceHost"]["bookings"]["answer"];
  words: ReturnType<typeof getDictionary>["experienceHost"]["decideView"];
}) {
  const clock = clockFor(item.openedAt, item.deadline, now);
  const lapseWords = words.lapses.replace("{when}", LAGOS_WHEN.format(new Date(item.deadline)));
  if (item.kind === "room") {
    const b = item.booking;
    const dates = `${stayDateLabel(b.checkIn) ?? b.checkIn} to ${stayDateLabel(b.checkOut) ?? b.checkOut}`;
    return (
      <li className="nf-decide__row" data-urgency={clock.urgency} data-testid="decide-room">
        <div className="nf-decide__top">
          <IconPlate size="md" tone={clock.urgency === "spare" ? "neutral" : clock.urgency === "soon" ? "warning" : "danger"}>
            <UiIcon name="bed" size={ICON_PLATE_GLYPH.md} />
          </IconPlate>
          <div className="nf-decide__what">
            <p className="nf-decide__title">{words.roomAt.replace("{room}", b.room).replace("{hotel}", b.hotel)}</p>
            <p className="nf-decide__sub">
              {b.guestName} · {dates} · {plural(b.nights, counts.nights, locale)} · {formatMoney(b.totalMinor, locale)}
            </p>
          </div>
          <DecideClock openedAt={item.openedAt} deadline={item.deadline} serverNow={now} />
        </div>
        <DecideClock openedAt={item.openedAt} deadline={item.deadline} serverNow={now} bar />
        <p className="nf-caption">{words.roomLapse.replace("{lapses}", lapseWords)}</p>
        <RoomRequestAnswer
          bookingId={b.id}
          words={answer}
          summary={{
            guestName: b.guestName,
            room: b.room,
            hotel: b.hotel,
            dates,
            stay: `${plural(b.nights, counts.nights, locale)} · ${plural(b.guests, counts.guests, locale)}`,
            total: formatMoney(b.totalMinor, locale),
            listingTitle: b.hotel,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            nights: b.nights,
            totalMinor: b.totalMinor,
          }}
        />
      </li>
    );
  }
  const tb = item.table;
  return (
    <li className="nf-decide__row" data-urgency={clock.urgency} data-testid="decide-table">
      <div className="nf-decide__top">
        <IconPlate size="md" tone={clock.urgency === "spare" ? "neutral" : clock.urgency === "soon" ? "warning" : "danger"}>
          <UiIcon name="utensils" size={ICON_PLATE_GLYPH.md} />
        </IconPlate>
        <div className="nf-decide__what">
          <p className="nf-decide__title">
            {words.tableFor.replace("{party}", String(tb.partySize)).replace("{place}", tb.listingTitle)}
          </p>
          <p className="nf-decide__sub">
            {tb.guestName} · {LAGOS_WHEN.format(new Date(tb.reservedFor))}
          </p>
        </div>
        <DecideClock openedAt={item.openedAt} deadline={item.deadline} serverNow={now} />
      </div>
      <DecideClock openedAt={item.openedAt} deadline={item.deadline} serverNow={now} bar />
      {tb.note ? <p className="nf-caption">{tb.note}</p> : null}
      <Decision table={tb} />
      {tb.conversationId ? (
        <Link href={`/messages/${tb.conversationId}`} className="nf-link-quiet nf-tap text-[length:var(--nf-text-body-sm)]">
          {words.talkTo.replace("{name}", tb.guestName)}
        </Link>
      ) : null}
    </li>
  );
}
