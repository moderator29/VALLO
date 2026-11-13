import { countOf, formatNumber, type Dictionary, type Locale } from "@vallo/i18n/core";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { Listing } from "@/lib/listings/types";

/**
 * THE FACT CHIPS UNDER THE TITLE (founder's reference, 13 October 2026).
 *
 * Beds, baths and size first, because those are the three a renter reads
 * before anything else, then what the place carries: parking, backup power,
 * guests on a stay, toilets, furnishing, the floor and the build. Each chip is
 * a column the lister filled in; a column nobody filled is not drawn, so the
 * row is exactly as long as the truth and never pads itself with a zero.
 *
 * PURE AND IN ITS OWN FILE so it can be proved under the unit config, which
 * cannot import a `.tsx` file (see `lister-role.ts` for why), and so the
 * server page can build the chips while the row that draws them is a client
 * component with a "+N" toggle.
 */
export type SpecChip = { key: string; icon: UiIconName; label: string };

/** How many chips show before the "+N" chip, as the reference draws them. */
export const SPEC_CHIPS_VISIBLE = 5;

export function specChips(
  listing: Listing,
  t: Dictionary,
  locale: Locale,
  /** The reader's floor-area unit (`formatArea` bound to it); square metres when absent. */
  areaText?: (sqm: number, sqmLabel: string) => string,
): SpecChip[] {
  const chips: SpecChip[] = [];
  const copy = t.catalogue.detail;
  const facts = t.experienceDetail.listing.facts;
  if (listing.bedrooms > 0) {
    chips.push({ key: "beds", icon: "bed", label: countOf(listing.bedrooms, "beds", locale) });
  }
  if (listing.bathrooms > 0) {
    chips.push({ key: "baths", icon: "bath", label: countOf(listing.bathrooms, "baths", locale) });
  }
  if (listing.sizeSqm !== undefined && listing.sizeSqm > 0) {
    chips.push({
      key: "size",
      icon: "grid",
      label: areaText
        ? areaText(listing.sizeSqm, t.catalogue.card.sqm)
        : `${formatNumber(listing.sizeSqm, locale)} ${t.catalogue.card.sqm}`,
    });
  }
  /* Said once: when the amenity row under the chips already carries parking
     or backup power (the lister ticked it), the chip would be the same fact
     twice in one card. */
  const ticked = new Set(listing.amenities);
  if (listing.parkingSpaces !== undefined && listing.parkingSpaces > 0 && !ticked.has("parking")) {
    chips.push({ key: "parking", icon: "parking", label: copy.parking });
  }
  const backup = listing.utilities?.powerBackup;
  if (backup && backup !== "NONE" && !ticked.has("generator")) {
    chips.push({ key: "power", icon: "bolt", label: copy.generator });
  }
  if (listing.maxGuests !== undefined && listing.maxGuests > 0 && listing.pricePeriod === "night") {
    chips.push({ key: "guests", icon: "user", label: countOf(listing.maxGuests, "guests", locale) });
  }
  /* Toilets only when they say something the baths did not: a flat with two
     bathrooms and two toilets has said it once already. */
  if (listing.toilets !== undefined && listing.toilets > 0 && listing.toilets !== listing.bathrooms) {
    chips.push({ key: "toilets", icon: "droplet", label: countOf(listing.toilets, "toilets", locale) });
  }
  if (listing.furnished) {
    chips.push({ key: "furnished", icon: "home", label: t.experienceLabels.furnishing[listing.furnished] });
  }
  if (listing.floor !== undefined) {
    chips.push({
      key: "floor",
      icon: "building-apartment",
      label: listing.floor === 0 ? facts.groundFloor : facts.floorN.replace("{n}", formatNumber(listing.floor, locale)),
    });
  }
  if (listing.condition) {
    chips.push({ key: "condition", icon: "key", label: t.experienceLabels.condition[listing.condition] });
  }
  return chips;
}

/**
 * The visible run and the rest. When only one chip would hide behind "+N",
 * it is drawn instead: a "+1" chip is the same width as the chip it hides.
 */
export function splitChips(
  chips: readonly SpecChip[],
  visible: number = SPEC_CHIPS_VISIBLE,
): { shown: SpecChip[]; hidden: SpecChip[] } {
  if (chips.length <= visible + 1) return { shown: [...chips], hidden: [] };
  return { shown: chips.slice(0, visible), hidden: chips.slice(visible) };
}
