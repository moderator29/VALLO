/**
 * VALLO INTELLIGENCE: THE SHARED CONTRACT (16 November 2026).
 *
 * One place to find, discover and reach anything on Vallo: homes, stays,
 * restaurants, roommates, people, communities, posts, features, help, and
 * (signed in) the member's own saved homes, offers, bookings and messages.
 *
 * This file is the contract between the engine (`lib/intelligence/*`, the
 * routes under `app/api/intelligence/*`, the SQL) and the screen
 * (`app/(app)/intelligence`, `components/app/intelligence/*`). Both sides
 * build against these shapes; change them here first.
 *
 * Ground rules the shapes carry:
 *   - every result is a real record or a real screen. Nothing here is written
 *     by a model: the model only turns words into a `Understood` (filters);
 *     the rows come from the database or the route registry;
 *   - a price, a count or a rating is present only when the record has it;
 *   - `personal` results belong to the signed-in member and are read through
 *     their own session (RLS), never the service key.
 */

/** The groups a result can belong to, in the order "All" ranks them by default. */
export const INTELLIGENCE_KINDS = [
  "place", // a location: "Lekki, Lagos"
  "property", // a listing to rent or buy (not a stay, not a restaurant)
  "stay", // a short-let, hotel, serviced apartment
  "restaurant",
  "roommate", // a roommate listing or profile open to discovery
  "person", // a discoverable profile (agents, landlords, hosts, members who allow it)
  "community", // a public Circle community
  "post", // a public feed post
  "screen", // a Vallo screen or action: "change my email" -> /settings/account
  "guide", // a help article or how-to
  "personal", // the member's own: saved, offers, bookings, messages, listings
] as const;
export type IntelligenceKind = (typeof INTELLIGENCE_KINDS)[number];

/** The tabs on the results screen. "all" mixes; the rest map onto kinds. */
export const INTELLIGENCE_TABS = ["all", "property", "stay", "restaurant", "roommate", "person", "community", "guide", "personal"] as const;
export type IntelligenceTab = (typeof INTELLIGENCE_TABS)[number];

/** What Vallo understood from the words, shown as "Search understood" chips the person can remove. */
export interface Understood {
  /** The words as typed, never rewritten silently. */
  raw: string;
  /** A spelling or alias fix, offered not applied: "Searching for restaurants?" */
  didYouMean?: string;
  /** The category the words point at, when they point at one. */
  kind?: IntelligenceKind;
  /** rent | buy | stay, when said. */
  intent?: "rent" | "buy" | "stay";
  /** Normalised place: "Lekki Phase 1, Lagos". */
  place?: string;
  bedrooms?: number;
  /** Naira, whole units. */
  maxPrice?: number;
  minPrice?: number;
  furnished?: boolean;
  amenities?: string[];
  /** ISO dates (Africa/Lagos) for stays. */
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  /** "this week", "new": only listings added since. ISO date. */
  addedSince?: string;
  /** The listing kind(s) the marketplace knows (`ListingKind` in lib/listings/types.ts). */
  listingKinds?: string[];
  /** Words left over after the filters were taken out, searched as text. */
  text?: string;
  /** How the words were read: rules alone, or rules then the model. */
  via: "rules" | "model";
  /** When the model was unsure, the question to put to the person (with tap answers). */
  clarify?: { question: string; options: { label: string; patch: Partial<Understood> }[] };
}

/** One thing the person can do from a result without opening it first. Only ones that really exist. */
export interface ResultAction {
  id: "open" | "save" | "offer" | "book" | "reserve" | "message" | "follow" | "view-profile" | "apply-filters";
  label: string;
  href?: string;
}

/** One result row. Fields beyond the first four are present only when the record has them. */
export interface IntelligenceResult {
  /** Stable across requests: `${kind}:${id}`. */
  key: string;
  kind: IntelligenceKind;
  title: string;
  href: string;
  subtitle?: string;
  imageUrl?: string;
  /** Naira, whole units, with what it is for. */
  price?: { amount: number; per?: "month" | "year" | "night" | "once" };
  place?: string;
  bedrooms?: number;
  verified?: boolean;
  /**
   * Followers, members, listings: a real count from the record. `noun` is a
   * `UnitNoun` key of `@vallo/i18n` ("followers", "members", "replies",
   * "listings"), so the screen prints it with `countOf(value, noun, locale)`.
   */
  count?: { value: number; noun: string };
  /** Why this matched, in a few words, from the filters: "2 bedrooms · Lekki · under ₦5m". */
  why?: string;
  actions?: ResultAction[];
  /** For people: whether the viewer already follows them, and whether it is the viewer. */
  person?: { handle?: string; role?: string; following?: boolean; isYou?: boolean };
}

/** A typed-ahead suggestion: a search to run, or a place to go straight to. */
export interface Suggestion {
  key: string;
  kind: IntelligenceKind | "query" | "recent";
  label: string;
  /** Small grey text: "Location", "Search", "Listing". */
  hint?: string;
  /** Run this as a search... */
  query?: string;
  /** ...or go straight here. */
  href?: string;
  imageUrl?: string;
}

/** GET /api/intelligence/suggest?q=&tab= : fast, no model, under ~150ms. */
export interface SuggestResponse {
  q: string;
  suggestions: Suggestion[];
  didYouMean?: string;
}

/** GET /api/intelligence/search?q=&tab=&cursor=&...filters */
export interface SearchResponse {
  q: string;
  understood: Understood;
  tab: IntelligenceTab;
  /** Tabs that have at least one result, with exact counts where cheap to know. */
  tabs: { tab: IntelligenceTab; count?: number }[];
  results: IntelligenceResult[];
  /** For "all": results grouped by kind, each group capped, in rank order. */
  groups?: { kind: IntelligenceKind; results: IntelligenceResult[]; more?: string }[];
  /** Opaque; pass back as `cursor` for the next page. Absent on the last page. */
  next?: string;
  /** When nothing matched: real ways forward (broader place, drop a filter, a related query). */
  alternatives?: { label: string; query?: string; href?: string }[];
  /** Something partly failed (one source down); results from the others still shown. */
  partial?: boolean;
  /**
   * Added by the engine (backward compatible): the words as typed found
   * nothing, so the results are for the spelling fix, and the screen says so
   * ("Showing results for restaurants in Victoria Island. Search instead for
   * resturants in VI"). Absent whenever the results are for the words as typed.
   */
  showing?: { query: string; insteadOf: string };
  /** Server time spent, for the analytics desk. */
  tookMs: number;
}

/** GET /api/intelligence/discover : the empty screen. Each list may be empty; never invented. */
export interface DiscoverResponse {
  /** Aggregated from real searches; omitted until enough people searched (privacy floor). */
  popular: { query: string }[];
  /** The signed-in member's own recent searches (newest first). */
  recent: { query: string; at: string }[];
  /** Newest real listings, stays, restaurants. */
  fresh: IntelligenceResult[];
  /** People to follow: real discoverable profiles, never the viewer. */
  people: IntelligenceResult[];
  /** Example searches that are known to return results today. */
  examples: string[];
  /**
   * Added 16 November 2026 (round 3), backward compatible: every field below
   * is optional, and a screen built before it simply never reads them.
   *
   * The explore tiles' real facts, per listing side. Counts and areas come
   * from published listings that are NOT examples, so a catalogue of
   * examples (or none) gives zeros and no areas, and the screen prints no
   * count at all. Absent when the catalogue could not be read.
   */
  categories?: CategoryFacts[];
  /** Areas with the most new real listings in the last 30 days (two or more each). Empty when none. */
  trending?: TrendingArea[];
  /**
   * For a signed-in member only, built from their own records read through
   * their own session (saved homes, saved searches, stated interests, their
   * last search). Each item says why it is there; a rail with nothing in it
   * is left out, and a visitor never gets the field.
   */
  forYou?: ForYouRail[];
}

/** One explore tile's facts (round 3). Zero is a real answer: the screen prints no count for it. */
export interface CategoryFacts {
  tab: "property" | "stay" | "restaurant";
  /** Published listings on this side that are not examples. */
  live: number;
  /** Of those, published in the last seven days. */
  newThisWeek: number;
  /** Areas holding at least one of them, most first. */
  areas: { name: string; city: string }[];
  /** The newest of them, newest first. */
  latest: IntelligenceResult[];
}

/** An area that is busy right now: `newListings` real listings published there in the last 30 days. */
export interface TrendingArea {
  area: string;
  city: string;
  newListings: number;
}

/**
 * Why a "For you" item is there, as data; the screen says it in words.
 * The first six are `lib/search/best-matches.ts`'s own reasons.
 */
export type ForYouReason =
  | { key: "areaBudget" | "areaSaved" | "nearSaved"; area: string }
  | { key: "budget" | "saved" }
  | { key: "kind"; kind: string }
  | { key: "lastSearch"; query: string }
  | { key: "newSince"; since: string };

/** One "For you" rail. `query` names the last search, `since` is when it was made (ISO). */
export interface ForYouRail {
  id: "matches" | "lastSearch" | "newSince";
  query?: string;
  since?: string;
  items: { result: IntelligenceResult; reason: ForYouReason }[];
}
