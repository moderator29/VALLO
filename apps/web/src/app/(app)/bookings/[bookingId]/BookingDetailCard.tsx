import Image from "next/image";
import Link from "next/link";
import { getDictionary, plural, type Locale } from "@vallo/i18n";
import type { BookingView } from "@/lib/bookings/queries";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { bookingChip } from "@/components/app/bookings/booking-chip";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON, TYPE } from "@/components/app/Screen";
import { CancelBookingControl } from "@/components/app/bookings/CancelBookingSheet";

/**
 * One stay, opened on its own (`/bookings/[bookingId]`). Lifted out of the
 * page so the orphans sweep's fixture harness renders the real card; the
 * page still reads the booking and decides every other state.
 */
export function BookingDetailCard({ booking, locale }: { booking: BookingView; locale: Locale }) {
  const t = getDictionary(locale);
  const copy = t.catalogue.bookings;
  const where = [booking.area, booking.city].filter(Boolean).join(", ");
  const statusWords = t.admin.common.status;

  return (
    <article
      className="nf-panel nf-panel--card block overflow-hidden p-0"
      data-testid="booking-detail"
    >
      <div className="flex gap-md p-md">
        <Link
          href={booking.stayHref}
          aria-label={booking.title}
          className="relative block h-[5.75rem] w-[5.75rem] shrink-0 overflow-hidden rounded-[var(--nf-radius-md)] bg-[var(--nf-surface-secondary)] sm:h-24 sm:w-32"
        >
          {booking.photo && (
            <Image src={booking.photo} alt="" fill sizes="128px" className="object-cover" />
          )}
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          {/* Word, shape and colour together (reference 7071), never colour
              alone; a cancelled stay is neutral, not the rose of a failure. */}
          <StatusChip state={bookingChip(booking.status)}>{statusWords[booking.status]}</StatusChip>
          <h1 className={`mt-xs ${TYPE.rowTitle}`}>{booking.title}</h1>
          {where && (
            <p className={`mt-2xs flex items-start gap-xs ${TYPE.rowMeta}`}>
              <UiIcon name="location" size={ICON.inline} className="mt-px shrink-0" />
              <span>{where}</span>
            </p>
          )}
          <p className={`mt-sm flex items-center gap-xs ${TYPE.body}`}>
            <UiIcon name="calendar-booking" size={ICON.inline} className="shrink-0" />
            <span className="font-semibold">{booking.dateRange}</span>
          </p>
          <p className={`mt-2xs flex items-center gap-xs ${TYPE.body}`}>
            <UiIcon name="user" size={ICON.inline} className="shrink-0" />
            {plural(booking.guests, t.counts.guests, locale)} &middot;{" "}
            {plural(booking.nights, t.counts.nights, locale)}
          </p>
          {booking.arrivingName && (
            <p
              data-testid="booking-arriving"
              className="mt-2xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]"
            >
              {copy.arriving.replace("{name}", booking.arrivingName)}
              {booking.arrivingPhone && (
                <>
                  {" "}
                  &middot; <span className="nf-numeric">{booking.arrivingPhone}</span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-md border-t border-[var(--nf-border-subtle)] px-md py-sm">
        <p className="flex items-baseline gap-2xs">
          <span className="nf-numeric text-[length:var(--nf-text-body-sm)] font-bold tracking-tight text-[var(--nf-content-primary)]">
            {booking.totalDisplay}
          </span>
          <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {copy.total}
          </span>
        </p>
        {/* The same controls the hub draws, from the same guarded facts, so a
            booking opened from a chat can be finished without a second hop. */}
        <span className="flex flex-wrap items-center gap-md">
          {booking.payable && (
            <ButtonLink href={`/checkout/${booking.id}`} variant="primary" size="sm">
              {copy.payNow}
            </ButtonLink>
          )}
          {booking.reviewable && (
            <ButtonLink href={`/bookings/${booking.id}/review`} variant="primary" size="sm">
              {copy.leaveReview}
            </ButtonLink>
          )}
          {booking.reviewed && (
            <Link
              href={`/bookings/${booking.id}/review`}
              className="nf-tap flex items-center gap-2xs text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-muted)] underline-offset-4 hover:text-[var(--nf-content-secondary)] hover:underline"
            >
              <UiIcon name="star" size={16} className="text-[var(--nf-rating)]" />
              {copy.yourReview}
            </Link>
          )}
          {booking.cancellable && <CancelBookingControl booking={booking} label={copy.cancel} words={t.memberFlows.cancelBooking} />}
          <Link
            href={booking.stayHref}
            className="nf-tap flex items-center gap-2xs text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
          >
            {copy.viewDetails}
            <UiIcon name="arrow-right" size={16} />
          </Link>
        </span>
      </div>
    </article>
  );
}
