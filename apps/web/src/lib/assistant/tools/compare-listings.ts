import { z } from "zod";
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import { getListingRepository } from "@/lib/listings/repository";
import type { Listing } from "@/lib/listings/types";
import { priceLine } from "./listing-facts";
import { EXAMPLE_NOTE } from "./search-listings";
import { defineTool, TOOL_FRAMES } from "./types";

/**
 * Two or three places, side by side, on the facts that actually decide it.
 *
 * The concierge could search and it could read an area, and between those two
 * it could not do the thing people spend most of their time doing on a
 * property site: holding two places against each other. Asked to compare, a
 * model with only a search tool re-runs the search, gets a differently ordered
 * five, and answers from whichever rows came back, which is how a listing that
 * was never mentioned ends up in a comparison.
 *
 * This resolves the exact ids it is given, one row each, and returns them in
 * the order asked for. A row that cannot be found comes back as an explicit
 * not-found entry rather than being dropped, so the model cannot quietly
 * compare two things when it was asked about three.
 */

/**
 * The same row, described for a comparison rather than for a shelf.
 *
 * Deliberately a different shape from the search result. A search answer is
 * "here are five places"; a comparison answer is "these are the four numbers
 * that differ". So this carries the light and water answers, which search
 * summarises into an amenity list, and it carries them as `unanswered` where
 * the host skipped the question rather than omitting the key. That is the one
 * place omission would be wrong: in a side by side, a missing row reads as a
 * no, and "the host did not say" is not a no.
 */
export function comparisonOf(l: Listing): Record<string, unknown> {
  const u = l.utilities;
  return {
    id: l.id,
    title: l.title,
    ...(l.area && l.area !== l.city ? { area: l.area } : {}),
    city: l.city,
    state: l.state,
    kind: l.kind,
    price: priceLine(l),
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    rating: l.rating,
    reviewCount: l.reviewCount,
    verified: l.verified,
    /* UX-25, and the same flag search puts on a row: an example says so, so
       the model can say it too. */
    ...(l.isDemo ? { example: true } : {}),
    powerGrid: u?.powerGrid ?? "unanswered",
    powerBackup: u?.powerBackup ?? "unanswered",
    waterSupply: u?.waterSupply ?? "unanswered",
    prepaidMeter: u?.prepaidMeter ?? "unanswered",
    href: hrefForListing(l.kind, l.id, marketFactsOf(l)),
  };
}

const input = z.object({
  ids: z.array(z.string()).min(2).max(4),
});

/**
 * Resolve exactly the ids asked for, in the order asked for.
 *
 * Sequential rather than parallel on purpose: the cap is four, the repository
 * is one Postgres round trip per id, and four sequential reads behind a chat
 * turn cost less than the concurrency is worth. A miss is reported, never
 * skipped, so a model asked to compare three places cannot silently answer
 * about two.
 */
export async function runCompareListings(raw: z.output<typeof input>): Promise<Record<string, unknown>[]> {
  const ids = raw.ids.filter((v) => v.trim().length > 0).slice(0, 4);
  if (ids.length < 2) {
    return [{ error: "compare_listings needs at least two listing ids from search_listings." }];
  }

  const repo = getListingRepository();
  const out: Record<string, unknown>[] = [];
  for (const id of ids) {
    const row = await repo.byId(id).catch(() => null);
    /*
     * THE SECOND DOOR, AND IT IS NOT CLOSED ANY MORE.
     *
     * This used to report an example listing as `found: false`, on the
     * reasoning that search never returned one so the only way an id could
     * arrive here was a stale turn or an invention. Search returns them now
     * (founder, 26 November 2026; see EXAMPLE_NOTE in search-listings.ts), so
     * that premise is gone and refusing here would be the worse half of the
     * old behaviour: the model offers a row, the person asks to compare it,
     * and the tool answers that it does not exist. That is the same "I found
     * nothing" the change was made to stop, one turn later.
     *
     * So the row comes back, carrying `example: true` exactly as the search
     * result does, and the note below tells the model what that means.
     */
    out.push(row ? comparisonOf(row) : { id, found: false });
  }
  return out;
}

export const compareListingsTool = defineTool({
  name: "compare_listings",
  description:
    "Put two to four Vallo listings side by side on the facts that decide between them: price and what period it covers, bedrooms, bathrooms, where it is, light and water, whether the lister is verified, and the rating with the number of reviews behind it. Pass the listing ids exactly as search_listings returned them. Use this whenever somebody is weighing places against each other rather than asking what is available. An id that cannot be found comes back marked not found; say so rather than leaving it out. A row marked \"example\": true cannot be rented, bought or booked, and you say so every time you mention it.",
  input,
  inputSchema: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
        description: "The listing ids to compare, exactly as search_listings returned them.",
      },
    },
    required: ["ids"],
    additionalProperties: false,
  },
  mode: "read",
  workspaces: TOOL_FRAMES,
  async run(_ctx, args) {
    const rows = await runCompareListings(args);
    /* The same fence the search tool puts up, at the same strength, because a
       comparison table is a recommendation in a tidier shape. */
    return rows.some((row) => row.example === true)
      ? { data: rows, note: EXAMPLE_NOTE }
      : { data: rows };
  },
});
