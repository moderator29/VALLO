import type { Listing } from "@/lib/listings/types";
import { cardPrice, cardUtility } from "@/components/app/listing-card-model";
import type { PeriodSlashWords as PeriodUnitWords } from "@/lib/listings/pricing";

/**
 * THE SHORTLIST, KEPT ON THE PHONE. V-77.
 *
 * People shortlist on the move and compare on a danfo, and a shortlist that
 * vanishes in a dead zone is not a shortlist. So every time `/saved` is read
 * with signal, a light copy of each saved listing is written to the phone
 * (`shelf-store.ts`, IndexedDB `vallo-shelf`), and with no signal the offline
 * page draws the list and a side-by-side compare from it.
 *
 * WHAT A COPY HOLDS. The card's own figures, computed by the same functions
 * the card uses (`cardPrice`, `cardUtility`), so the offline row cannot
 * disagree with the online one: the move-in total or the headline price, the
 * rent beneath it, bedrooms, bathrooms, the power line, the area and state,
 * and whether it is an example listing (drawn with the same Example mark the
 * card carries). NOT the title: the lister's own words are shown only on
 * the listing's page, so a copy is named by its rooms and area instead.
 * No address, no lister contact, no photograph in the row itself (the service
 * worker keeps listing photographs the member has already seen, in its image
 * cache, but the row is the text the phone stored and does not depend on
 * them; it says what it has rather than drawing an empty frame).
 *
 * WAS AND IS NOW. The first figure the phone ever stored for a listing is
 * kept beside the current one, with the date it stored it. When a refresh
 * finds the figure moved, the change says exactly that: "the rent was
 * ₦2,400,000 when this phone first kept it on 3 Oct; it is ₦2,600,000 now."
 * It does NOT say "when you saved it": the phone's first copy may be long
 * after the save, and the save's own figure was never recorded.
 *
 * ONE OWNER. The shelf records the account it was synced for
 * (`shelf-store.ts`); a sync for a different account starts from nothing, so
 * one person's first figures never become another's "was".
 *
 * THE LIST IS THE ACCOUNT'S, NOT THE PHONE'S. A refresh replaces the shelf
 * with exactly what `/saved` returned, so an unsaved listing leaves the phone
 * the next time there is signal. Fifty at most, most recently saved first.
 */

/* 2: the title left the copy and isDemo joined it. A version-1 record is
   not read back; the next sync with signal rewrites it. */
export const SHELF_VERSION = 2;
export const SHELF_CAP = 50;

export type ShelfItem = {
  version: typeof SHELF_VERSION;
  id: string;
  /** Area and state only. Never the lister's title or an address. */
  place: string;
  isDemo: boolean;
  lead: "moveIn" | "headline" | "none";
  /** The move-in total (lead moveIn) or the headline price, in kobo. */
  minor: number | null;
  approximate: boolean;
  /** The rent beneath a move-in total, in kobo. */
  rentMinor: number | null;
  suffix: string;
  bedrooms: number;
  bathrooms: number;
  power: string | null;
  /** When the phone last refreshed this copy. */
  storedAt: string;
  /** The figures the phone first stored for it, for "was and is now". */
  firstMinor: number | null;
  firstRentMinor: number | null;
  firstStoredAt: string;
};

export type ShelfChange = {
  id: string;
  place: string;
  bedrooms: number;
  field: "moveIn" | "rent" | "price";
  wasMinor: number;
  nowMinor: number;
  /** When this phone first kept the figure, ISO 8601. */
  since: string;
};

/** `short` is the reader's "/yr" and "/night" (`t.experienceLabels.periodShort`), kept with the copy as it was read. */
export function shelfFromListing(listing: Listing, now: number, short: PeriodUnitWords): ShelfItem {
  const price = cardPrice(listing);
  const stamp = new Date(now).toISOString();
  const minor = price.lead === "none" ? null : price.minor;
  const rentMinor = price.lead === "moveIn" ? price.rentMinor : null;
  return {
    version: SHELF_VERSION,
    id: listing.id,
    place: [listing.area, listing.state].filter((part) => part && part.trim().length > 0).join(", "),
    isDemo: listing.isDemo === true,
    lead: price.lead,
    minor,
    approximate: price.lead === "moveIn" ? price.approximate : false,
    rentMinor,
    suffix: price.lead === "moveIn" ? short[price.rentPeriod] : price.lead === "headline" && price.period !== "sale" ? short[price.period] : "",
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    power: cardUtility(listing),
    storedAt: stamp,
    firstMinor: minor,
    firstRentMinor: rentMinor,
    firstStoredAt: stamp,
  };
}

/**
 * Fold what `/saved` returned onto what the phone held. The incoming list is
 * the membership; the phone contributes only the first-seen figures.
 */
export function mergeShelf(
  previous: readonly ShelfItem[],
  incoming: readonly ShelfItem[],
  cap: number = SHELF_CAP,
): { items: ShelfItem[]; changes: ShelfChange[] } {
  const held = new Map(previous.map((item) => [item.id, item]));
  const items: ShelfItem[] = [];
  const changes: ShelfChange[] = [];
  for (const fresh of incoming.slice(0, cap)) {
    const old = held.get(fresh.id);
    if (!old) {
      items.push(fresh);
      continue;
    }
    /* The market can change (a let listed for sale), and a figure of a
       different kind is not a change of price; start the history again. */
    const sameKind = old.lead === fresh.lead;
    const item: ShelfItem = sameKind
      ? { ...fresh, firstMinor: old.firstMinor, firstRentMinor: old.firstRentMinor, firstStoredAt: old.firstStoredAt }
      : fresh;
    items.push(item);
    if (!sameKind) continue;
    if (item.firstMinor !== null && item.minor !== null && item.firstMinor !== item.minor) {
      changes.push({
        id: item.id,
        place: item.place,
        bedrooms: item.bedrooms,
        field: item.lead === "moveIn" ? "moveIn" : "price",
        wasMinor: item.firstMinor,
        nowMinor: item.minor,
        since: item.firstStoredAt,
      });
    }
    if (item.firstRentMinor !== null && item.rentMinor !== null && item.firstRentMinor !== item.rentMinor) {
      changes.push({
        id: item.id,
        place: item.place,
        bedrooms: item.bedrooms,
        field: "rent",
        wasMinor: item.firstRentMinor,
        nowMinor: item.rentMinor,
        since: item.firstStoredAt,
      });
    }
  }
  return { items, changes };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** A record read back from IndexedDB, checked before it is believed. */
export function asShelfItem(value: unknown): ShelfItem | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.version !== SHELF_VERSION || typeof v.id !== "string" || !UUID.test(v.id)) return null;
  if (typeof v.place !== "string" || typeof v.suffix !== "string") return null;
  if (v.lead !== "moveIn" && v.lead !== "headline" && v.lead !== "none") return null;
  if (typeof v.storedAt !== "string" || !Number.isFinite(Date.parse(v.storedAt))) return null;
  if (typeof v.firstStoredAt !== "string" || !Number.isFinite(Date.parse(v.firstStoredAt))) return null;
  return {
    version: SHELF_VERSION,
    id: v.id,
    place: v.place,
    isDemo: v.isDemo === true,
    lead: v.lead,
    minor: num(v.minor),
    approximate: v.approximate === true,
    rentMinor: num(v.rentMinor),
    suffix: v.suffix,
    bedrooms: num(v.bedrooms) ?? 0,
    bathrooms: num(v.bathrooms) ?? 0,
    power: typeof v.power === "string" ? v.power : null,
    storedAt: v.storedAt,
    firstMinor: num(v.firstMinor),
    firstRentMinor: num(v.firstRentMinor),
    firstStoredAt: v.firstStoredAt,
  };
}
