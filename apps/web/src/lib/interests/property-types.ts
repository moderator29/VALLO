import { Constants } from "../supabase/database.types";
import type { Database } from "../supabase/database.types";

/*
 * SPEED-6: THE VOCABULARY WITHOUT THE VALIDATOR. These lived in `schema.ts`
 * beside the zod schemas, and `ListingCard` (a client component on every
 * catalogue screen) imported `isPropertyType` from there, which put the whole
 * of zod, about 62 KB gzipped, into the first load of /search, /stays and the
 * listing page. They are plain data and plain functions, so they live here and
 * `schema.ts` re-exports them: every existing import keeps working, and a
 * client that needs only the words no longer ships the validator.
 */

/**
 * What a person may say they came here for.
 *
 * The vocabulary is `public.property_type`, the enum the catalogue is already
 * filed under and the one `/search?type=` already filters on. There is
 * deliberately no second "interests" taxonomy: a parallel list would need a
 * mapping to this one forever, and a mapping nobody owns is how two vocabularies
 * drift apart until the stated intent stops meaning anything the catalogue can
 * answer.
 *
 * `Constants` is generated from the database, so this list cannot fall behind
 * the enum: add a value in Postgres, regenerate, and the option appears here,
 * in the validator and on the screen at once. The only thing hand-written is
 * the label, because a database value is not a sentence.
 */

export type PropertyType = Database["public"]["Enums"]["property_type"];

/** Every value the enum holds, straight from the generated constants. */
export const PROPERTY_TYPES = Constants.public.Enums.property_type;

/**
 * How each value is said out loud, and the one line under it.
 *
 * Plural, because the person is choosing a market to be shown, not a single
 * place. The sub-line exists because "rental" and "shortlet" are not the same
 * thing to somebody arriving for the first time, and neither is "apartment"
 * versus "home". Every line here describes what the platform actually lists.
 */
/** SW11: source of truth is now the `interests` section of the i18n dictionary. */
import { getDictionary } from "@vallo/i18n";
const _i = getDictionary("en").interests;
export const INTEREST_COPY: Record<PropertyType, { label: string; hint: string }> =
  Object.fromEntries(
    PROPERTY_TYPES.map((t) => [t, { label: (_i.markets as Record<string, string>)[t] ?? t, hint: (_i.hints as Record<string, string>)[t] ?? "" }])
  ) as Record<PropertyType, { label: string; hint: string }>;

/**
 * Read a stored array back into known values.
 *
 * A column can hold a value this build has never heard of - an enum widened by
 * a migration that shipped ahead of the app - so reads are filtered rather than
 * trusted. An unknown value is ignored, never rendered as a blank card.
 */
export function knownInterests(raw: readonly string[] | null | undefined): PropertyType[] {
  if (!raw) return [];
  const known = new Set<string>(PROPERTY_TYPES);
  return raw.filter((value): value is PropertyType => known.has(value));
}

/**
 * Is this string one of the markets we file the catalogue under?
 *
 * A discovery result is a `ListingKind`, which is `property_type` PLUS
 * `restaurant` and `experience` - two things the catalogue lists but nobody can
 * state an interest in, because the column that stores the answer is a
 * `property_type[]` and would refuse them. The per-card control asks this
 * before it renders, so a restaurant card carries no control at all rather than
 * one that fails on the server. Widening `property_type` in Postgres and
 * regenerating is all it would take for that to change; nothing here is
 * hand-listed.
 */
export function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}
