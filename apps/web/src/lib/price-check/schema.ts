import { z } from "zod";
import { NIGERIA_BOUNDS } from "./address";
import { REFUSAL_CODES } from "./refusals";

/**
 * What a Price Check server action will accept, and what it will not.
 *
 * A plain module rather than part of `actions.ts`, because a "use server"
 * module may export only async functions: `nf/server-actions-export-only-actions`
 * makes a constant or a schema there a lint error, and its own header records
 * the twenty minute outage that rule exists because of.
 *
 * ---------------------------------------------------------------------------
 * EVERY BOUND HERE IS THE DATABASE'S BOUND, SPELLED TWICE ON PURPOSE.
 *
 * The check constraints on `price_check_events`, `price_check_watches` and
 * `price_check_shares` are the real enforcement and they cannot be talked
 * round. These exist so a person gets a sentence instead of a Postgres error
 * code, and so a bad payload never reaches the wire. Where the two disagree
 * the database wins, and the probe is what proves what the database actually
 * does.
 */

const COORDINATE = {
  lat: z
    .number()
    .min(NIGERIA_BOUNDS.latMin, "That pin is outside Nigeria.")
    .max(NIGERIA_BOUNDS.latMax, "That pin is outside Nigeria."),
  lng: z
    .number()
    .min(NIGERIA_BOUNDS.lngMin, "That pin is outside Nigeria.")
    .max(NIGERIA_BOUNDS.lngMax, "That pin is outside Nigeria."),
};

/** The four we answer for. Everything else refuses before it reaches here. */
export const supportedTypeSchema = z.enum(["apartment", "home", "shop", "office"]);
export const intentSchema = z.enum(["rent", "sale"]);

/**
 * One stage of one check.
 *
 * NOTE WHAT IS ABSENT AND CANNOT BE ADDED: there is no `lat`, no `lng`, no
 * `address` and no `hint` in this schema, because there is no column for any
 * of them in `price_check_events`. The cell is computed on the server from a
 * point the action is handed and never stored, so a caller cannot pass a finer
 * one by passing a longer string: `geohash5` is five characters and the
 * database check refuses anything else.
 */
export const recordStageSchema = z.object({
  checkId: z.uuid(),
  stage: z.enum(["reach", "start", "submit", "outcome", "intent", "convert", "supply"]),
  entryPoint: z.string().max(40).optional(),
  stateCode: z.string().max(10).optional(),
  lgaCode: z.string().max(20).optional(),
  /* The point is taken so the SERVER can coarsen it. It is never persisted. */
  lat: z.number().optional(),
  lng: z.number().optional(),
  propertyType: z.string().max(20).optional(),
  listingIntent: intentSchema.optional(),
  bedrooms: z.number().int().min(0).max(30).optional(),
  sizeStated: z.boolean().optional(),
  outcome: z.enum(["answered", "refused"]).optional(),
  refusalCode: z.enum(REFUSAL_CODES).optional(),
  comparableCount: z.number().int().min(0).optional(),
  radiusM: z.number().int().min(0).optional(),
  dispersion: z.number().optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  intentChosen: z.string().max(40).optional(),
});

/**
 * Tell me when you can answer.
 *
 * The point is rounded to three decimal places by the action before it is
 * written, and `price_check_watches.lat` is `numeric(9,3)`, so a caller that
 * sends full precision gets it stored coarse rather than reviewed by a person.
 */
export const watchSpotSchema = z.object({
  ...COORDINATE,
  stateCode: z.string().min(1).max(10),
  lgaCode: z.string().max(20).optional(),
  /* The area NAME, for the person's own recall of what they asked about. Not
     an address: `price_check_watches` has no address column and the ladder's
     free text hint is not on this schema at all. */
  area: z.string().trim().min(2).max(80).optional(),
  propertyType: supportedTypeSchema,
  listingIntent: intentSchema,
  bedrooms: z.number().int().min(0).max(30).nullable(),
});

/**
 * A share card.
 *
 * THERE IS NO `lat`, NO `lng`, NO `address` AND NO `listingId` HERE, AND THERE
 * MAY NOT BE. The scope enum in the database has two labels and neither of
 * them is a property; this schema is the product-side half of the same rule,
 * and `create_price_check_share` has no parameter for any of them either. A
 * specific property is shared by publishing it as a listing, in exactly one
 * way and no other.
 *
 * The figures are required and positive, because a card is a claim and a
 * refused check has nothing to claim. `listingCount` is at least three, which
 * is the area report's own floor, so a card cannot be minted from two
 * listings.
 */
export const shareAreaSchema = z.object({
  scope: z.enum(["area", "area_and_type"]),
  stateCode: z.string().min(1).max(10),
  lgaCode: z.string().max(20).optional(),
  area: z.string().trim().min(2).max(80).optional(),
  propertyType: supportedTypeSchema.optional(),
  listingIntent: intentSchema,
  bedrooms: z.number().int().min(0).max(30).optional(),
  lowMinor: z.number().int().positive(),
  midMinor: z.number().int().positive(),
  highMinor: z.number().int().positive(),
  listingCount: z.number().int().min(3),
  oldestAt: z.string().optional(),
  newestAt: z.string().optional(),
});

/**
 * What the share action is actually sent: the server's seal over a card it
 * computed (`share-seal.ts`), and nothing else. The card inside is checked
 * against `shareAreaSchema` when the seal is opened.
 */
export const shareSealSchema = z.object({
  seal: z.string().min(1).max(2048),
});

export const areaSuggestionSchema = z.object({
  stateCode: z.string().min(1).max(10),
  query: z.string().max(60).optional(),
});
