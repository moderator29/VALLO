import { getDictionary } from "@vallo/i18n";
import { catalogueReader } from "@/lib/catalogue/listings";
import type { Listing, ListingKind } from "@/lib/listings/types";
import { getLocale } from "@/lib/locale";
import { MapCanvas, type MapCity } from "./MapCanvas";
import { localityFor, spreadCoincident } from "./mapGeo";
import { isModestExample } from "@/lib/listings/example-imagery";
import type { MapListing } from "./mapTypes";

/**
 * One covered city, as the search page hands it over.
 *
 * The shape is unchanged, and the page is unchanged with it: `price` is the
 * already formatted floor for that city and `count` how many places sit there.
 * This component now reads the catalogue itself and draws a pin per place, so
 * it uses the city entries for their coordinates and for the opening view.
 * What it would rather receive is the result set the page has already
 * computed, so the map and the results header can never disagree; that is a
 * prop change on a file another agent owns, so it is proposed rather than
 * taken (see the handover note in the report).
 */
export type CityPin = {
  city: string;
  lat: number;
  lng: number;
  /** Formatted lowest nightly price, e.g. "₦25,000". */
  price: string;
  count: number;
};

/** Category nouns, for a listing whose source published no amount. */
const KIND_LABEL: Record<ListingKind, string> = {
  hotel: "Hotel",
  apartment: "Apartment",
  home: "Home",
  shortlet: "Shortlet",
  villa: "Villa",
  restaurant: "Restaurant",
  experience: "Experience",
  rental: "Rental",
  shop: "Shop",
  office: "Office",
  land: "Land",
};

/*
 * WHAT THE FIGURE COVERS, FROM THE LISTING'S OWN PERIOD (search-map track).
 * This read `pricePeriod === "year" ? "year" : "night"`, so a monthly or
 * quarterly rent was printed "/ night" on the docked card and a house for
 * sale was priced by the night. The period column states the cycle; a sale
 * has none.
 */
function periodFor(listing: Listing): MapListing["period"] {
  if (listing.kind === "restaurant" || listing.kind === "experience") return "guest";
  if (listing.intent === "sale") return "sale";
  switch (listing.pricePeriod) {
    case "year":
    case "month":
    case "quarter":
    case "guest":
      return listing.pricePeriod;
    default:
      return "night";
  }
}

/**
 * The live map.
 *
 * A server component so the catalogue is read where the catalogue lives, and
 * only the handful of fields a pin and a docked card need cross to the client.
 * Placement happens here too: the catalogue names a locality, never a
 * coordinate, so each listing is put on the real centroid of its area when we
 * know it and on its city when we do not, and pins that would land on the very
 * same point are fanned out by about six hundred metres so a pair in Victoria
 * Island stays readable. The surface says which of the two it is doing.
 */
export async function RealMap({
  pins,
  active,
  listings,
  listHref,
  fill = false,
}: {
  /** Fill the parent's height: the desktop list's sticky map. */
  fill?: boolean;
  pins: CityPin[];
  active?: string;
  /** The same results as a list, where a place with no pin is still drawn (Session 3, W2). */
  listHref?: string;
  /** Escape hatch for a caller that has already resolved the result set. */
  listings?: Listing[];
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  // The map follows the text query it was given, so it shows the same places
  // the results header counts rather than the whole country every time.
  const catalogue = listings ?? (await catalogueReader().search({ q: active }));

  const cityAt = new Map(pins.map((pin) => [pin.city.toLowerCase(), pin]));
  const placed: { listing: Listing; at: { lat: number; lng: number }; byArea: boolean }[] = [];
  for (const listing of catalogue) {
    const city = cityAt.get(listing.city.toLowerCase());
    // No coordinate for the city means no honest place to draw it.
    if (!city) continue;
    const { at, byArea } = localityFor(listing.city, listing.area, {
      lat: city.lat,
      lng: city.lng,
    });
    placed.push({ listing, at, byArea });
  }

  const mapListings: MapListing[] = spreadCoincident(placed).map(
    ({ listing, at, byArea }) => ({
      id: listing.id,
      title: listing.title,
      area: listing.area,
      city: listing.city,
      kindLabel: KIND_LABEL[listing.kind],
      kind: listing.kind,
      priceMinor: listing.priceMinor,
      currency: listing.currency,
      period: periodFor(listing),
      rating: listing.rating,
      reviewCount: listing.reviewCount,
      ...(listing.photos[0] ? { photo: listing.photos[0] } : {}),
      hue: listing.hue,
      ...(listing.bedrooms > 0 ? { bedrooms: listing.bedrooms } : {}),
      ...(listing.bathrooms > 0 ? { bathrooms: listing.bathrooms } : {}),
      ...(listing.sizeSqm !== undefined && listing.sizeSqm > 0 ? { sizeSqm: listing.sizeSqm } : {}),
      verified: listing.verified,
      isDemo: listing.isDemo,
      drawn: isModestExample(listing),
      lat: at.lat,
      lng: at.lng,
      byArea,
    }),
  );

  const cities: MapCity[] = pins.map((pin) => ({
    city: pin.city,
    lat: pin.lat,
    lng: pin.lng,
    count: pin.count,
  }));

  /*
   * THE LISTING WITH NO PIN (B-27). A place whose city has no coordinate is
   * not guessed onto the map: it is counted, and the map says how many are
   * not on it and opens them as a list, where they are drawn like any other.
   * Silently dropping them would make the map's count disagree with the
   * results' count with nothing to say why.
   */
  const unplaced = catalogue.length - placed.length;
  const dm = t.experienceDiscover.map;

  return (
    <MapCanvas
      fill={fill}
      unplaced={unplaced}
      {...(listHref ? { listHref } : {})}
      listings={mapListings}
      cities={cities}
      {...(active ? { active } : {})}
      locale={locale}
      copy={{
        night: t.common.night,
        year: t.common.year,
        guest: t.experienceLabels.periodShort.guest,
        month: t.catalogue.card.perMonth,
        quarter: t.catalogue.card.perQuarter,
        sqm: t.catalogue.card.sqm,
        verified: t.common.verified,
        about: t.searchV2.map.about,
        credits: t.searchV2.map.credits,
        noPinOne: dm.noPinOne,
        noPinMany: dm.noPinMany,
        noPinList: dm.noPinList,
        emptyTitle: dm.emptyTitle,
        emptyArea: dm.emptyArea,
        emptySearch: dm.emptySearch,
        emptyAction: dm.emptyAction,
        imageryOffline: dm.imageryOffline,
        creditJoin: dm.creditJoin,
        approximate: dm.approximate,
      }}
      wholeMapHref="/search?view=map"
    />
  );
}
