import Link from "next/link";
import { formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { cashAtDoor, upfrontDuration, upfrontText } from "@/lib/listings/upfront";
import type { Listing } from "@/lib/listings/types";
import type { RentPeriod } from "@/lib/listings/pricing";
import { Amount } from "@/components/ui/Amount";
import { UiIcon } from "@/design-system/icons/UiIcon";
import "@/app/css/catalogue.css";

/**
 * The Move-in Total block of 9E8B56ED, translated per DESIGN_DIRECTION 1.3.
 *
 * The render prints the yearly rent under the words "Move-in Total", which
 * is the one figure this product exists to get right. Here the block prints
 * the true move-in total (the agent's stated figure, or the sum of the parts
 * they named, marked "from"), with the rent and its period beneath it, and
 * the rooms tile on the right. A listing that names neither a total nor a
 * part shows the rent alone, honestly labelled.
 *
 * THE HERO FIGURE, AND THE RENT DIRECTLY BENEATH IT (Session 3, Stage 5).
 * The total is the screen's one figure: hero size, counting up once on
 * arrival (`Amount count`, never again on a re-render). The rent used to sit
 * in the footer under the parts bar, two rows away from the figure it
 * explains; it now reads as the figure's own second line, so the eye takes
 * "what it costs to move in, of which this is rent" in one look. There is no
 * example badge any more (D24): an example row draws the same block with no
 * label, and it never carries a trust mark here because this block draws none.
 */
export function ListingMoveInBlock({
  listing,
  locale,
  t,
}: {
  listing: Listing;
  locale: Locale;
  t: Dictionary;
}) {
  const copy = t.catalogue.detail;
  const total = listing.moveInCostMinor ?? 0;
  const stated = listing.moveInCostStated === true;
  const period: RentPeriod =
    listing.pricePeriod === "month" || listing.pricePeriod === "quarter"
      ? listing.pricePeriod
      : "year";
  const hasTotal = total > 0;
  /* V-65: the rent asked for at the start, restated at the door when it is
     several whole periods. */
  const cash = cashAtDoor(listing);

  /* NO BAR HERE (founder, 13 November 2026: the page said the same numbers
     three or four times). The lead states the total once, with the rent it
     grows from; every part, the bar's job, is the Costs section's ledger
     below and the full breakdown one tap away. */
  return (
    /* ONE LINE UNDER THE PRICE (founder, 13 November 2026: the page said the
       same numbers three or four times). The lead states the move-in total
       once, quietly, with the rent it grows from and the way into the full
       breakdown; the Costs section below carries every part. */
    <div className="nf-movein-line" data-testid="move-in-block">
      <p className="nf-movein-line__main">
        <span className="nf-movein-line__label">
          {hasTotal ? (stated ? copy.moveInTotal : copy.moveInFrom) : t.catalogue.card.rent}
        </span>
        <span className="nf-movein-line__figure nf-numeric">
          <Amount
            minorUnits={hasTotal ? total : listing.priceMinor}
            locale={locale}
            currency={listing.currency}
            secondaryClassName="text-[length:max(0.5em,0.75rem)] font-semibold opacity-70"
          />
          {!hasTotal && <span className="nf-detail-movein__suffix">{t.experienceLabels.periodSlash[period]}</span>}
        </span>
      </p>
      {hasTotal && (
        <p className="nf-movein-line__rent" data-testid="move-in-rent">
          {t.catalogue.card.rent}{" "}
          <Amount minorUnits={listing.priceMinor} locale={locale} currency={listing.currency} />{" "}
          {t.experienceLabels.periodSlash[period]}
        </p>
      )}
      {cash && cash.upfrontMonths !== null && (
        <p className="nf-caption break-words text-[var(--nf-content-primary)]" data-testid="move-in-upfront">
          {/* The lister's DEMAND, labelled as theirs: the move-in charge on
              Vallo still takes one rent period (audit-owned), so this is not a
              figure Vallo collects. */}
          {cash.restated ? (
            t.shape.cash.listerAsks
              .replace("{duration}", upfrontDuration(cash.upfrontMonths, t.shape.cash))
              .replace("{amount}", formatMoney(cash.minor, locale, listing.currency))
          ) : (
            <strong>{upfrontText(cash.upfrontMonths, t.shape.cash)}</strong>
          )}
        </p>
      )}
      <Link href={`/rent/move-in/${listing.id}`} className="nf-link-quiet nf-tap nf-caption inline-flex items-center gap-2xs font-semibold text-[var(--nf-content-link)]">
        {copy.calculateBreakdown}
        <UiIcon name="chevron-right" size={16} />
      </Link>
    </div>
  );
}
