import "server-only";

import { catalogueReader } from "@/lib/catalogue/listings";
import { parseDiscoveryQuery, toSearchHref } from "@/lib/listings/search-params";
import type { IntelligenceResult } from "../contract";
import { cityOf, placeFromLabel, placeLabel, type Place } from "../places";
import { compact } from "./format";
import type { Source } from "./types";

/**
 * A PLACE, AS A RESULT OF ITS OWN.
 *
 * When the words name a place on the closed list, the first answer is the
 * place itself: a door into every published home in it, with the real number
 * of published listings the catalogue holds there (examples included, as the
 * search page counts them). The count comes from the same public read the
 * search page makes, never from a guess.
 */

export function placeHref(place: Place): string {
  return toSearchHref(parseDiscoveryQuery({ area: place.name.toLowerCase() }));
}

export async function placeResult(place: Place): Promise<IntelligenceResult> {
  const rows = await catalogueReader().search({ areas: [place.name.toLowerCase()] });
  const city = cityOf(place);
  return compact({
    key: `place:${place.name.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "place",
    title: place.name,
    href: placeHref(place),
    subtitle: city ? placeLabel(place) : "City",
    place: placeLabel(place),
    count: { value: rows.length, noun: "listings" },
    actions: [{ id: "apply-filters", label: "Search here", href: placeHref(place) }],
  });
}

export const placeSource: Source = {
  kind: "place",
  applies: ({ understood }) => Boolean(understood.place) && understood.kind !== "personal",
  async run(ctx) {
    const place = placeFromLabel(ctx.understood.place);
    if (!place || ctx.offset > 0) return { results: [] };
    return { results: [await placeResult(place)], total: 1 };
  },
};
