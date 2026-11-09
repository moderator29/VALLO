import Image from "next/image";
import Link from "next/link";
import { getDictionary, type Locale } from "@vallo/i18n";
import type { RentChargeView } from "@/lib/bookings/queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { ICON, TYPE } from "@/components/app/Screen";
import "@/app/css/catalogue.css";

/**
 * A TENANCY CHARGE ON THE BOOKINGS SCREEN, AND IT IS NOT A STAY.
 *
 * `getMyBookings` used to build a list of the rent booking ids and then drop
 * exactly those rows, so a tenant who had opened a rent payment saw NOTHING on
 * /bookings: not a wrong row, no row at all, and no route back to the one page
 * that takes the money. The read has a fourth group now (`BookingGroups.rent`,
 * `RentChargeView`) and this is what draws it.
 *
 * WHAT IS DELIBERATELY ABSENT, because a tenancy is not a stay: no nights, no
 * guest count, no date range, no check-in and no check-out. The
 * yearly-rent-with-nightly-pickers error is on the build's stop list and it is
 * at its most believable in a list, where a year's rent beside the word
 * "nights" reads as a price somebody could pay tonight. A tenancy has ONE day,
 * the day the keys change hands, and a period word the rent module itself owns
 * ("Yearly").
 *
 * THE FIGURE IS THE CHARGE'S FROZEN TOTAL, already through `formatMoney` in
 * the read, so a lister editing a fee after the tenant opened the payment
 * cannot move the number under them, and this card quotes what `/rent/pay`
 * will take.
 *
 * THE CONTROL IS DRAWN ONLY WHEN IT CAN ACT. `payable` is the read's own word
 * for "the tenant can still complete this", and it is false the moment money
 * has settled or the charge is no longer PENDING. A settled tenancy is a
 * record with no payment control on it; the rent page's own honest states
 * answer everything else, so nothing here offers a door that would turn
 * somebody away.
 */
export function TenancyCard({
  tenancy,
  locale,
}: {
  tenancy: RentChargeView;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const copy = t.catalogue.tenancy;
  const where = [tenancy.area, tenancy.city].filter(Boolean).join(", ");

  return (
    <li className="nf-panel nf-panel--card block overflow-hidden p-0 text-left" data-testid="tenancy-card">
      <div className="flex gap-md p-md">
        <Link
          href={`/listing/${tenancy.listingId}`}
          aria-label={tenancy.title}
          className="relative block h-[5.75rem] w-[5.75rem] shrink-0 overflow-hidden rounded-md bg-[var(--nf-surface-secondary)] sm:h-24 sm:w-32"
        >
          {tenancy.photo && (
            <Image src={tenancy.photo} alt="" fill sizes="128px" className="object-cover" />
          )}
        </Link>

        <div className="min-w-0 flex-1 leading-tight">
          {/* Paid or due, in the tenancy's own words. The platform status
              vocabulary reads "Requested" for PENDING, which is true of a stay
              somebody has asked for and wrong about a charge that is simply
              waiting to be paid. */}
          <StatusChip state={tenancy.paid ? "success" : "pending"}>
            {tenancy.paid ? copy.settled : copy.due}
          </StatusChip>
          <h3 className={`mt-xs ${TYPE.rowTitle}`}>{tenancy.title}</h3>

          {where && (
            <p className={`mt-2xs flex items-start gap-xs ${TYPE.rowMeta}`}>
              <UiIcon name="location" size={ICON.inline} className="mt-px shrink-0" />
              <span>{where}</span>
            </p>
          )}

          {/* ONE DAY, never a range. The keys glyph rather than a calendar:
              a calendar on this card is the first step back towards nights. */}
          <p className={`mt-sm flex items-center gap-xs ${TYPE.body}`}>
            <UiIcon name="key" size={ICON.inline} className="shrink-0" />
            <span className="font-semibold">
              {copy.moveIn.replace("{date}", tenancy.moveInLabel)}
            </span>
          </p>

          {/* The rent module's own period word, not a count of anything. */}
          <p className="mt-xs">
            <span className="nf-tenancy-chip" data-testid="tenancy-period">
              <UiIcon name="history" size={12} />
              {copy.period.replace("{period}", tenancy.periodLabel)}
            </span>
          </p>
        </div>
      </div>

      {/* THE LABEL SITS ABOVE THE FIGURE, not beside it. A year's rent is the
          longest number this product prints, and on a 390px phone
          "₦14,700,000 Move-in total" wrapped mid-phrase and shouldered the
          control off its line. Stacked, the figure keeps one line at any
          length and the control keeps its width. */}
      <div className="flex items-end justify-between gap-md border-t border-[var(--nf-border-subtle)] px-md py-sm">
        <p className="min-w-0 leading-tight">
          <span className="block text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {copy.total}
          </span>
          <span className="nf-numeric mt-3xs block text-[length:var(--nf-text-body-sm)] font-bold tracking-tight text-[var(--nf-content-primary)]">
            {tenancy.totalDisplay}
          </span>
        </p>
        {tenancy.payable ? (
          /* gap-sm, not less: the card clips (overflow-hidden), so the split
             link's 44px target has only the gap, the link and the bar's
             bottom padding to live in. 12 + 20 (a fixed line) + 12 is 44 exactly, starting
             at the Pay button's edge and never over it. */
          <div className="flex shrink-0 flex-col items-end gap-sm">
            <ButtonLink href={tenancy.href} variant="primary" size="sm">
              {copy.pay}
            </ButtonLink>
            {/* V-86: flatmates' shares live in the tenancy file. */}
            <Link
              href={`${tenancy.fileHref}#flatmates`}
              className="nf-tap text-[length:var(--nf-text-caption)] leading-[1.25rem] font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
              data-testid="tenancy-split-link"
            >
              {t.afterTheGate.flatmates.split}
            </Link>
          </div>
        ) : (
          /* V-47. A paid tenancy opens its own file; an unpaid one that can no
             longer be paid still points at the listing. */
          <Link
            href={tenancy.paid ? tenancy.fileHref : `/listing/${tenancy.listingId}`}
            className="nf-tap flex shrink-0 items-center gap-2xs whitespace-nowrap text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline"
            data-testid={tenancy.paid ? "tenancy-file-link" : undefined}
          >
            {tenancy.paid ? t.afterTheGate.tenancy.openFile : copy.view}
            <UiIcon name="arrow-right" size={16} />
          </Link>
        )}
      </div>
    </li>
  );
}
