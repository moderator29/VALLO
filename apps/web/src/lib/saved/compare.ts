/**
 * THE SAVED COMPARE (recommendation B3, 30 September 2026).
 *
 * The Saved page promised "ready to compare side by side" and had no compare.
 * This is the table behind it: two saved listings at a time (the sheet keeps two), one row per fact,
 * each fact from the listing's own record and its own builders
 * (`moveInLines` for the money at the door, `cardUtility` for power). Built on
 * the server, so the client only chooses columns.
 *
 * HONEST CELLS. A fact the lister did not state reads "Not stated", never a
 * zero. The lowest figure in a money row is marked (a dot and the word, never
 * colour alone), and only when at least two columns stated that figure and
 * they differ: "lowest" of one number, or of a tie, says nothing.
 *
 * Property listings only (the founder's open question on stays is recorded in
 * the B3 write-up); a saved stay or restaurant is not offered here.
 *
 * Pure: no React, no reads.
 */
import { formatMoney, formatNumber, type Dictionary, type Locale } from "@vallo/i18n/core";
import type { Listing } from "@/lib/listings/types";
import { cardUtility } from "@/components/app/listing-card-model";
import { moveInLines } from "@/components/app/listing/move-in-lines";
import { KIND_NOUN } from "@/lib/listings/search-params";
import { placeOf, type CardGlanceMark } from "@/lib/listings/card-glance";

export const COMPARE_MIN = 2;

export type CompareColumn = {
  id: string;
  title: string;
  place: string;
  photo: string | null;
  mark: CardGlanceMark;
};

export type CompareCell = {
  /** What the cell prints; null prints the "Not stated" words. */
  text: string | null;
  /** The figure behind a money cell, in kobo, for finding the lowest. */
  value?: number;
  /** Set by `forSelection`: the lowest stated figure of a row with a real lowest. */
  lowest?: boolean;
};

export type CompareRow = {
  key: string;
  label: string;
  /** "money": figures compared for a lowest; "fact": printed as stated. */
  kind: "money" | "fact";
  cells: CompareCell[];
};

export type CompareCopy = {
  moveIn: string;
  rent: string;
  beds: string;
  baths: string;
  size: string;
  parking: string;
  type: string;
  power: string;
  availableFrom: string;
  from: string;
};

export type CompareTable = { columns: CompareColumn[]; rows: CompareRow[] };

/** Whether a listing belongs in the compare: a property, not a stay. */
export function comparable(listing: Pick<Listing, "kind">): boolean {
  return listing.kind !== "hotel" && listing.kind !== "restaurant" && listing.kind !== "shortlet";
}

/** Mark the lowest of the stated figures, when there is a real lowest. */
export function markLowest(values: (number | undefined)[]): boolean[] {
  const stated = values.filter((v): v is number => typeof v === "number" && v > 0);
  if (stated.length < 2) return values.map(() => false);
  const min = Math.min(...stated);
  if (stated.every((v) => v === min)) return values.map(() => false);
  return values.map((v) => v === min);
}

function tenancy(listing: Listing): boolean {
  return (
    listing.intent !== "sale" &&
    (listing.pricePeriod === "year" || listing.pricePeriod === "month" || listing.pricePeriod === "quarter")
  );
}

function moneyRow(
  key: string,
  label: string,
  values: (number | undefined)[],
  locale: Locale,
  prefix: (i: number) => string = () => "",
): CompareRow {
  return {
    key,
    label,
    kind: "money",
    cells: values.map((v, i) =>
      typeof v === "number" && v > 0 ? { text: `${prefix(i)}${formatMoney(v, locale)}`, value: v } : { text: null },
    ),
  };
}

function factRow(key: string, label: string, texts: (string | null)[]): CompareRow {
  return { key, label, kind: "fact", cells: texts.map((text) => ({ text })) };
}

export function compareTable(
  listings: Listing[],
  locale: Locale,
  copy: CompareCopy,
  moveInCopy: Dictionary["moveIn"],
): CompareTable {
  const chosen = listings;
  const columns: CompareColumn[] = chosen.map((l) => ({
    id: l.id,
    title: l.title,
    place: placeOf(l),
    photo: l.photos[0] ?? null,
    mark: l.isDemo ? "example" : l.verified ? "verified" : null,
  }));

  const rows: CompareRow[] = [];

  /* The move-in total leads, as it does on the card, where it is a tenancy. */
  rows.push(
    moneyRow(
      "moveIn",
      copy.moveIn,
      chosen.map((l) => (tenancy(l) ? l.moveInCostMinor : undefined)),
      locale,
      (i) => (chosen[i]!.moveInCostStated === false ? `${copy.from} ` : ""),
    ),
  );

  /* Rent and the fees at the door, each from the listing's own lines. */
  const lines = chosen.map((l) => moveInLines(l, moveInCopy));
  const keys = lines[0]?.map((part) => part.key) ?? [];
  for (const key of keys) {
    const label = lines[0]!.find((p) => p.key === key)!.label;
    const values = lines.map((ls) => ls.find((p) => p.key === key)?.minor);
    const row = moneyRow(key, key === "rent" ? copy.rent : label, values, locale);
    if (key === "rent") {
      row.cells = row.cells.map((cell, i) => {
        const basis = lines[i]!.find((p) => p.key === "rent")?.basis;
        return cell.text && basis ? { ...cell, text: `${cell.text} ${basis}` } : cell;
      });
    }
    rows.push(row);
  }

  const count = (n: number | undefined) => (typeof n === "number" && n > 0 ? formatNumber(n, locale) : null);
  rows.push(factRow("beds", copy.beds, chosen.map((l) => count(l.bedrooms))));
  rows.push(factRow("baths", copy.baths, chosen.map((l) => count(l.bathrooms))));
  rows.push(
    factRow(
      "size",
      copy.size,
      chosen.map((l) => (typeof l.sizeSqm === "number" && l.sizeSqm > 0 ? `${formatNumber(l.sizeSqm, locale)} m²` : null)),
    ),
  );
  rows.push(factRow("parking", copy.parking, chosen.map((l) => count(l.parkingSpaces))));
  rows.push(
    factRow(
      "type",
      copy.type,
      chosen.map((l) => {
        const one = KIND_NOUN[l.kind]?.one;
        return one ? one.charAt(0).toUpperCase() + one.slice(1) : null;
      }),
    ),
  );
  rows.push(factRow("power", copy.power, chosen.map((l) => cardUtility(l))));
  rows.push(
    factRow(
      "available",
      copy.availableFrom,
      chosen.map((l) => (l.availableFrom ? formatDay(l.availableFrom, locale) : null)),
    ),
  );

  return { columns, rows };
}

/**
 * The table for the columns the reader chose, in the order chosen: the lowest
 * figure marked among THOSE columns, and a row nobody stated anything for
 * dropped (it is noise, not a comparison).
 */
export function forSelection(table: CompareTable, ids: readonly string[]): CompareTable {
  const at = ids.map((id) => table.columns.findIndex((c) => c.id === id)).filter((i) => i >= 0);
  const columns = at.map((i) => table.columns[i]!);
  const rows = table.rows
    .map((row) => {
      const cells = at.map((i) => ({ ...row.cells[i]!, lowest: false }));
      if (row.kind === "money") {
        const lowest = markLowest(cells.map((c) => c.value));
        cells.forEach((c, i) => {
          c.lowest = lowest[i] ?? false;
        });
      }
      return { ...row, cells };
    })
    .filter((row) => row.cells.some((cell) => cell.text !== null));
  return { columns, rows };
}

function formatDay(iso: string, locale: Locale): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const tag = locale === "en" ? "en-NG" : locale;
  try {
    return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(at);
  }
}
