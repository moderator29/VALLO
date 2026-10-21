import type { Dictionary, Locale } from "@vallo/i18n/core";
import type { Listing } from "@/lib/listings/types";
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import { cardPrice } from "@/components/app/listing-card-model";
import type { StayCardData } from "@/components/app/stays/stay-card-model";
import { Money } from "@/components/ui/Money";
import { SavedShelf } from "./SavedShelf";

/**
 * The two kinds of saved thing, said as one shelf (SavedShelf.tsx). The
 * figure is the one money language (ONE-PRODUCT-DECISIONS recommendation 5):
 * the amount in full ink, the unit grey beside it. A tenancy shows what it
 * costs to move in, as its card did; a place with no price says so in words.
 */
function Figure({ minor, currency, locale, unit }: { minor: number; currency: string; locale: Locale; unit?: string }) {
  return (
    <>
      <Money minor={minor} locale={locale} currency={currency} mode="glance" />
      {unit ? <span className="nf-shelf__unit"> {unit}</span> : null}
    </>
  );
}

function where(area: string | null | undefined, city: string | null | undefined): string {
  return area && city && area !== city ? `${area}, ${city}` : area || city || "";
}

export function listingShelf(listing: Listing, locale: Locale, t: Dictionary, eager: boolean) {
  const price = cardPrice(listing);
  const card = t.catalogue.card;
  const figure =
    price.lead === "moveIn" ? (
      <Figure minor={price.minor} currency={listing.currency} locale={locale} unit={card.moveIn} />
    ) : price.lead === "headline" ? (
      <Figure
        minor={price.minor}
        currency={listing.currency}
        locale={locale}
        unit={price.period === "sale" ? undefined : t.experienceLabels.periodShort[price.period]}
      />
    ) : (
      <span className="nf-shelf__unit">{t.common.priceOnRequest}</span>
    );
  const verified = listing.verified && !listing.isDemo;
  return (
    <SavedShelf
      href={hrefForListing(listing.kind, listing.id, marketFactsOf(listing))}
      title={listing.title}
      where={where(listing.area, listing.city)}
      photo={listing.photos[0] ?? null}
      hue={listing.hue}
      kind={listing.kind}
      figure={figure}
      status={verified ? t.experienceDiscover.shelf.verified : listing.intent === "sale" ? card.forSale : card.forRent}
      verified={verified}
      eager={eager}
    />
  );
}

export function placeShelf(stay: StayCardData, locale: Locale, t: Dictionary, eager: boolean) {
  const verified = stay.verified && !stay.isDemo;
  const figure =
    stay.nightlyMinor !== null ? (
      <Figure minor={stay.nightlyMinor} currency={stay.currency} locale={locale} unit={t.experienceLabels.periodShort.night} />
    ) : (
      <span className="nf-shelf__unit">{t.common.priceOnRequest}</span>
    );
  return (
    <SavedShelf
      href={stay.href}
      title={stay.title}
      where={stay.where}
      photo={stay.photo ?? stay.standIn ?? null}
      hue={stay.hue}
      kind={stay.kind}
      figure={figure}
      status={verified ? t.experienceDiscover.shelf.verified : (stay.hours?.label ?? "")}
      verified={verified}
      eager={eager}
    />
  );
}
