import { parseWords } from "@/lib/listings/query-parse";
import { koboToNaira } from "@/lib/listings/search-params";
import { lagosToday, nightsBetween } from "@/lib/stays/query";
import type { IntelligenceKind, Understood } from "./contract";
import { closestWord } from "./fuzzy";
import { findPlace, placeLabel, placeFromLabel, type Place } from "./places";
import { cleanQuery, foldKey, tokens } from "./text";
import {
  AMENITY_WORDS,
  INTENT_WORDS,
  KIND_WORDS,
  KNOWN_WORDS,
  PERSONAL_WORDS,
  SPELLING,
  STOP_WORDS,
  spellingVocabulary,
  type KindWord,
  type PersonalTarget,
} from "./vocabulary";

/**
 * VALLO INTELLIGENCE: WORDS INTO FILTERS, BY RULES.
 *
 * `understand(raw)` reads what a person typed into the `Understood` the
 * contract defines: a kind, rent or buy or stay, a place from the closed list,
 * bedrooms, a budget, furnished, amenities, dates and guests on the Lagos
 * calendar, "new this week", and whatever words are left as text. It reuses
 * the marketplace's own WhatsApp-shorthand reader (`parseWords`, V-66) for
 * rooms, money and the market, so "2br under 2m yaba" means here what it means
 * on /search.
 *
 * TWO RULES IT KEEPS:
 *
 *   A MISSPELLING IS OFFERED, NEVER APPLIED. "resturants in VI" is read as it
 *   was typed (VI is an alias, so it is Victoria Island), and the corrected
 *   line, "restaurants in Victoria Island", is put in `didYouMean`. The engine
 *   decides whether to show results for the correction, and says so when it
 *   does.
 *
 *   NOTHING IS GUESSED. A place not on the list stays as words; a bare number
 *   with no unit or naira sign stays as words (it could be a house number); a
 *   word that is not a known amenity is not turned into one.
 *
 * Pure: no network, no clock unless one is passed (`now`).
 */

export type UnderstandOptions = {
  now?: Date;
  /** Staff-managed synonyms (`public.search_aliases`), already validated. */
  aliases?: { words?: Readonly<Record<string, string>>; places?: Readonly<Record<string, string>> };
};

export type ReadingHints = {
  /** "cheap", "affordable": order by price, never a made-up ceiling. */
  cheap: boolean;
  /** "new", "latest": order newest first. */
  newest: boolean;
  /** The member's own records asked for ("my saved", "my offers"). */
  personal: PersonalTarget[];
  /** A how-to or help question. */
  question: boolean;
  /** A screen or setting asked for ("change my email"). */
  screen: boolean;
  /** The resolved place, when one was named. */
  place: Place | null;
  /** How many words were typed, and the share the rules read. */
  wordCount: number;
  readShare: number;
};

export type Reading = { understood: Understood; hints: ReadingHints };

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const KIND_PRIORITY: IntelligenceKind[] = ["roommate", "restaurant", "stay", "person", "community", "post", "property"];

/* The shape words `parseWords` takes out, put back as text, since a shape is
   matched against titles here rather than as a strict filter. "flat" is a
   generic home word and is not put back. */
const SHAPE_TEXT: Record<string, string> = {
  self_contain: "self contain",
  room_parlour: "room and parlour",
  mini_flat: "mini flat",
  duplex: "duplex",
  terrace: "terrace",
  semi_detached: "semi detached",
  detached: "detached",
  bungalow: "bungalow",
  maisonette: "maisonette",
  penthouse: "penthouse",
  boys_quarters: "boys quarters",
};

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-day arithmetic on ISO dates, in UTC so no clock change can bite. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Friday-to-Sunday a person means by "this weekend", on the Lagos calendar. */
export function thisWeekend(today: string): { checkIn: string; checkOut: string } {
  const day = weekday(today);
  if (day === 5) return { checkIn: today, checkOut: addDays(today, 2) };
  if (day === 6 || day === 0) return { checkIn: today, checkOut: addDays(today, 1) };
  const friday = addDays(today, 5 - day);
  return { checkIn: friday, checkOut: addDays(friday, 2) };
}

let VOCAB: string[] | null = null;
function vocabulary(): string[] {
  if (!VOCAB) VOCAB = spellingVocabulary();
  return VOCAB;
}

/**
 * The words with each misspelling replaced, or null when nothing was fixed.
 * Only the spelling list and near misses of known words are offered.
 */
export function spellingFix(folded: string): string | null {
  let changed = false;
  const out = folded.split(" ").map((word) => {
    const bare = word.replace(/[^a-z]/g, "");
    if (!bare || bare !== word.replace(/[^a-z0-9]/g, "") || KNOWN_WORDS.has(bare) || STOP_WORDS.has(bare)) return word;
    const fix = SPELLING[bare] ?? closestWord(bare, vocabulary());
    if (!fix || fix === bare) return word;
    changed = true;
    return word.replace(bare, fix);
  });
  return changed ? out.join(" ") : null;
}

/** The line to offer: the fixed words, with an aliased place written out. */
function offeredLine(fixed: string, extraPlaces: Readonly<Record<string, string>>): string {
  const hit = findPlace(fixed, extraPlaces);
  if (!hit) return fixed;
  return `${fixed.slice(0, hit.start)}${hit.place.name}${fixed.slice(hit.end)}`.replace(/\s+/g, " ").trim();
}

function strip(u: Understood): Understood {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(u)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (v === "") continue;
    out[k] = v;
  }
  return out as unknown as Understood;
}

export function understand(raw: string, options: UnderstandOptions = {}): Reading {
  const typed = cleanQuery(raw);
  const today = lagosToday(options.now ?? new Date());
  const extraPlaces = options.aliases?.places ?? {};
  let t = ` ${foldKey(typed)} `;

  /* Staff synonyms first ("buka" -> "restaurant"): visible through what is
     understood, like any alias. */
  for (const [from, to] of Object.entries(options.aliases?.words ?? {})) {
    t = t.replace(new RegExp(`(?<=[^a-z0-9])${escapeRe(from)}(?=[^a-z0-9])`, "g"), ` ${to} `);
  }
  t = t.replace(/\s+/g, " ");
  const folded = t.trim();
  const wordCount = tokens(typed).length;

  const u: Understood = { raw: typed, via: "rules" };
  const hints: ReadingHints = {
    cheap: false,
    newest: false,
    personal: [],
    question: false,
    screen: false,
    place: null,
    wordCount,
    readShare: 0,
  };

  const fixed = spellingFix(folded);
  if (fixed) u.didYouMean = offeredLine(fixed, extraPlaces);

  const take = (re: RegExp, on?: (m: RegExpExecArray) => void): boolean => {
    let hit = false;
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    t = t.replace(global, (...args) => {
      hit = true;
      const groups = args.slice(0, -2) as string[];
      on?.(Object.assign([...groups], { index: 0, input: "" }) as unknown as RegExpExecArray);
      return " ";
    });
    return hit;
  };

  /* 1. The member's own records: "my saved", "show my previous offers". */
  if (/\b(?:my|mine)\b|\bi\s+(?:saved|made|sent|booked|liked)\b/.test(t)) {
    for (const [re, target] of PERSONAL_WORDS) {
      if (new RegExp(re.source).test(t)) {
        if (!hints.personal.includes(target)) hints.personal.push(target);
        take(re);
      }
    }
    if (hints.personal.length > 0) take(/\b(?:my|mine|previous|past|recent|old|all|i\s+(?:saved|made|sent|booked|liked))\b/g);
  }

  /* 2. A question or a how-to. "make an offer" is how the offer flow is asked for. */
  if (take(/^\s*(?:how\s+(?:do|can|to|does|much|long)\s*(?:i|we|you)?|what\s+(?:is|are|does)|why\s+(?:is|do|does)|can\s+i|where\s+(?:do|can|is|are)\s*(?:i|my)?)\b/)) {
    hints.question = true;
  }
  if (take(/\bhow\s+to\b/) || take(/\b(?:help|guide|faq|explain)\b/)) hints.question = true;
  if (/\bmake\s+(?:an?\s+)?offers?\b/.test(t)) hints.question = true;

  /* 3. A screen or a setting. */
  if (/^\s*(?:change|update|edit|reset|delete|turn\s+(?:on|off)|switch|go\s+to|manage|set\s+up|log\s*out|sign\s*out|verify)\b/.test(t)
    || /\b(?:settings?|password|notifications?|wallet|receipts?|refunds?|payouts?)\b/.test(t)) {
    hints.screen = true;
  }

  /* 4. The place. */
  const hit = findPlace(t.trim(), extraPlaces);
  if (hit) {
    const at = t.indexOf(hit.written, Math.max(0, hit.start));
    if (at >= 0) t = `${t.slice(0, at)} ${t.slice(at + hit.written.length)}`;
    hints.place = hit.place;
    u.place = placeLabel(hit.place);
  }

  /* 5. Dates and nights, on the Lagos calendar. */
  if (take(/\bnext\s+weekend\b/)) {
    /* The Friday of this weekend, then a week on. */
    const day = weekday(today);
    const friday = day === 5 ? today : day === 6 ? addDays(today, -1) : day === 0 ? addDays(today, -2) : addDays(today, 5 - day);
    u.checkIn = addDays(friday, 7);
    u.checkOut = addDays(friday, 9);
  } else if (take(/\b(?:this\s+)?weekend\b/)) {
    const w = thisWeekend(today);
    u.checkIn = w.checkIn;
    u.checkOut = w.checkOut;
  } else if (take(/\b(?:tonight|today)\b/)) {
    u.checkIn = today;
    u.checkOut = addDays(today, 1);
  } else if (take(/\b(?:tomorrow|tmrw|tmr)(?:\s+night)?\b/)) {
    u.checkIn = addDays(today, 1);
    u.checkOut = addDays(today, 2);
  }
  take(/\b(?:for\s+)?(\d{1,2}|one|two|three|four|five|six|seven)\s+nights?\b/, (m) => {
    const n = NUMBER_WORDS[m[1]!] ?? Number(m[1]);
    if (u.checkIn && n >= 1 && n <= 30) u.checkOut = addDays(u.checkIn, n);
  });
  if (u.checkIn && u.checkOut && nightsBetween(u.checkIn, u.checkOut) < 1) {
    delete u.checkIn;
    delete u.checkOut;
  }

  /* 6. Guests. A number alone is never a party size. */
  take(/\b(?:for\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:guests?|people|persons?|adults?|pax)\b/, (m) => {
    const n = NUMBER_WORDS[m[1]!] ?? Number(m[1]);
    if (n >= 1 && n <= 30) u.guests = n;
  });
  take(/\bfamily\s+of\s+(\d{1,2}|two|three|four|five|six|seven|eight)\b/, (m) => {
    const n = NUMBER_WORDS[m[1]!] ?? Number(m[1]);
    if (n >= 1 && n <= 30) u.guests = n;
  });
  if (take(/\b(?:for\s+)?(?:a\s+)?couple\b/)) u.guests ??= 2;

  /* 7. New this week. */
  take(/\b(?:new|newly\s+listed|just\s+listed|added|listed|latest|fresh)?\s*(?:this|in\s+the\s+last|past)\s+(week|month)\b/, (m) => {
    u.addedSince = addDays(today, m[1] === "month" ? -30 : -7);
  });
  if (take(/\b(?:newly\s+listed|just\s+listed|new\s+listings?|latest|newest|new)\b/)) hints.newest = true;

  /* 8. Furnished. */
  if (take(/\bun-?furnished\b/)) u.furnished = false;
  else if (take(/\b(?:fully|semi)?[\s-]*furnished\b/)) u.furnished = true;

  /* 9. Amenities the schema holds. */
  const amenities: string[] = [];
  for (const [re, code] of AMENITY_WORDS) {
    take(re, () => {
      if (!amenities.includes(code)) amenities.push(code);
    });
  }
  if (amenities.length > 0) u.amenities = amenities;

  /* 10. Cheap: an order, not a number. */
  if (take(/\b(?:cheap(?:est)?|affordable|budget|low[\s-]+cost|inexpensive)\b/)) hints.cheap = true;

  /* 11. The words that point at a kind, longest phrase first. */
  const found: KindWord[] = [];
  const phrases = Object.keys(KIND_WORDS).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    take(new RegExp(`\\b${escapeRe(phrase)}\\b`), () => found.push(KIND_WORDS[phrase]!));
  }
  let chosen: KindWord | undefined;
  for (const kind of KIND_PRIORITY) {
    const of = found.filter((f) => f.kind === kind);
    if (of.length === 0) continue;
    const listingKinds = [...new Set(of.flatMap((f) => f.listingKinds ?? []))];
    chosen = { kind, intent: of.find((f) => f.intent)?.intent, listingKinds: listingKinds.length > 0 ? listingKinds : undefined };
    break;
  }

  /* 12. To let, for sale, to buy. */
  for (const [re, intent] of INTENT_WORDS) {
    if (take(re)) u.intent ??= intent;
  }

  /* 13. Rooms and money, through the marketplace's own reader. */
  const words = parseWords(t);
  if (words.bedrooms !== undefined) u.bedrooms = words.bedrooms;
  if (words.maxMinor !== undefined) u.maxPrice = koboToNaira(words.maxMinor);
  if (words.minMinor !== undefined) u.minPrice = koboToNaira(words.minMinor);
  if (words.intent === "sale") u.intent ??= "buy";
  if (words.intent === "rent") u.intent ??= "rent";
  const shapeText = words.shapes.map((s) => SHAPE_TEXT[s]).filter((s): s is string => Boolean(s));
  if (words.serviced) shapeText.push("serviced");
  /* A home's shape ("duplex", "self contain") is a home, whatever else was said. */
  if (!chosen && words.shapes.length > 0) chosen = { kind: "property" };

  /* What is left, as text. */
  const rest = [...words.rest.split(/\s+/), ...shapeText.flatMap((s) => s.split(" "))]
    .map((w) => w.replace(/^[^a-z0-9₦]+|[^a-z0-9₦]+$/g, ""))
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w) && !/^(?:bedrooms?|beds?|br|rooms?)$/.test(w));
  const text = [...new Set(rest)].join(" ").trim();
  if (text) u.text = text;

  /* The kind, in order of what the words most clearly asked for. */
  let kind: IntelligenceKind | undefined;
  if (hints.personal.length > 0) kind = "personal";
  else if (chosen && !(hints.question && chosen.kind === "property" && !u.place && u.bedrooms === undefined)) kind = chosen.kind;
  else if (hints.question) kind = "guide";
  else if (hints.screen) kind = "screen";
  else if (u.checkIn || u.guests) kind = "stay";
  else if (u.bedrooms !== undefined || u.maxPrice !== undefined || u.minPrice !== undefined || u.intent === "rent" || u.intent === "buy") kind = "property";
  else if (u.place && !text && !u.amenities && !u.addedSince && u.furnished === undefined) kind = "place";
  if (kind) u.kind = kind;
  if (chosen?.listingKinds && kind === chosen.kind) u.listingKinds = chosen.listingKinds;
  if (chosen?.intent && kind === chosen.kind) u.intent ??= chosen.intent;
  if ((u.checkIn || u.guests) && (kind === "stay" || kind === undefined)) u.intent ??= "stay";
  if (kind === "property" && u.intent === "stay") delete u.intent;

  const leftover = text ? text.split(" ").length : 0;
  hints.readShare = wordCount === 0 ? 0 : Math.max(0, Math.min(1, (wordCount - leftover) / wordCount));
  return { understood: strip(u), hints };
}

/* ------------------------------------------------------------------ reverse */

const KIND_WORD_OUT: Partial<Record<IntelligenceKind, string>> = {
  property: "homes",
  stay: "stays",
  restaurant: "restaurants",
  roommate: "roommates",
  person: "people",
  community: "communities",
  post: "posts",
};

function nairaWords(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(2))}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/**
 * Words that `understand` reads back into (nearly) the same filters: how an
 * alternative ("without the budget", "in all of Lagos") is offered as a query
 * the person can run, and verified before it is offered.
 */
export function queryFromUnderstood(u: Understood): string {
  const parts: string[] = [];
  if (u.furnished === true) parts.push("furnished");
  if (u.bedrooms !== undefined) parts.push(`${u.bedrooms} bedroom`);
  const lk = u.listingKinds?.[0];
  if (lk === "hotel") parts.push("hotels");
  else if (lk === "shortlet") parts.push("shortlets");
  else if (lk === "land") parts.push("land");
  else if (lk === "shop") parts.push("shops");
  else if (lk === "office") parts.push("offices");
  else if (u.kind && KIND_WORD_OUT[u.kind]) parts.push(KIND_WORD_OUT[u.kind]!);
  if (u.text) parts.push(u.text);
  if (u.amenities && u.amenities.length > 0) parts.push(`with ${u.amenities.map((a) => (a === "pool" ? "swimming pool" : a)).join(" ")}`);
  if (u.intent === "buy" && u.kind !== "stay") parts.push("for sale");
  if (u.intent === "rent" && u.kind === "property") parts.push("for rent");
  if (u.minPrice !== undefined && u.maxPrice !== undefined) parts.push(`${nairaWords(u.minPrice)} to ${nairaWords(u.maxPrice)}`);
  else if (u.maxPrice !== undefined) parts.push(`under ${nairaWords(u.maxPrice)}`);
  else if (u.minPrice !== undefined) parts.push(`above ${nairaWords(u.minPrice)}`);
  if (u.guests !== undefined) parts.push(`for ${u.guests} guests`);
  const place = placeFromLabel(u.place);
  if (place) parts.push(`in ${place.name}`);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** The filters a zero-result search can loosen, most restrictive first. */
export const LOOSENABLE = ["maxPrice", "minPrice", "bedrooms", "amenities", "furnished", "checkIn", "guests", "addedSince", "listingKinds", "intent", "text"] as const;
export type Loosenable = (typeof LOOSENABLE)[number];

export function withoutFilter(u: Understood, key: Loosenable): Understood {
  const next: Understood = { ...u };
  delete next[key];
  if (key === "checkIn") delete next.checkOut;
  return next;
}
