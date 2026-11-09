import { waterLabelEn } from "@vallo/i18n/en/listings-labels";
import { LISTING_ROLES, type ListingRole } from "@/lib/supply/roles";
import { WATER_SOURCES, type ListingKind, type ListingSearchFilter, type WaterSupply } from "./types";
import { UNIT_SHAPES, shapeFromSlug, shapeSlug, type UnitShape } from "./unit-shape";

/**
 * The discovery URL contract.
 *
 * The address bar is the single source of truth for a search. Every control on
 * the page writes here and nothing else, so a filtered hunt can be copied to a
 * friend, opened on a second device, bookmarked, and walked backwards with the
 * browser's own back button. There is no client state that the URL does not
 * already describe.
 *
 *   q          free text
 *   type       category, one of the real ListingKind values
 *              (legacy aliases: "property" is apartment, "rent" is rental)
 *   sort       recommended | newest | price-asc | price-desc | move-in-asc
 *              (top-rated is gone, V-67: a tenancy cannot be reviewed today, so
 *              it ordered on nothing; an old link reads as recommended)
 *   view       list | map
 *   min, max   budget bounds in WHOLE NAIRA, the one place naira appears
 *   beds       minimum bedrooms
 *   baths      minimum bathrooms
 *   guests     minimum party size the place must take
 *   amenities  comma separated amenity codes, all of which must be present
 *   instant    "1" for instant book only
 *   verified   "1" for first-party verified inventory only
 *   power      comma separated, ALL must hold: "backup", "band-a"
 *   water      comma separated water sources, ANY of which will do:
 *              "mains", "borehole", "storage", "tanker"
 *   by         comma separated supply kinds, ANY of which will do:
 *              "owner", "agent", "firm"
 *   landlord   "away": the lister said the landlord lives elsewhere (V-28)
 *   parking    "inside": the lister said a car parks inside the compound (V-28)
 *   serviced   "1": Serviced, derived from what the charge covers (V-68)
 *   estate     "gated": a gated estate with controlled entry (V-68)
 *   shape      comma separated unit shapes, ANY of which will do:
 *              "self-contain", "mini-flat", "flat", "duplex", ... (V-66)
 *   bq         "1": a boys' quarters comes with it (V-66)
 *   area       comma separated areas, ANY of which will do: "yaba,akoka",
 *              what "Yaba/Akoka" in the search box becomes (V-66)
 *   noflood    "1": no flooding reported, by the lister or residents (V-41)
 *   to         a landmark slug: where the reader goes every day (V-43)
 *   within     minutes: at most this long at the morning rush to `to` (V-43)
 *   upfront    months: at most this many months of rent asked for up front,
 *              "12" is the drawer's "One year upfront at most" (V-65)
 *
 * The two utility parameters use opposite set logic on purpose, and the URL
 * says so by naming one after a requirement and one after a source. Backup
 * power and a Band A feeder are independent facts a place can have both of, so
 * asking for both means both. Water comes from one place, so asking for a
 * borehole and treated mains means either would do; as an AND it would match
 * nothing, every time, which is not a filter but a trap.
 *
 * Money: the URL is the human boundary, so it carries naira, and this module is
 * the only place that multiplies. Everything downstream, including every field
 * of `ListingSearchFilter`, is integer kobo.
 *
 * Parsing is defensive by construction. Every reader below either returns a
 * clean value or `undefined`; nothing throws, nothing propagates NaN, and an
 * address full of rubbish renders the unfiltered page rather than an error.
 */

export type SortKey =
  | "recommended"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "move-in-asc"
  /* V-12: the agency, legal and agreement fees together, as a share of a
     year's rent (`fee-share.ts`). Unstated fees sort last. */
  | "fees-asc";

/**
 * THE FOUR SORTS ALL READ THE HEADLINE PRICE, AND THAT IS THE DEFECT.
 *
 * A renter with six million naira was being shown four
 * and a half million naira flats that need seven million to move into, because
 * every ordering this shelf offered read `priceMinor`. `move-in-asc` reads the
 * total move in cost instead, which is the number a Nigerian tenant actually
 * shops on, and `listings_move_in_cost_idx` has existed in the database since
 * August with nothing querying it.
 *
 * `basis` is why this is a list of objects rather than a list of labels. A
 * silent switch between two money columns is worse than either column alone,
 * so every sort states in the interface which number it ordered on, and the
 * shelf prints that sentence under the count. Nothing may be added here
 * without answering that question.
 */
export type SortBasis = "price" | "move-in" | "rating" | "listed" | "mixed" | "fees";

/* `short` is what the closed sort control prints when the full label would
   push the result count off a 390px row (seen on the V-12 visual pass). */
export const SORTS: { key: SortKey; label: string; basis: SortBasis; short?: string }[] = [
  { key: "recommended", label: "Recommended", basis: "mixed" },
  /* V-22. The date each listing went live, which nobody can buy a fresh copy
     of on Vallo because there is no push-up to buy (V-06). */
  { key: "newest", label: "Newest", basis: "listed" },
  { key: "price-asc", label: "Price: low to high", basis: "price" },
  { key: "price-desc", label: "Price: high to low", basis: "price" },
  { key: "move-in-asc", label: "Move-in cost: low to high", basis: "move-in" },
  { key: "fees-asc", label: "Lowest fees on top of rent", basis: "fees", short: "Lowest fees" },
];

/** The basis a sort key orders on, defaulting to the shelf's opening order. */
export function sortBasisOf(sort: SortKey): SortBasis {
  return SORTS.find((entry) => entry.key === sort)?.basis ?? "mixed";
}

/**
 * How the shelf draws its results (Track M): `list` is the card grid it has
 * always drawn and stays the default, so every address already out in the
 * world means what it meant; `rows` is one wide card a row, for reading the
 * figures side by side; `map` is the map.
 */
export type ViewKey = "list" | "rows" | "map";

function readView(value: string | undefined): ViewKey {
  return value === "map" || value === "rows" ? value : "list";
}

/**
 * Singular and plural nouns per category, IN ENGLISH, for two readers only:
 * the URL parser below, which takes its set of kinds from these keys, and the
 * syndication title (`public-title.ts`), which is English with the rest of
 * the link preview it sits in (`syndication.ts`). A member surface counts in
 * the reader's language from `t.experienceLabels.kinds` (typed `KindNouns`);
 * `category.test.ts` pins the two Englishes together.
 */
export const KIND_NOUN: Record<ListingKind, { one: string; many: string }> = {
  hotel: { one: "hotel", many: "hotels" },
  apartment: { one: "apartment", many: "apartments" },
  home: { one: "home", many: "homes" },
  shortlet: { one: "shortlet", many: "shortlets" },
  villa: { one: "villa", many: "villas" },
  restaurant: { one: "restaurant", many: "restaurants" },
  experience: { one: "experience", many: "experiences" },
  rental: { one: "rental", many: "rentals" },
  shop: { one: "shop", many: "shops" },
  office: { one: "office", many: "offices" },
  land: { one: "plot", many: "plots" },
};

/**
 * The order the markets are offered in.
 *
 * This used to be a private array inside `CategoryTiles`, which was the rail
 * above the results. The rail is gone and the category is a control in the
 * filter drawer now, so the order lives here beside the nouns rather than
 * inside one component that could be deleted out from under it. Lodging first,
 * because that is what most arrivals are looking for, then the long-let and
 * commercial markets, then land.
 */
export const KIND_ORDER: ListingKind[] = [
  "hotel",
  "apartment",
  "home",
  "shortlet",
  "villa",
  "rental",
  "shop",
  "office",
  "land",
  "restaurant",
  "experience",
];

/** The kinds' nouns in the reader's language (`t.experienceLabels.kinds`). */
export type KindNouns = Record<ListingKind, { one: string; many: string }>;

/** A category as a person reads it: "Hotels", "Plots", from the reader's own nouns. */
export function kindLabel(kind: ListingKind, nouns: KindNouns): string {
  const many = nouns[kind].many;
  return many.charAt(0).toUpperCase() + many.slice(1);
}

/** Everything a discovery request is, parsed and clean. */
export type DiscoveryQuery = {
  q?: string;
  kind?: ListingKind;
  sort: SortKey;
  view: ViewKey;
  /** Budget bounds in integer kobo. */
  minMinor?: number;
  maxMinor?: number;
  bedrooms?: number;
  bathrooms?: number;
  guests?: number;
  amenities: string[];
  instantBook: boolean;
  verifiedOnly: boolean;
  /** The host has a generator, inverter or solar. Unanswered is not a yes. */
  powerBackup: boolean;
  /** The address sits on a Band A feeder. */
  powerBandA: boolean;
  /** Water sources, any of which will do. Empty means the reader did not ask. */
  waterSupply: WaterSupply[];
  /**
   * Who is offering it, any of which will do. Empty means the reader did not
   * ask. The values are the URL's own words as well as the database's, because
   * `owner`, `agent` and `firm` are already short, lowercase and readable in
   * an address bar, so unlike water they need no second spelling.
   */
  listerRoles: ListingRole[];
  /** V-28. Strict: an unanswered listing never satisfies either. */
  landlordAway: boolean;
  parkingInside: boolean;
  /** V-68. Strict: an unanswered listing never satisfies either. */
  servicedOnly: boolean;
  gatedEstate: boolean;
  /** V-65: at most this many months of rent up front. Absent means not asked. */
  maxUpfront?: number;
  /** V-66: unit shapes, any of which will do. Absent or empty: not asked. */
  shapes?: UnitShape[];
  /** V-66: a boys' quarters comes with it. Strict. */
  withBq?: boolean;
  /** V-66: areas, any of which will do. Absent or empty: not asked. */
  areas?: string[];
  /** V-41: only homes with no flooding reported (positive evidence only). */
  noFlood?: boolean;
  /** V-43: the landmark the reader goes to every day, by slug. */
  to?: string;
  /** V-43: at most this many minutes at the morning rush to `to`. */
  within?: number;
};

/**
 * The water sources, as a URL says them.
 *
 * Short, lowercase and readable in an address bar, because a shared search is
 * a link somebody looks at. `TREATED_MAINS` in a query string is shouting.
 */
const WATER_SLUG: Record<WaterSupply, string> = {
  TREATED_MAINS: "mains",
  BOREHOLE: "borehole",
  PUMPED_STORAGE: "storage",
  TANKER: "tanker",
  NONE: "none",
};

const WATER_BY_SLUG = new Map<string, WaterSupply>(
  WATER_SOURCES.map((value) => [WATER_SLUG[value], value]),
);

/** The URL spelling of a water source, for a link this module did not build. */
export function waterSlug(value: WaterSupply): string {
  return WATER_SLUG[value];
}

/** SW11: source of truth is now `packages/i18n/src/locales/listings-labels.en.ts`. */
export const WATER_LABEL: Record<WaterSupply, string> = waterLabelEn as Record<WaterSupply, string>;

/** The raw shape Next hands a page, before anything has been trusted. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export const KOBO_PER_NAIRA = 100;

/** Naira at the boundary, kobo everywhere else. */
export function nairaToKobo(naira: number): number {
  return Math.round(naira) * KOBO_PER_NAIRA;
}

/** Kobo back to whole naira, for the one input that speaks naira. */
export function koboToNaira(kobo: number): number {
  return Math.round(kobo / KOBO_PER_NAIRA);
}

/** Ceilings that keep an address hostile-input safe rather than merely tidy. */
const MAX_TEXT = 120;
const MAX_ROOMS = 20;
const MAX_GUESTS = 30;
/** Five years is past any tenancy demand this market has seen; above it is noise. */
const MAX_UPFRONT_MONTHS = 60;
const MAX_NAIRA = 999_999_999;
const MAX_AMENITIES = 20;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function readText(value: string | string[] | undefined): string | undefined {
  const raw = first(value);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().slice(0, MAX_TEXT);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * A whole number in range, or nothing at all.
 *
 * Digits only: "1e3", "-4", "2.5", "abc" and an empty string are all rubbish
 * and are dropped rather than coerced into something surprising.
 */
function readInt(
  value: string | string[] | undefined,
  min: number,
  max: number,
): number | undefined {
  const raw = first(value);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!/^\d{1,10}$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

function readFlag(value: string | string[] | undefined): boolean {
  const raw = first(value);
  return raw === "1" || raw === "true";
}

/** Amenity codes are lowercase slugs. Anything else is not a code. */
function readAmenities(value: string | string[] | undefined): string[] {
  const raw = first(value);
  if (typeof raw !== "string") return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const code = part.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,23}$/.test(code)) continue;
    if (out.includes(code)) continue;
    out.push(code);
    if (out.length >= MAX_AMENITIES) break;
  }
  return out;
}

/**
 * The power requirements named in an address, as a pair of flags.
 *
 * Unknown words are dropped rather than refused, on the same principle as
 * everything else here: an address full of rubbish renders the unfiltered page.
 */
function readPower(value: string | string[] | undefined): {
  backup: boolean;
  bandA: boolean;
} {
  const raw = first(value);
  if (typeof raw !== "string") return { backup: false, bandA: false };
  const parts = raw.split(",").map((p) => p.trim().toLowerCase());
  return { backup: parts.includes("backup"), bandA: parts.includes("band-a") };
}

/** Water sources named in an address. Duplicates and rubbish are dropped. */
function readWater(value: string | string[] | undefined): WaterSupply[] {
  const raw = first(value);
  if (typeof raw !== "string") return [];
  const out: WaterSupply[] = [];
  for (const part of raw.split(",")) {
    const found = WATER_BY_SLUG.get(part.trim().toLowerCase());
    if (found && !out.includes(found)) out.push(found);
  }
  return out;
}

/**
 * Supply kinds named in an address. Duplicates and rubbish are dropped.
 *
 * ORDERED BY `LISTING_ROLES`, NOT BY THE ADDRESS BAR. Two links that asked the
 * same question have to produce the same URL when the drawer writes them back,
 * or the browser history fills with entries that differ only in the order
 * somebody happened to tick three boxes in.
 */
function readRoles(value: string | string[] | undefined): ListingRole[] {
  const raw = first(value);
  if (typeof raw !== "string") return [];
  const asked = new Set(raw.split(",").map((part) => part.trim().toLowerCase()));
  return LISTING_ROLES.filter((role) => asked.has(role));
}

/** V-66: shapes as the address bar spells them, unknown words dropped, in the list's order. */
function readShapes(value: string | string[] | undefined): UnitShape[] {
  const raw = first(value);
  if (typeof raw !== "string") return [];
  const asked = new Set(raw.split(",").map((part) => shapeFromSlug(part)).filter((s): s is UnitShape => s !== null));
  return UNIT_SHAPES.filter((shape) => asked.has(shape));
}

/** V-66: at most four areas, each a short run of letters, digits and spaces. */
function readAreas(value: string | string[] | undefined): string[] {
  const raw = first(value);
  if (typeof raw !== "string") return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const clean = part.toLowerCase().replace(/[^a-z0-9 '-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    if (clean && !out.includes(clean)) out.push(clean);
    if (out.length === 4) break;
  }
  return out;
}

/** Category, accepting the two legacy aliases older links still carry. */
export function parseKind(type: string | undefined): ListingKind | undefined {
  if (!type) return undefined;
  const normalised = type === "property" ? "apartment" : type === "rent" ? "rental" : type;
  return normalised in KIND_NOUN ? (normalised as ListingKind) : undefined;
}

/** Read the address bar into a clean request. Never throws, never NaN. */
export function parseDiscoveryQuery(params: RawSearchParams): DiscoveryQuery {
  const sortRaw = readText(params.sort);
  const sort: SortKey = SORTS.some((s) => s.key === sortRaw)
    ? (sortRaw as SortKey)
    : "recommended";

  let minNaira = readInt(params.min, 0, MAX_NAIRA);
  let maxNaira = readInt(params.max, 0, MAX_NAIRA);
  // A range typed backwards is a slip, not an empty result set.
  if (minNaira !== undefined && maxNaira !== undefined && minNaira > maxNaira) {
    [minNaira, maxNaira] = [maxNaira, minNaira];
  }

  const power = readPower(params.power);

  const query: DiscoveryQuery = {
    sort,
    view: readView(readText(params.view)),
    amenities: readAmenities(params.amenities),
    instantBook: readFlag(params.instant),
    verifiedOnly: readFlag(params.verified),
    powerBackup: power.backup,
    powerBandA: power.bandA,
    waterSupply: readWater(params.water),
    listerRoles: readRoles(params.by),
    landlordAway: readText(params.landlord) === "away",
    parkingInside: readText(params.parking) === "inside",
    servicedOnly: readFlag(params.serviced),
    gatedEstate: readText(params.estate) === "gated",
  };

  const q = readText(params.q);
  if (q !== undefined) query.q = q;
  const kind = parseKind(readText(params.type));
  if (kind !== undefined) query.kind = kind;
  if (minNaira !== undefined) query.minMinor = nairaToKobo(minNaira);
  if (maxNaira !== undefined) query.maxMinor = nairaToKobo(maxNaira);

  const bedrooms = readInt(params.beds, 1, MAX_ROOMS);
  if (bedrooms !== undefined) query.bedrooms = bedrooms;
  const bathrooms = readInt(params.baths, 1, MAX_ROOMS);
  if (bathrooms !== undefined) query.bathrooms = bathrooms;
  const guests = readInt(params.guests, 1, MAX_GUESTS);
  if (guests !== undefined) query.guests = guests;
  const upfront = readInt(params.upfront, 1, MAX_UPFRONT_MONTHS);
  if (upfront !== undefined) query.maxUpfront = upfront;
  const shapes = readShapes(params.shape);
  if (shapes.length > 0) query.shapes = shapes;
  if (readFlag(params.bq)) query.withBq = true;
  const areas = readAreas(params.area);
  if (areas.length > 0) query.areas = areas;
  if (readFlag(params.noflood)) query.noFlood = true;
  const to = readText(params.to);
  if (to && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(to) && to.length <= 140) query.to = to;
  const within = readInt(params.within, 10, 240);
  if (within !== undefined && query.to) query.within = within;

  return query;
}

/** The repository question this request asks. Sort and view are ours, not its. */
export function toFilter(query: DiscoveryQuery): ListingSearchFilter {
  const filter: ListingSearchFilter = {};
  if (query.q) filter.q = query.q;
  if (query.kind) filter.kind = query.kind;
  if (query.minMinor !== undefined) filter.minPriceMinor = query.minMinor;
  if (query.maxMinor !== undefined) filter.maxPriceMinor = query.maxMinor;
  if (query.bedrooms !== undefined) filter.bedrooms = query.bedrooms;
  if (query.bathrooms !== undefined) filter.bathrooms = query.bathrooms;
  if (query.guests !== undefined) filter.guests = query.guests;
  if (query.amenities.length > 0) filter.amenities = query.amenities;
  if (query.instantBook) filter.instantBook = true;
  if (query.verifiedOnly) filter.verifiedOnly = true;
  if (query.powerBackup) filter.powerBackup = true;
  if (query.powerBandA) filter.powerBandA = true;
  if (query.waterSupply.length > 0) filter.waterSupply = query.waterSupply;
  if (query.listerRoles.length > 0) filter.listerRoles = query.listerRoles;
  if (query.landlordAway) filter.landlordAway = true;
  if (query.parkingInside) filter.parkingInside = true;
  if (query.servicedOnly) filter.servicedOnly = true;
  if (query.gatedEstate) filter.gatedEstate = true;
  if (query.maxUpfront !== undefined) filter.maxUpfrontMonths = query.maxUpfront;
  if (query.shapes && query.shapes.length > 0) filter.shapes = query.shapes;
  if (query.withBq) filter.withBq = true;
  if (query.areas && query.areas.length > 0) filter.areas = query.areas;
  if (query.noFlood) filter.noFlood = true;
  return filter;
}

/**
 * The pool a filter drawer counts against: the same text, none of the
 * structured bounds and NO CATEGORY. It is what "how many places match" is
 * measured out of.
 *
 * THE CATEGORY LEFT THIS FUNCTION WHEN THE CATEGORY RAIL LEFT THE SEARCH BAR.
 *
 * The rail above the results was the only category control on the screen, so
 * the pool could safely be narrowed to whatever category the address bar
 * already carried: nothing inside the drawer could ask about another one. The
 * category is a control inside the drawer now, and a pool pre-narrowed to
 * "hotel" answers "how many shortlets" with zero, every time, for every
 * shortlet in the catalogue. The button would have reported an empty result
 * set and then applied a filter that returned twenty places.
 *
 * So the pool spans every category and `matchesFacts` judges the category like
 * any other bound. The pool is bounded by the repository's own catalogue limit
 * either way, and an uncategorised search already shipped exactly this set.
 */
export function toPoolFilter(query: DiscoveryQuery): ListingSearchFilter {
  const filter: ListingSearchFilter = {};
  if (query.q) filter.q = query.q;
  /* V-66: areas are where, like the text, so the drawer counts inside them. */
  if (query.areas && query.areas.length > 0) filter.areas = query.areas;
  return filter;
}

/** Write a request back to the address bar. Defaults are left out. */
export function toSearchHref(query: DiscoveryQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.kind) params.set("type", query.kind);
  if (query.sort !== "recommended") params.set("sort", query.sort);
  if (query.view !== "list") params.set("view", query.view);
  if (query.minMinor !== undefined) params.set("min", String(koboToNaira(query.minMinor)));
  if (query.maxMinor !== undefined) params.set("max", String(koboToNaira(query.maxMinor)));
  if (query.bedrooms !== undefined) params.set("beds", String(query.bedrooms));
  if (query.bathrooms !== undefined) params.set("baths", String(query.bathrooms));
  if (query.guests !== undefined) params.set("guests", String(query.guests));
  if (query.amenities.length > 0) params.set("amenities", query.amenities.join(","));
  if (query.instantBook) params.set("instant", "1");
  if (query.verifiedOnly) params.set("verified", "1");
  const power: string[] = [];
  if (query.powerBackup) power.push("backup");
  if (query.powerBandA) power.push("band-a");
  if (power.length > 0) params.set("power", power.join(","));
  if (query.waterSupply.length > 0) {
    params.set("water", query.waterSupply.map(waterSlug).join(","));
  }
  if (query.listerRoles.length > 0) params.set("by", query.listerRoles.join(","));
  if (query.landlordAway) params.set("landlord", "away");
  if (query.parkingInside) params.set("parking", "inside");
  if (query.servicedOnly) params.set("serviced", "1");
  if (query.gatedEstate) params.set("estate", "gated");
  if (query.maxUpfront !== undefined) params.set("upfront", String(query.maxUpfront));
  if (query.shapes && query.shapes.length > 0) params.set("shape", query.shapes.map(shapeSlug).join(","));
  if (query.withBq) params.set("bq", "1");
  if (query.areas && query.areas.length > 0) params.set("area", query.areas.join(","));
  if (query.noFlood) params.set("noflood", "1");
  if (query.to) params.set("to", query.to);
  if (query.to && query.within !== undefined) params.set("within", String(query.within));
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/**
 * The same address with the view stated OUT LOUD, even when it is the default.
 *
 * `toSearchHref` leaves defaults out, which is right for a shareable link, and
 * `view=list` is the default. That became a problem the moment the last chosen
 * view started being remembered in a cookie: choosing List produced a URL with
 * no `view` in it, the server saw no `view`, consulted the cookie, found the
 * map the person had just switched away from, and served the map back. The one
 * control whose whole job is to state the view has to state it.
 */
export function toViewHref(query: DiscoveryQuery, view: ViewKey): string {
  const href = toSearchHref({ ...query, view });
  if (view !== "list") return href;
  return href.includes("?") ? `${href}&view=list` : `${href}?view=list`;
}

/** Everything the drawer owns, cleared. Text, category, sort and view stay. */
export function clearedFilters(query: DiscoveryQuery): DiscoveryQuery {
  const cleared: DiscoveryQuery = {
    sort: query.sort,
    view: query.view,
    amenities: [],
    instantBook: false,
    verifiedOnly: false,
    powerBackup: false,
    powerBandA: false,
    waterSupply: [],
    listerRoles: [],
    landlordAway: false,
    parkingInside: false,
    servicedOnly: false,
    gatedEstate: false,
  };
  if (query.q) cleared.q = query.q;
  if (query.kind) cleared.kind = query.kind;
  /* Areas are where, like the text, and the drawer does not own them. */
  if (query.areas) cleared.areas = query.areas;
  return cleared;
}

/**
 * How many filters are switched on, for the badge on the opener.
 *
 * A price range counts once however many ends it has, because a traveller set
 * one thing: a budget.
 */
export function activeFilterCount(query: DiscoveryQuery): number {
  let count = 0;
  if (query.minMinor !== undefined || query.maxMinor !== undefined) count += 1;
  if (query.bedrooms !== undefined) count += 1;
  if (query.bathrooms !== undefined) count += 1;
  if (query.guests !== undefined) count += 1;
  count += query.amenities.length;
  if (query.instantBook) count += 1;
  if (query.verifiedOnly) count += 1;
  if (query.powerBackup) count += 1;
  if (query.powerBandA) count += 1;
  // Water counts once however many sources are ticked, for the same reason a
  // price range does: the reader set one thing, where the water comes from.
  if (query.waterSupply.length > 0) count += 1;
  // One thing again: the reader set who they want to deal with, however many
  // kinds they ticked.
  if (query.listerRoles.length > 0) count += 1;
  if (query.landlordAway) count += 1;
  if (query.parkingInside) count += 1;
  if (query.servicedOnly) count += 1;
  if (query.gatedEstate) count += 1;
  if (query.maxUpfront !== undefined) count += 1;
  // One thing each: the shapes the reader will take.
  if (query.shapes && query.shapes.length > 0) count += 1;
  if (query.withBq) count += 1;
  /* Areas are not counted: like the search text they are where, Clear all
     keeps them, and a badge must not say 1 after everything was cleared. */
  if (query.within !== undefined) count += 1;
  if (query.noFlood) count += 1;
  return count;
}
