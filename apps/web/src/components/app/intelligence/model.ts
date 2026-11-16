import { countOf, formatDate, formatMoney, formatNumber, plural, type Dictionary, type Locale, type PluralForms, type UnitNoun } from "@vallo/i18n/core";
import type { IntelligenceKind, IntelligenceResult, IntelligenceTab, Suggestion, Understood } from "@/lib/intelligence/contract";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { FilterKey, IntelFilters } from "@/lib/intelligence/client";
import { parseDiscoveryQuery, toSearchHref } from "@/lib/listings/search-params";
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

export const digits = (value: string) => value.replace(/[^\d]/g, "").slice(0, 12);
const whole = (value: string): number | undefined => (/^\d+$/.test(value) && Number(value) > 0 ? Number(value) : undefined);

/** The drawer's answers as filters to set and filters to take away. */
export function filtersOfDraft(draft: Draft, fields: readonly FilterKey[]): { set: IntelFilters; cleared: FilterKey[] } {
  const set: IntelFilters = {};
  const cleared: FilterKey[] = [];
  const put = <K extends FilterKey>(key: K, value: IntelFilters[K] | undefined) => {
    if (!fields.includes(key)) return;
    if (value === undefined) cleared.push(key);
    else set[key] = value;
  };
  put("intent", draft.intent || undefined);
  put("place", draft.place.trim() || undefined);
  put("bedrooms", whole(draft.bedrooms));
  put("minPrice", whole(draft.minPrice));
  put("maxPrice", whole(draft.maxPrice));
  put("furnished", draft.furnished ? true : undefined);
  put("checkIn", draft.checkIn || undefined);
  put("checkOut", draft.checkOut || undefined);
  put("guests", whole(draft.guests));
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
