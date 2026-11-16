import { countOf, formatDate, formatMoney, formatNumber, plural, type Dictionary, type Locale, type PluralForms, type UnitNoun } from "@vallo/i18n/core";
import type { CategoryFacts, ForYouReason, IntelligenceKind, IntelligenceResult, IntelligenceTab, Suggestion, Understood } from "@/lib/intelligence/contract";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { FilterKey, IntelFilters } from "@/lib/intelligence/client";
import { parseDiscoveryQuery, toSearchHref } from "@/lib/listings/search-params";
import { addDays, thisWeekend, understand } from "@/lib/intelligence/understand";
import { placeFromLabel } from "@/lib/intelligence/places";
import { AMENITY_WORDS, KIND_WORDS } from "@/lib/intelligence/vocabulary";
import type { ListingKind } from "@/lib/listings/types";
import type { PersonCardData } from "@/components/social/find/PersonCards";

/**
 * THE INTELLIGENCE SCREEN'S OWN DECISIONS, AS PURE FUNCTIONS: what a chip
 * says, which suggestions group together, what a person row carries, where
 * "See all properties" goes. No React, no fetch, so each is tested alone
 * (`model.test.ts`) and the components only draw.
 */

export type IntelligenceCopy = Dictionary["intelligence"];

/** "{query}" and friends, filled. A missing value leaves the braces out rather than "undefined". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (values[name] !== undefined ? String(values[name]) : ""));
}

/* -------------------------------------------------------- understood */

export type UnderstoodChip = {
  /** Stable React key. */
  id: string;
  label: string;
  /** What removing this chip takes away. */
  keys: FilterKey[];
};

/** The small glyph each kind of chip wears, so a reader sees what was read at a glance. */
export const CHIP_ICON: Record<string, UiIconName> = {
  kind: "search",
  types: "building-apartment",
  intent: "key",
  beds: "bed",
  place: "location",
  price: "banknote",
  furnished: "house",
  amenities: "check",
  dates: "calendar-check",
  guests: "users",
  since: "clock",
  words: "search",
};

const NAIRA = (amount: number, locale: Locale) => formatMoney(Math.round(amount) * 100, locale);

/** An ISO day (Africa/Lagos) as "12 Dec". */
export function shortDay(iso: string, locale: Locale): string {
  const date = new Date(`${iso}T12:00:00+01:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return formatDate(date, locale, { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

const KIND_CHIP: Partial<Record<IntelligenceKind, keyof IntelligenceCopy["kinds"]>> = {
  property: "property",
  stay: "stay",
  restaurant: "restaurant",
  roommate: "roommate",
  person: "person",
  community: "community",
  post: "post",
  guide: "guide",
};


/**
 * "Search understood", as removable chips, in reading order. Only what the
 * engine actually read: nothing is added, and the words themselves are never
 * rewritten. `kind` is left out when it is already the open tab.
 */
export function understoodChips(u: Understood, copy: IntelligenceCopy, locale: Locale, tab: IntelligenceTab = "all"): UnderstoodChip[] {
  const c = copy.understood;
  const chips: UnderstoodChip[] = [];
  if (u.kind && KIND_CHIP[u.kind] && u.kind !== tab) chips.push({ id: "kind", label: copy.kinds[KIND_CHIP[u.kind]!], keys: ["kind"] });
  if (u.listingKinds && u.listingKinds.length > 0) {
    const words = u.listingKinds.map((k) => copy.listingKinds[k]).filter((w): w is string => Boolean(w));
    if (words.length > 0) chips.push({ id: "types", label: words.join(", "), keys: ["listingKinds"] });
  }
  if (u.intent) chips.push({ id: "intent", label: u.intent === "rent" ? c.rent : u.intent === "buy" ? c.buy : c.stay, keys: ["intent"] });
  if (u.bedrooms !== undefined) chips.push({ id: "beds", label: plural(u.bedrooms, c.bedrooms, locale), keys: ["bedrooms"] });
  if (u.place) chips.push({ id: "place", label: u.place, keys: ["place"] });
  if (u.minPrice !== undefined && u.maxPrice !== undefined) {
    chips.push({ id: "price", label: fill(c.between, { min: NAIRA(u.minPrice, locale), max: NAIRA(u.maxPrice, locale) }), keys: ["minPrice", "maxPrice"] });
  } else if (u.maxPrice !== undefined) {
    chips.push({ id: "price", label: fill(c.under, { price: NAIRA(u.maxPrice, locale) }), keys: ["maxPrice"] });
  } else if (u.minPrice !== undefined) {
    chips.push({ id: "price", label: fill(c.over, { price: NAIRA(u.minPrice, locale) }), keys: ["minPrice"] });
  }
  if (u.furnished !== undefined) chips.push({ id: "furnished", label: u.furnished ? c.furnished : c.unfurnished, keys: ["furnished"] });
  if (u.amenities && u.amenities.length > 0) chips.push({ id: "amenities", label: u.amenities.join(", "), keys: ["amenities"] });
  if (u.checkIn && u.checkOut) {
    chips.push({ id: "dates", label: fill(c.dates, { from: shortDay(u.checkIn, locale), to: shortDay(u.checkOut, locale) }), keys: ["checkIn", "checkOut"] });
  } else if (u.checkIn) {
    chips.push({ id: "dates", label: fill(c.from, { date: shortDay(u.checkIn, locale) }), keys: ["checkIn", "checkOut"] });
  }
  if (u.guests !== undefined) chips.push({ id: "guests", label: plural(u.guests, c.guests, locale), keys: ["guests"] });
  if (u.addedSince) chips.push({ id: "since", label: fill(c.since, { date: shortDay(u.addedSince, locale) }), keys: ["addedSince"] });
  if (u.text && u.text !== u.raw) chips.push({ id: "words", label: fill(c.words, { words: u.text }), keys: ["text"] });
  return chips;
}

/* --------------------------------------------------------- results */

/** The figure and its period, or null when the record states no price. */
export function priceOf(result: IntelligenceResult, copy: IntelligenceCopy, locale: Locale): { amount: string; unit: string | null } | null {
  if (!result.price || !(result.price.amount > 0)) return null;
  const amount = formatMoney(Math.round(result.price.amount) * 100, locale, "NGN", { compact: result.price.amount >= 1_000_000 });
  const unit = result.price.per ? copy.per[result.price.per] : null;
  return { amount, unit };
}

const COUNT_NOUNS: Record<string, keyof IntelligenceCopy["counted"]> = {
  follower: "follower",
  followers: "follower",
  member: "member",
  members: "member",
  listing: "listing",
  listings: "listing",
  post: "post",
  posts: "post",
  review: "review",
  reviews: "review",
};

/**
 * A real count with its noun. The contract names the noun by its `units` key
 * ("followers", "members", "replies"), so `countOf` says it in the reader's
 * plural; a noun the units table does not hold falls back to this screen's
 * own counted phrases, then to the figure and the engine's word.
 */
export function countPhrase(count: IntelligenceResult["count"], copy: IntelligenceCopy, locale: Locale): string | null {
  if (!count || !Number.isFinite(count.value) || count.value < 0) return null;
  const noun = count.noun.trim();
  try {
    const said = countOf(count.value, noun as UnitNoun, locale);
    if (typeof said === "string" && said.length > 0) return said;
  } catch {
    /* Not a units key: the screen's own phrases below. */
  }
  const known = COUNT_NOUNS[noun.toLowerCase()];
  if (known) return plural(count.value, copy.counted[known] as PluralForms, locale);
  return `${formatNumber(count.value, locale)} ${noun}`;
}

/** A role key from the engine ("agent") as the dictionary's word, or the engine's own word. */
export function roleWord(role: string | undefined, copy: IntelligenceCopy): string | null {
  if (!role) return null;
  const key = role.trim().toLowerCase() as keyof IntelligenceCopy["people"]["roles"];
  return copy.people.roles[key] ?? role;
}

/**
 * A person result as the app's own people card (`PersonCards.tsx`): the
 * viewer's own row says "You" and never offers a Follow; a Follow appears
 * only when the engine offered one and the profile has a handle to follow.
 */
export function personCardOf(result: IntelligenceResult, copy: IntelligenceCopy, locale: Locale): PersonCardData {
  const person = result.person ?? {};
  const handle = person.handle ?? null;
  const offersFollow = (result.actions ?? []).some((a) => a.id === "follow");
  const view = (result.actions ?? []).find((a) => a.id === "view-profile" && a.href);
  const action: PersonCardData["action"] = person.isYou
    ? { kind: "you", label: copy.people.you, href: result.href }
    : offersFollow && handle
      ? { kind: "follow", handle, following: person.following === true }
      : { kind: "view", label: view?.label ?? copy.goTo, ariaLabel: fill(copy.people.open, { name: result.title }), href: view?.href ?? result.href };
  const facts = [countPhrase(result.count, copy, locale), result.place ?? null].filter((x): x is string => Boolean(x));
  return {
    key: result.key,
    href: result.href,
    name: result.title,
    handle,
    avatarUrl: result.imageUrl ?? null,
    tier: "none",
    roleWord: roleWord(person.role, copy),
    facts,
    action,
  };
}

/** The listing kinds a property result belongs to, for the space card's status pill. */
export function isListingKind(kind: IntelligenceKind): boolean {
  return kind === "property" || kind === "stay";
}

/**
 * "See all properties" on the marketplace search, carrying what was
 * understood that the marketplace also reads (words, bedrooms, budget).
 */
export function propertiesSearchHref(u: Understood | null, q: string): string {
  const base = parseDiscoveryQuery({});
  const words = [u?.text, u?.place].filter(Boolean).join(" ").trim() || q;
  const kind = u?.listingKinds?.find((k) => ["rental", "apartment", "home", "villa", "land", "shop", "office"].includes(k)) as ListingKind | undefined;
  return toSearchHref({
    ...base,
    ...(words ? { q: words } : {}),
    ...(kind ? { kind } : {}),
    ...(u?.bedrooms !== undefined ? { bedrooms: u.bedrooms } : {}),
    ...(u?.minPrice !== undefined ? { minMinor: Math.round(u.minPrice) * 100 } : {}),
    ...(u?.maxPrice !== undefined ? { maxMinor: Math.round(u.maxPrice) * 100 } : {}),
  });
}

/* ------------------------------------------------------ suggestions */

export type SuggestGroupKey = keyof IntelligenceCopy["suggest"]["groups"];

const GROUP_OF: Record<Suggestion["kind"], SuggestGroupKey> = {
  query: "query",
  recent: "recent",
  place: "place",
  property: "listing",
  stay: "listing",
  restaurant: "listing",
  roommate: "listing",
  person: "person",
  screen: "screen",
  community: "other",
  post: "other",
  guide: "other",
  personal: "other",
};

const GROUP_ORDER: SuggestGroupKey[] = ["recent", "query", "place", "listing", "person", "screen", "other"];

export type SuggestGroup = { key: SuggestGroupKey; items: { suggestion: Suggestion; index: number }[] };

/**
 * The suggestions in their groups, in a fixed group order, each carrying its
 * index in the one flat list the keyboard walks (so Down from the last
 * recent search lands on the first query, and so on).
 */
export function groupSuggestions(suggestions: readonly Suggestion[]): { groups: SuggestGroup[]; flat: Suggestion[] } {
  const buckets = new Map<SuggestGroupKey, Suggestion[]>();
  for (const s of suggestions) {
    if (!s || typeof s.label !== "string" || (!s.query && !s.href)) continue;
    const key = GROUP_OF[s.kind] ?? "other";
    buckets.set(key, [...(buckets.get(key) ?? []), s]);
  }
  const flat: Suggestion[] = [];
  const groups: SuggestGroup[] = [];
  for (const key of GROUP_ORDER) {
    const items = buckets.get(key);
    if (!items || items.length === 0) continue;
    groups.push({ key, items: items.map((suggestion) => ({ suggestion, index: flat.push(suggestion) - 1 })) });
  }
  return { groups, flat };
}

/** The next active option for an arrow key, wrapping, or -1 for none. */
export function moveActive(current: number, dir: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return dir === 1 ? 0 : count - 1;
  return (current + dir + count) % count;
}

/* -------------------------------------------------------- assistant */

/** The member assistant, opened with a question already in its composer (`/assistant?q=`). */
export function assistantHref(question: string): string {
  return `/assistant?${new URLSearchParams({ q: question.slice(0, 600) }).toString()}`;
}

/* ------------------------------------------------------- the drawer */

/** What each tab can be narrowed by, in the order the drawer asks. */
export const FILTER_FIELDS: Record<IntelligenceTab, FilterKey[]> = {
  all: ["place"],
  property: ["intent", "place", "bedrooms", "minPrice", "maxPrice", "furnished"],
  stay: ["place", "checkIn", "checkOut", "guests", "maxPrice"],
  restaurant: ["place"],
  roommate: ["place", "maxPrice"],
  person: ["place"],
  community: ["place"],
  guide: [],
  personal: [],
};

export type Draft = {
  intent: "" | "rent" | "buy";
  place: string;
  bedrooms: string;
  minPrice: string;
  maxPrice: string;
  furnished: boolean;
  checkIn: string;
  checkOut: string;
  guests: string;
};

export function draftOf(u: Partial<Understood>): Draft {
  return {
    intent: u.intent === "rent" || u.intent === "buy" ? u.intent : "",
    place: u.place ?? "",
    bedrooms: u.bedrooms !== undefined ? String(Math.min(5, u.bedrooms)) : "",
    minPrice: u.minPrice !== undefined ? String(u.minPrice) : "",
    maxPrice: u.maxPrice !== undefined ? String(u.maxPrice) : "",
    furnished: u.furnished === true,
    checkIn: u.checkIn ?? "",
    checkOut: u.checkOut ?? "",
    guests: u.guests !== undefined ? String(u.guests) : "",
  };
}

/** The digits of a typed amount, without leading zeros or separators: "₦1,500,000" is "1500000". */
export const digits = (value: string) => value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
const whole = (value: string): number | undefined => (/^\d+$/.test(value) && Number(value) > 0 ? Number(value) : undefined);

/** The most an amount, and a party, can be: what the address keeps (`parseIntelUrl`). */
const PRICE_CEILING = 100_000_000_000;
const GUEST_CEILING = 30;

/** An amount as it is read, grouped in the reader's own way ("1,500,000"), from its digits. */
export function groupedAmount(raw: string, locale: Locale): string {
  const d = digits(raw);
  return d ? formatNumber(Number(d), locale) : "";
}

/** Where the caret goes in grouped text so that `count` digits sit before it. */
export function caretAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i]!)) seen += 1;
    if (seen === count) return i + 1;
  }
  return text.length;
}

/** The drawer's answers as filters to set and filters to take away. */
export function filtersOfDraft(draft: Draft, fields: readonly FilterKey[]): { set: IntelFilters; cleared: FilterKey[] } {
  const set: IntelFilters = {};
  const cleared: FilterKey[] = [];
  const put = <K extends FilterKey>(key: K, value: IntelFilters[K] | undefined) => {
    if (!fields.includes(key)) return;
    if (value === undefined) cleared.push(key);
    else set[key] = value;
  };
  const cap = (n: number | undefined, ceiling: number) => (n === undefined ? undefined : Math.min(n, ceiling));
  let min = cap(whole(draft.minPrice), PRICE_CEILING);
  let max = cap(whole(draft.maxPrice), PRICE_CEILING);
  /* Lowest over highest is a slip of the thumb, not a search for nothing: the two change places. */
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  /* A stay that ends before it starts keeps its start, not its end. */
  const checkIn = draft.checkIn || undefined;
  const checkOut = draft.checkOut && (!checkIn || draft.checkOut > checkIn) ? draft.checkOut : undefined;
  put("intent", draft.intent || undefined);
  put("place", draft.place.trim() || undefined);
  put("bedrooms", whole(draft.bedrooms));
  put("minPrice", min);
  put("maxPrice", max);
  put("furnished", draft.furnished ? true : undefined);
  put("checkIn", checkIn);
  put("checkOut", checkOut);
  put("guests", cap(whole(draft.guests), GUEST_CEILING));
  return { set, cleared };
}

/* ----------------------------------------------------- the panel rows */

export type AssistRow = { id: string; icon: UiIconName; title: string; sub: string; href: string };

/** The rows the panel offers for what is on screen now; each opens the member assistant with the question filled in. */
export function assistRows({
  q,
  chips,
  results,
  place,
  copy,
}: {
  q: string;
  chips: readonly UnderstoodChip[];
  results: readonly IntelligenceResult[];
  place: string | undefined;
  copy: IntelligenceCopy;
}): AssistRow[] {
  const a = copy.assist;
  const rows: AssistRow[] = [];
  if (q) {
    rows.push({ id: "filters", icon: "sliders", title: a.suggestFilters, sub: a.suggestFiltersSub, href: assistantHref(fill(a.suggestFiltersAsk, { query: q })) });
  }
  if (chips.length > 0) {
    rows.push({ id: "explain", icon: "info", title: a.explain, sub: a.explainSub, href: assistantHref(fill(a.explainAsk, { filters: chips.map((c) => c.label).join(", ") })) });
  }
  const comparable = results.filter((r) => r.kind === "property" || r.kind === "stay" || r.kind === "restaurant" || r.kind === "roommate").slice(0, 2);
  if (comparable.length === 2) {
    const [first, second] = comparable as [IntelligenceResult, IntelligenceResult];
    rows.push({
      id: "compare",
      icon: "scale",
      title: a.compare,
      sub: fill(a.compareSub, { first: first.title, second: second.title }),
      href: assistantHref(fill(a.compareAsk, { first: first.title, second: second.title })),
    });
  }
  if (q) {
    rows.push({
      id: "places",
      icon: "location",
      title: a.places,
      sub: a.placesSub,
      href: assistantHref(place ? fill(a.placesAsk, { place, query: q }) : fill(a.placesAskNoPlace, { query: q })),
    });
  }
  rows.push({ id: "where", icon: "compass", title: a.whereFind, sub: a.whereFindSub, href: assistantHref(`${a.whereFindAsk}${q}`.trim()) });
  return rows;
}

/* --------------------------------------------------- the model step, honestly */

/**
 * Whether a submitted search is one the engine may hand to the model: the
 * engine's own gate (`shouldAskModel` in `lib/intelligence/model.ts`, server
 * side because that file carries zod), read here from the same rules
 * (`understand`). Six words or more, no kind the rules could name, and less
 * than 40 per cent of the words read. A plain search ("2 bed in lekki") is
 * never one, so the "Reading your words" line never shows for it.
 * `model.test.ts` holds the two gates to the same answers.
 */
export function mayAskModel(words: string): boolean {
  if (!words.trim()) return false;
  try {
    const { understood, hints } = understand(words);
    return hints.wordCount >= 6 && !understood.kind && hints.readShare < 0.4;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------- city postcards */

/** The cities a postcard is drawn for (each has its own line drawing). */
export const POSTCARD_CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu"] as const;
export type PostcardCity = (typeof POSTCARD_CITIES)[number];

/** The city a result's place line names ("Lekki Phase 1, Lagos" is Lagos), when it is one with a postcard. */
export function postcardCityOf(place: string | undefined | null): PostcardCity | null {
  if (!place) return null;
  const parts = place.split(",").map((p) => p.trim()).filter(Boolean).reverse();
  for (const part of parts) {
    const hit = placeFromLabel(part);
    if (!hit) continue;
    const city = hit.isCity ? hit.name : hit.city;
    return (POSTCARD_CITIES as readonly string[]).includes(city) ? (city as PostcardCity) : null;
  }
  return null;
}

/**
 * The postcards worth drawing: only cities a real, newest record sits in
 * (so a tap always finds at least that one), in the order they first
 * appear, each once. No record, no postcard; nothing is padded out.
 */
export function postcardCities(results: readonly IntelligenceResult[]): PostcardCity[] {
  const seen: PostcardCity[] = [];
  for (const r of results) {
    const city = postcardCityOf(r.place) ?? postcardCityOf(r.subtitle);
    if (city && !seen.includes(city)) seen.push(city);
  }
  return seen;
}

/* ------------------------------------------------------- the chips' flight */

const NUMBER_WORD = "(?:\\d+|one|two|three|four|five|six)";

/** Where in the words a chip was read from (a character index), or -1 when it cannot be found. */
export function wordOrigin(words: string, chipId: string, u: Understood): number {
  const text = words.toLowerCase();
  const find = (re: RegExp) => {
    const m = re.exec(text);
    return m ? m.index : -1;
  };
  /* The earliest of these words, whole (KIND_WORDS keys are letters, spaces and hyphens). */
  const anyKey = (keys: readonly string[]) => {
    let best = -1;
    for (const key of keys) {
      if (!/^[a-z -]+$/.test(key)) continue;
      const at = find(new RegExp(`\\b${key}\\b`));
      if (at >= 0 && (best < 0 || at < best)) best = at;
    }
    return best;
  };
  switch (chipId) {
    case "beds":
      return find(new RegExp(`${NUMBER_WORD}\\s*-?\\s*(?:bed|br\\b|bdr)`));
    case "guests":
      return find(new RegExp(`${NUMBER_WORD}\\s*(?:guest|people|adult|person)`));
    case "place": {
      const name = (u.place ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
      const at = name ? text.indexOf(name.split(" ")[0]!) : -1;
      return at;
    }
    case "price":
      return find(/(?:under|below|less than|max|over|above|between|from|budget|₦)\s*₦?\s*\d|\d+(?:\.\d+)?\s*(?:k|m|million|thousand)\b/);
    case "kind":
    case "types":
      return anyKey(Object.keys(KIND_WORDS).filter((k) => KIND_WORDS[k]!.kind === u.kind));
    case "intent":
      return find(/\b(?:rent|buy|sale|let|lease|stay|purchase)/);
    case "furnished":
      return find(/\b(?:un)?furnish/);
    case "amenities": {
      let best = -1;
      for (const [re] of AMENITY_WORDS) {
        const at = find(new RegExp(re.source));
        if (at >= 0 && (best < 0 || at < best)) best = at;
      }
      return best;
    }
    case "dates":
      return find(/\b(?:this weekend|weekend|tonight|tomorrow|today|next week|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/);
    case "since":
      return find(/\b(?:new|newest|latest|this week|recent)/);
    case "words":
      return u.text ? text.indexOf(u.text.toLowerCase().split(" ")[0]!) : -1;
    default:
      return -1;
  }
}

/* -------------------------------------------------------- why it matches */

/** The engine's "why" line ("2 bedrooms · Lekki · under ₦5m") as its parts, for small pills. */
export function whyParts(why: string | undefined | null): string[] {
  if (!why) return [];
  return why
    .split(/\s*[·•|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
}

/* ------------------------------------------------- round 3: the flow */

/** The categories with a tile and a page of their own, in the order the grid draws them. */
export const EXPLORE_TABS = ["property", "stay", "restaurant", "roommate", "person"] as const satisfies readonly IntelligenceTab[];
export type ExploreTab = (typeof EXPLORE_TABS)[number];

export function isExploreTab(tab: IntelligenceTab): tab is ExploreTab {
  return (EXPLORE_TABS as readonly string[]).includes(tab);
}

/** Today on the Lagos calendar, as an ISO day. */
export function lagosToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "15 Nov", for a moment (an ISO time), on the Lagos calendar. */
export function dayOf(iso: string, locale: Locale): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDate(date, locale, { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

/** The three stay windows a person picks from: tonight, this weekend, next weekend (Lagos calendar). */
export function stayWindows(today: string): Record<"tonight" | "weekend" | "nextWeekend", { checkIn: string; checkOut: string }> {
  const weekend = thisWeekend(today);
  return {
    tonight: { checkIn: today, checkOut: addDays(today, 1) },
    weekend,
    nextWeekend: { checkIn: addDays(weekend.checkIn, 7), checkOut: addDays(weekend.checkOut, 7) },
  };
}

/** The budget ceilings offered as quick picks, in naira: a year's rent, or a price to buy. Thresholds, not data. */
export const BUDGET_PICKS = {
  rent: [1_000_000, 2_500_000, 5_000_000, 10_000_000],
  buy: [50_000_000, 100_000_000, 250_000_000, 500_000_000],
} as const;
export const BEDROOM_PICKS = [1, 2, 3, 4] as const;
export const GUEST_PICKS = [1, 2, 3, 4] as const;

/** A short naira figure for a chip: "₦2.5m". */
export function shortNaira(amount: number, locale: Locale): string {
  return formatMoney(Math.round(amount) * 100, locale, "NGN", { compact: amount >= 1_000_000 });
}

/** A tile's freshness line, only from a real count: "3 new this week", else "12 live listings", else nothing. */
export function tileLine(facts: CategoryFacts | undefined, locale: Locale): string | null {
  if (!facts) return null;
  if (facts.newThisWeek > 0) return countOf(facts.newThisWeek, "newThisWeek", locale);
  if (facts.live > 0) return countOf(facts.live, "liveListings", locale);
  return null;
}

/** The next "nice" budget above this one, about a quarter more at least: 5m to 7.5m, 2m to 2.5m. */
export function biggerBudget(max: number): number {
  const target = max * 1.25;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
  const scale = 10 ** Math.floor(Math.log10(Math.max(1, target)));
  for (const step of steps) {
    const value = step * scale;
    if (value >= target) return Math.round(value);
  }
  return Math.round(10 * scale);
}

export type RefineChip = { id: string; label: string; icon: UiIconName; set: IntelFilters };

const LISTING_TABS: readonly IntelligenceTab[] = ["property", "stay", "restaurant"];

/**
 * QUICK REFINEMENTS UNDER THE RESULTS, from what the search really understood:
 * a bigger budget when it had one, one more bedroom or guest when it named
 * them, the whole city when it named an area in it, this weekend for a stay
 * with no dates, furnished for a home that did not say, and the newest. Each
 * is a filter the engine reads, never a promise of results. Four at most.
 */
export function refineChips(u: Understood, tab: IntelligenceTab, today: string, copy: IntelligenceCopy, locale: Locale): RefineChip[] {
  const kind = tab !== "all" ? tab : u.kind;
  const listing = kind ? LISTING_TABS.includes(kind as IntelligenceTab) : Boolean(u.place || u.bedrooms || u.maxPrice);
  if (!listing) return [];
  const stay = kind === "stay" || u.intent === "stay";
  const chips: RefineChip[] = [];
  if (u.maxPrice !== undefined && u.maxPrice > 0) {
    const more = biggerBudget(u.maxPrice);
    chips.push({ id: "budget", icon: "wallet", label: fill(copy.refine.upTo, { price: shortNaira(more, locale) }), set: { maxPrice: more } });
  }
  if (u.bedrooms !== undefined && kind !== "restaurant" && u.bedrooms < 10) {
    chips.push({ id: "beds", icon: "bed", label: plural(u.bedrooms + 1, copy.understood.bedrooms as PluralForms, locale), set: { bedrooms: u.bedrooms + 1 } });
  }
  if (u.place && u.place.includes(",")) {
    const city = u.place.split(",").pop()!.trim();
    if (city) chips.push({ id: "city", icon: "location", label: fill(copy.refine.anywhereIn, { city }), set: { place: city } });
  }
  if (stay && !u.checkIn) {
    const weekend = thisWeekend(today);
    chips.push({ id: "weekend", icon: "calendar-check", label: copy.refine.thisWeekend, set: { checkIn: weekend.checkIn, checkOut: weekend.checkOut } });
  }
  if (stay && u.guests !== undefined && u.guests < 30) {
    chips.push({ id: "guests", icon: "users", label: plural(u.guests + 1, copy.understood.guests as PluralForms, locale), set: { guests: u.guests + 1 } });
  }
  if (!stay && kind !== "restaurant" && u.furnished === undefined) {
    chips.push({ id: "furnished", icon: "house", label: copy.refine.furnished, set: { furnished: true } });
  }
  if (!u.addedSince) {
    chips.push({ id: "new", icon: "clock", label: copy.refine.newThisWeek, set: { addedSince: addDays(today, -7) } });
  }
  return chips.slice(0, 4);
}

/** A "For you" reason, in the reader's words. */
export function forYouReasonText(reason: ForYouReason, copy: IntelligenceCopy, locale: Locale): string {
  const r = copy.forYou.reasons;
  switch (reason.key) {
    case "areaBudget":
    case "areaSaved":
    case "nearSaved":
      return fill(r[reason.key], { area: reason.area });
    case "budget":
    case "saved":
      return r[reason.key];
    case "kind": {
      const noun = copy.listingKinds[reason.kind];
      return fill(r.kind, { kind: noun ? noun.toLocaleLowerCase(locale) : copy.forYou.kindFallback });
    }
    case "lastSearch":
      return fill(r.lastSearch, { query: reason.query });
    case "newSince":
      return fill(r.newSince, { date: dayOf(reason.since, locale) ?? "" });
  }
}
