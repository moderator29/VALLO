import { countOf, formatNumber, type Dictionary, type Locale } from "@vallo/i18n/core";
import type { Listing } from "@/lib/listings/types";
import { cardMarket, cardPrice, type CardMarket } from "@/components/app/listing-card-model";
import type { cardGlance } from "@/lib/listings/card-glance";

/**
 * The words the home list cards print, picked off the dictionary once by the
 * page and handed down as plain data, so the card is a client component that
 * never imports the dictionary (it is 448 KB, and a runtime import from a
 * client module would put all of it in the route's first load).
 */
export type HomeCardCopy = {
  /** Section-less words: the market chip, the price units and the open label. */
  market: Record<CardMarket, string>;
  moveIn: string;
  from: string;
  periodShort: Record<"month" | "quarter" | "year" | "night" | "guest", string>;
  open: string;
  noPhotos: string;
  /** "Photo {at} of {count}", the card gallery's accessible name. */
  photoLabel: string;
  example: string;
  sqm: string;
  /** For the hand-off to the listing's loading shell (`cardGlance`). */
  cardCopy: Parameters<typeof cardGlance>[2];
};

export function homeCardCopyOf(t: Dictionary): HomeCardCopy {
  return {
    market: t.landing.card.market,
    moveIn: t.catalogue.card.moveIn,
    from: t.homeV2.priceFrom,
    periodShort: t.experienceLabels.periodShort,
    open: t.experienceDiscover.stack.open,
    noPhotos: t.catalogue.card.noPhotos,
    photoLabel: t.homeV2.photoOf,
    example: t.catalogue.card.example,
    sqm: t.catalogue.card.sqm,
    cardCopy: {
      moveIn: t.catalogue.card.moveIn,
      perYear: t.catalogue.card.perYear,
      perMonth: t.catalogue.card.perMonth,
      perQuarter: t.catalogue.card.perQuarter,
      night: t.catalogue.card.night,
      head: t.catalogue.card.head,
    },
  };
}

/** The status chip on the photograph: the market in words, or Example. */
export function chipOf(listing: Listing, copy: HomeCardCopy): string {
  return listing.isDemo ? copy.example : copy.market[cardMarket(listing)];
}

/**
 * The price and what it is. A move-in total says "to move in" and, when it is
 * a floor built from the parts the lister named, "from" before it. A rent says
 * its period, a sale says nothing. No figure on the row, no price line.
 */
export type HomeCardPrice = {
  minor: number;
  from: boolean;
  unit: string | null;
  /** The figure is the move-in total, an obligation: no currency guide beside it. */
  moveIn: boolean;
};

export function priceOf(listing: Listing, copy: HomeCardCopy): HomeCardPrice | null {
  const price = cardPrice(listing);
  if (price.lead === "none") return null;
  if (price.lead === "moveIn") return { minor: price.minor, from: price.approximate, unit: copy.moveIn, moveIn: true };
  return {
    minor: price.minor,
    from: false,
    moveIn: false,
    unit: price.period === "sale" ? null : copy.periodShort[price.period as keyof HomeCardCopy["periodShort"]],
  };
}

/** ["2 beds", "2 baths", "120 m²"], only the facts the lister stated. */
export function factsOf(
  listing: Listing,
  copy: HomeCardCopy,
  locale: Locale,
  /** The reader's floor-area unit (`useAreaText`); square metres when absent. */
  areaText?: (sqm: number, sqmLabel: string) => string,
): string[] {
  const parts: string[] = [];
  if (listing.bedrooms > 0) parts.push(countOf(listing.bedrooms, "beds", locale));
  if (listing.bathrooms > 0) parts.push(countOf(listing.bathrooms, "baths", locale));
  if (listing.sizeSqm !== undefined && listing.sizeSqm > 0) {
    parts.push(
      areaText
        ? areaText(Math.round(listing.sizeSqm), copy.sqm)
        : `${formatNumber(Math.round(listing.sizeSqm), locale)} ${copy.sqm}`,
    );
  }
  return parts;
}
