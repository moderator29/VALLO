import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney, getDictionary, plural, type Dictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { Amount } from "@/components/ui/Amount";
import { HostShell } from "@/components/host/HostShell";
import { readHostRoomBookings, type HostRoomBooking } from "@/lib/host/room-bookings";
import { readHotelDesk } from "@/lib/host/tape-chart-read";
import { HotelDashboard } from "@/components/host/dashboard/HotelDashboard";
import { stayDateLabel } from "@/lib/stays/date-label";
import { RoomRequestAnswer } from "./RoomRequestAnswer";
import { DecideClock } from "@/components/host/DecideClock";
import { roomDeadline } from "@/lib/host/decide";
import { requestNow } from "@/lib/format/when";
import { HOST_ROOM_BOOKING_PAYMENT } from "@/lib/money/copy";
import { hotelFeeSentence } from "@/lib/host/hotel-fee";
import "@/components/host/dashboard/dashboard.css";
import "../host-desk.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.bookings.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/bookings: ROOM BOOKINGS 1. Guests' requests for rooms at this host's
 * hotels, to accept or decline, and the stays that follow.
 *
 * A request holds its rooms from the moment it is made. Accepting draws up
 * the stay agreement: the host and the guest confirm its terms, Vallo checks
 * it, and then the guest pays by card, split by Paystack straight to the
 * host's bank account (the one set as default in payment settings). Declining
 * gives the nights back at once. Unanswered requests lapse on their own.
 */
export default async function HostRoomBookingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  /* The requests and the hotel's two weeks are separate reads and start together. */
  const [read, hotel] = await Promise.all([readHostRoomBookings(), readHotelDesk()]);
  const words = t.experienceHost.bookings;

  if (read.state === "signed-out") {
    return (
      <HostShell logoLabel={t.a11y.logoHome} fallback="/host">
        <EmptyState
          icon="hotel-bed"
          title={words.signedOutTitle}
          body={words.signedOutBody}
          action={
            <ButtonLink href={authHref(returnHref("/host/bookings", "", "list"), "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  const requests = read.state === "ok" ? read.waiting.length + read.upcoming.length + read.past.length : 0;
  const hotelUp = hotel.state === "ok";

  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" wide>
      <div className="nf-dash">
        <div>
          <h1 className="nf-h2">{words.title}</h1>
          <p className={`mt-xs max-w-2xl ${TYPE.body}`}>
            {words.lede} {HOST_ROOM_BOOKING_PAYMENT}
          </p>
          {/* Vallo's fee on a paid room, said plainly where the host reads their bookings. */}
          <p className={`mt-xs max-w-2xl ${TYPE.body}`} data-testid="hotel-fee">
            {hotelFeeSentence()}
          </p>
        </div>

        {read.state === "unavailable" || hotel.state === "unavailable" ? (
          <p className="nf-body" role="alert">
            {words.unavailable}
          </p>
        ) : null}

        {/* Answering a request has a clock on it, so it comes before the day's desk. */}
        {read.state === "ok" && read.waiting.length > 0 ? (
          <div className="max-w-2xl">
            <Section title={words.sections.waiting} rows={read.waiting} locale={locale} words={words} answer />
          </div>
        ) : null}

        {hotelUp ? <HotelDashboard read={hotel} locale={locale} variant="page" t={t} /> : null}

        {read.state === "ok" ? (
          requests === 0 ? (
            <div className="max-w-2xl">
              <EmptyState icon="hotel-bed" title={words.emptyTitle} body={words.emptyBody} />
            </div>
          ) : (
            <div className="max-w-2xl">
              <Section title={words.sections.accepted} rows={read.upcoming} locale={locale} words={words} />
              <Section title={words.sections.past} rows={read.past} locale={locale} words={words} />
            </div>
          )
        ) : null}
      </div>
    </HostShell>
  );
}

type Words = Dictionary["experienceHost"]["bookings"];

function Section({
  title,
  rows,
  locale,
  words,
  answer,
}: {
  title: string;
  rows: HostRoomBooking[];
  locale: Locale;
  words: Words;
  answer?: boolean;
}) {
  if (rows.length === 0) return null;
  const counts = getDictionary(locale).counts;
  const now = requestNow();
  const range = (b: HostRoomBooking) =>
    words.dateRange.replace("{from}", stayDateLabel(b.checkIn) ?? b.checkIn).replace("{to}", stayDateLabel(b.checkOut) ?? b.checkOut);
  return (
    <section className="mt-block" aria-label={title}>
      <h2 className="nf-h4">{title}</h2>
      <ul className="mt-xs grid gap-xs">
        {rows.map((b) => (
          <li key={b.id} id={`booking-${b.id}`} className="nf-panel nf-panel--card scroll-mt-24 p-card" data-testid="host-room-booking">
            <div className="flex items-start justify-between gap-sm">
              <p className="font-semibold">
                {b.room} &middot; {plural(b.rooms, counts.rooms, locale)} &middot; {b.hotel}
              </p>
              {/* C3: by when this must be answered, in words and colour. */}
              {answer ? <DecideClock openedAt={b.createdAt} deadline={roomDeadline(b.createdAt)} serverNow={now} /> : null}
            </div>
            <p className={TYPE.rowMeta}>
              {range(b)} &middot;{" "}
              {plural(b.nights, counts.nights, locale)} &middot; {plural(b.guests, counts.guests, locale)}
            </p>
            <p className={TYPE.rowMeta}>
              {b.guestName}
              {b.arrivingName ? words.forSomebody.replace("{name}", b.arrivingName) : ""} &middot; <Amount minorUnits={b.totalMinor} locale={locale} />
            </p>
            {/* Under "Waiting for you" a request's own status is the heading
                again, so it is drawn only once something has moved on it. */}
            {answer && !b.paid && !b.agreement ? null : (
            <p className="nf-caption mt-2xs">
              {b.paid
                ? words.paid
                : b.agreement
                  ? (words.agreement[b.agreement.status as keyof Words["agreement"]] ?? b.agreement.status)
                  : (words.status[b.status as keyof Words["status"]] ?? b.status)}
              {b.agreement && !b.paid ? (
                <>
                  {" "}
                  &middot;{" "}
                  <Link href={`/agreements/${b.agreement.id}`} className="underline">
                    {words.openAgreement}
                  </Link>
                </>
              ) : null}
            </p>
            )}
            {answer ? (
              <RoomRequestAnswer
                bookingId={b.id}
                words={words.answer}
                summary={{
                  guestName: b.guestName,
                  room: b.room,
                  hotel: b.hotel,
                  dates: range(b),
                  stay: `${plural(b.nights, counts.nights, locale)} · ${plural(b.guests, counts.guests, locale)}`,
                  total: formatMoney(b.totalMinor, locale),
                  listingTitle: b.hotel,
                  checkIn: b.checkIn,
                  checkOut: b.checkOut,
                  nights: b.nights,
                  totalMinor: b.totalMinor,
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
