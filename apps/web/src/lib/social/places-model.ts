/**
 * The way in: Nigeria as 37 doors, and 774 behind them.
 *
 * Client safe on purpose, like `areas-schema.ts` beside it. The picker is a
 * client component and needs these types and these sentences; putting them
 * next to the server reads would make the module server-only and the import
 * would typecheck and then fail the build, which is the trap recorded in
 * docs/archive/HANDOFF.md section 6 and which this project has hit for real.
 *
 * The geography itself is the database's, not this file's. `public.states` has
 * the 36 states and the FCT, `public.local_governments` has all 774, and
 * `public.enter_place` is the only thing that turns a local government code
 * into a place somebody can stand in. Nothing here duplicates any of that: it
 * describes the shapes those reads come back in and the words used about them.
 */

import type { AreaStatus } from "./areas-model";
import { countOf } from "@vallo/i18n/core";
import { placesCopyEn, placesFailureEn } from "@vallo/i18n/en/places";

/** One of the 774 rows in `public.local_governments`. */
export type LgaNode = {
  /** Readable and stable, for example `la_eti_osa`. The key `enter_place` takes. */
  code: string;
  name: string;
};

/** One of the 37 rows in `public.states`, with its local governments under it. */
export type StateNode = {
  /** Two letters. Lagos is LA, the Federal Capital Territory is FC. */
  code: string;
  name: string;
  lgas: LgaNode[];
};

/**
 * The whole country, once. Thirty-seven states, 774 local governments, about
 * thirty kilobytes before compression, and it is sent to the browser whole on
 * purpose: it is what lets a tap on Kano draw 44 chips with no round trip and
 * no spinner, on a connection where a round trip is a quarter of a second.
 */
export type PlaceTree = StateNode[];

/**
 * A local government that already has a door standing open, which is to say an
 * `areas` row whose `lga_code` is that local government. The picker draws these
 * differently and links straight to them, because walking into a place that
 * already exists must not require an account.
 */
export type OpenPlace = {
  lgaCode: string;
  slug: string;
  name: string;
  status: AreaStatus;
  memberCount: number;
  postCount: number;
};

/**
 * A place that sits INSIDE a local government rather than being one: Lekki
 * Phase 1 inside Eti-Osa, UNILAG inside Lagos Mainland. `areas.within_lga_code`
 * carries this on every place, so the finer places behind one door are a single
 * predicate rather than a join nobody can read.
 */
export type PlaceWithin = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  status: AreaStatus;
  memberCount: number;
  postCount: number;
};

/**
 * Codes are `<state>_<name>`, lower case, non-letters folded to underscores.
 * This is a shape check and not the authority: `enter_place` raises RM030 for a
 * code that is not one of the 774, and that refusal is the real one.
 */
export const LGA_CODE_RE = /^[a-z]{2}_[a-z0-9_]{2,60}$/;

/**
 * The two SQLSTATEs `public.enter_place` raises, and the one Postgres can raise
 * underneath it. Every one gets a sentence a person can act on, because a code
 * on a screen is a dead end with a number in it.
 */
export const ENTER_SQLSTATE = {
  /** The code is not one of the 774. */
  noSuchLga: "RM030",
  /** The row could not be created and could not be found afterwards. */
  couldNotOpen: "RM031",
  /** A place already answers to the web address this one would have taken. */
  slugTaken: "23505",
} as const;

/** SW11: static strings from `packages/i18n/src/locales/places.en.ts`. */
const _pf = { copy: placesCopyEn, failure: placesFailureEn };

export const ENTER_FAILURE = _pf.failure;

/**
 * The words on the way in. One place for them, so the page, the empty state and
 * the test cannot drift apart.
 */
const _pc = _pf.copy;
export const PLACE_COPY = {
  ..._pc,
  searchInState: (state: string) => `Search ${state} local governments`,
  lgaHint: (state: string, count: number) =>
    `${countOf(count, "localGovernments")} in ${state}. Tap one to go in.`,
  withinTitle: (name: string) => `Inside ${name}`,
} as const;
