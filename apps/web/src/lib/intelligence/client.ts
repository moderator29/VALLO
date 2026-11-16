import {
  INTELLIGENCE_TABS,
  type CategoryFacts,
  type DiscoverResponse,
  type ForYouRail,
  type TrendingArea,
  type IntelligenceKind,
  type IntelligenceTab,
  type SearchResponse,
  type SuggestResponse,
  type Understood,
} from "./contract";

/**
 * VALLO INTELLIGENCE: THE SCREEN'S SIDE OF THE WIRE. Client only.
 *
 * The screen (`components/app/intelligence/*`) talks to the engine through
 * these helpers and nothing else, against the shapes in `contract.ts`:
 *
 *   GET    /api/intelligence/suggest   typed-ahead, every ~150ms while typing
 *   GET    /api/intelligence/search    the results, one tab and page at a time
 *   GET    /api/intelligence/discover  the empty screen
 *   POST   /api/intelligence/event     a result was opened (fire and forget)
 *   DELETE /api/intelligence/recent    forget one recent search (?q=) or all
 *
 * THE ADDRESS IS THE STATE. A search is `/intelligence?q=...&tab=...` plus
 * the filters the person set or took away, so a search is a link, Back walks
 * it, and opening a result and coming back lands on the same results. The
 * same parameters go to the search route:
 *
 *   q        the words, as typed, never rewritten
 *   tab      one of `INTELLIGENCE_TABS` ("all" is left out)
 *   place, intent, beds, min, max, furnished, amenities, in, out, guests,
 *   since, types, kind
 *            a filter set by the person (the drawer, a clarify answer);
 *            these win over whatever the words said
 *   drop     filters the person removed from "Search understood", by
 *            `Understood` key, comma separated; the engine forgets them
 *            even when the words said them. `didYouMean` in it means
 *            "search the words as typed" after the engine showed a fix
 *   cursor   the next page (search route only)
 *   submit   "1" on the first read of a search the person submitted (Enter,
 *            a suggestion, a chip to try), never in the address: it lets
 *            the engine record the search and, when the rules read too
 *            little, ask the model (search route only)
 */

/* ------------------------------------------------------------- routes */

export const INTEL_API = {
  suggest: "/api/intelligence/suggest",
  search: "/api/intelligence/search",
  discover: "/api/intelligence/discover",
  event: "/api/intelligence/event",
  recent: "/api/intelligence/recent",
} as const;

export const INTEL_PATH = "/intelligence";

/* ---------------------------------------------------------- url state */

/** The `Understood` fields a person can set or take away, and their address names. */
export const FILTER_PARAMS = {
  kind: "kind",
  intent: "intent",
  place: "place",
  bedrooms: "beds",
  minPrice: "min",
  maxPrice: "max",
  furnished: "furnished",
  amenities: "amenities",
  checkIn: "in",
  checkOut: "out",
  guests: "guests",
  addedSince: "since",
  listingKinds: "types",
  text: "words",
} as const;

export type FilterKey = keyof typeof FILTER_PARAMS;
export const FILTER_KEYS = Object.keys(FILTER_PARAMS) as FilterKey[];

export type IntelFilters = Partial<Pick<Understood, FilterKey>>;

/** What may be dropped: a filter, or the engine's spelling fix. */
export type DropKey = FilterKey | "didYouMean";

export type IntelUrlState = {
  q: string;
  tab: IntelligenceTab;
  filters: IntelFilters;
  drop: DropKey[];
};

export const EMPTY_STATE: IntelUrlState = { q: "", tab: "all", filters: {}, drop: [] };

type Raw = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: Raw, name: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(name) ?? undefined;
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WHOLE = /^\d{1,12}$/;

function wholeNumber(value: string | undefined, max: number): number | undefined {
  if (!value || !WHOLE.test(value)) return undefined;
  const n = Number(value);
  return n >= 0 && n <= max ? n : undefined;
}

function list(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,24}$/i.test(s))
    .slice(0, 8);
  return items.length > 0 ? items : undefined;
}

export function isTab(value: string | undefined | null): value is IntelligenceTab {
  return !!value && (INTELLIGENCE_TABS as readonly string[]).includes(value);
}

/** The words as the field keeps them: trimmed, single spaced, capped. */
export function cleanWords(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

/** The state in an address, read defensively: anything malformed is simply not there. */
export function parseIntelUrl(params: Raw): IntelUrlState {
  const q = cleanWords(read(params, "q") ?? "");
  const tabRaw = read(params, "tab");
  const tab = isTab(tabRaw) ? tabRaw : "all";
  const filters: IntelFilters = {};
  const kind = read(params, FILTER_PARAMS.kind);
  if (kind && (["place", "property", "stay", "restaurant", "roommate", "person", "community", "post", "screen", "guide", "personal"] as string[]).includes(kind)) {
    filters.kind = kind as IntelligenceKind;
  }
  const intent = read(params, FILTER_PARAMS.intent);
  if (intent === "rent" || intent === "buy" || intent === "stay") filters.intent = intent;
  const place = cleanWords(read(params, FILTER_PARAMS.place) ?? "").slice(0, 60);
  if (place) filters.place = place;
  const beds = wholeNumber(read(params, FILTER_PARAMS.bedrooms), 20);
  if (beds !== undefined && beds > 0) filters.bedrooms = beds;
  const min = wholeNumber(read(params, FILTER_PARAMS.minPrice), 100_000_000_000);
  if (min !== undefined && min > 0) filters.minPrice = min;
  const max = wholeNumber(read(params, FILTER_PARAMS.maxPrice), 100_000_000_000);
  if (max !== undefined && max > 0) filters.maxPrice = max;
  const furnished = read(params, FILTER_PARAMS.furnished);
  if (furnished === "1") filters.furnished = true;
  if (furnished === "0") filters.furnished = false;
  const amenities = list(read(params, FILTER_PARAMS.amenities));
  if (amenities) filters.amenities = amenities;
  const checkIn = read(params, FILTER_PARAMS.checkIn);
  if (checkIn && ISO_DATE.test(checkIn)) filters.checkIn = checkIn;
  const checkOut = read(params, FILTER_PARAMS.checkOut);
  if (checkOut && ISO_DATE.test(checkOut)) filters.checkOut = checkOut;
  const guests = wholeNumber(read(params, FILTER_PARAMS.guests), 30);
  if (guests !== undefined && guests > 0) filters.guests = guests;
  const since = read(params, FILTER_PARAMS.addedSince);
  if (since && ISO_DATE.test(since)) filters.addedSince = since;
  const types = list(read(params, FILTER_PARAMS.listingKinds));
  if (types) filters.listingKinds = types;
  const words = cleanWords(read(params, FILTER_PARAMS.text) ?? "").slice(0, 80);
  if (words) filters.text = words;
  const drop = (list(read(params, "drop")) ?? []).filter((key): key is DropKey => key === "didYouMean" || (FILTER_KEYS as string[]).includes(key));
  return { q, tab, filters, drop: [...new Set(drop)] };
}

/** The state as query parameters, in one fixed order so equal states give equal addresses. */
export function intelParams(state: IntelUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.tab !== "all") params.set("tab", state.tab);
  for (const key of FILTER_KEYS) {
    const value = state.filters[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(FILTER_PARAMS[key], value.join(","));
    } else if (typeof value === "boolean") {
      params.set(FILTER_PARAMS[key], value ? "1" : "0");
    } else if (value !== "") {
      params.set(FILTER_PARAMS[key], String(value));
    }
  }
  const drop = state.drop.filter((key) => key === "didYouMean" || state.filters[key] === undefined);
  if (drop.length > 0) params.set("drop", [...drop].sort().join(","));
  return params;
}

export function intelHref(state: IntelUrlState): string {
  const qs = intelParams(state).toString();
  return qs ? `${INTEL_PATH}?${qs}` : INTEL_PATH;
}

/** A key that names one search (words, tab and filters): the cache and the stale-response guard read it. */
export function searchKey(state: IntelUrlState): string {
  return intelParams(state).toString();
}

/** The filters a clarify answer or the drawer set, kept to the fields the address carries. */
export function filtersFrom(patch: Partial<Understood>): IntelFilters {
  const out: IntelFilters = {};
  for (const key of FILTER_KEYS) {
    const value = patch[key];
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** The same search with these filters set (and no longer dropped). Page one. */
export function withFilters(state: IntelUrlState, filters: IntelFilters): IntelUrlState {
  const set = Object.keys(filters) as FilterKey[];
  const merged: IntelFilters = { ...state.filters };
  for (const key of set) {
    const value = filters[key];
    if (value === undefined) delete merged[key];
    else (merged as Record<string, unknown>)[key] = value;
  }
  return { ...state, filters: merged, drop: state.drop.filter((key) => key === "didYouMean" || !set.includes(key)) };
}

/** The same search without these filters, whether the person set them or the words said them. */
export function withoutFilters(state: IntelUrlState, keys: readonly FilterKey[]): IntelUrlState {
  const filters: IntelFilters = { ...state.filters };
  for (const key of keys) delete filters[key];
  return { ...state, filters, drop: [...new Set([...state.drop, ...keys])] };
}

/** Every filter in what was understood, taken away; the words stay. */
export function clearedFilters(state: IntelUrlState, understood: Understood | null): IntelUrlState {
  const present = FILTER_KEYS.filter((key) => key !== "text" && understood?.[key] !== undefined);
  return { ...state, filters: {}, drop: [...new Set([...state.drop.filter((k) => k !== "text"), ...present])] };
}

/* ------------------------------------------------------------ fetches */

export class IntelFetchError extends Error {
  constructor(
    readonly status: number,
    readonly offline: boolean,
  ) {
    super(offline ? "offline" : `status ${status}`);
    this.name = "IntelFetchError";
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { accept: "application/json" }, credentials: "same-origin" });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    throw new IntelFetchError(0, isOffline());
  }
  if (!response.ok) throw new IntelFetchError(response.status, false);
  try {
    return (await response.json()) as T;
  } catch {
    throw new IntelFetchError(response.status, false);
  }
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export async function fetchSuggest(q: string, tab: IntelligenceTab, signal?: AbortSignal): Promise<SuggestResponse> {
  const params = new URLSearchParams({ q });
  if (tab !== "all") params.set("tab", tab);
  const body = await getJson<Partial<SuggestResponse>>(`${INTEL_API.suggest}?${params.toString()}`, signal);
  return { q: typeof body.q === "string" ? body.q : q, suggestions: asArray(body.suggestions), ...(body.didYouMean ? { didYouMean: body.didYouMean } : {}) };
}

export async function fetchSearch(
  state: IntelUrlState,
  cursor: string | undefined,
  signal?: AbortSignal,
  options: { submit?: boolean } = {},
): Promise<SearchResponse> {
  const params = intelParams(state);
  if (cursor) params.set("cursor", cursor);
  else if (options.submit) params.set("submit", "1");
  const body = await getJson<Partial<SearchResponse>>(`${INTEL_API.search}?${params.toString()}`, signal);
  if (!body || typeof body !== "object" || !body.understood) throw new IntelFetchError(500, false);
  return {
    q: typeof body.q === "string" ? body.q : state.q,
    understood: body.understood,
    tab: isTab(body.tab) ? body.tab : state.tab,
    tabs: asArray(body.tabs),
    results: asArray(body.results),
    ...(body.groups ? { groups: asArray(body.groups) } : {}),
    ...(body.next ? { next: body.next } : {}),
    ...(body.alternatives ? { alternatives: asArray(body.alternatives) } : {}),
    ...(body.partial ? { partial: true } : {}),
    ...(body.showing && typeof body.showing.query === "string" ? { showing: body.showing } : {}),
    tookMs: typeof body.tookMs === "number" ? body.tookMs : 0,
  };
}

export async function fetchDiscover(signal?: AbortSignal): Promise<DiscoverResponse> {
  const body = await getJson<Partial<DiscoverResponse>>(INTEL_API.discover, signal);
  return {
    popular: asArray(body.popular),
    recent: asArray(body.recent),
    fresh: asArray(body.fresh),
    people: asArray(body.people),
    examples: asArray<string>(body.examples).filter((x) => typeof x === "string"),
    /* Round 3, optional: kept only when the engine sent them. */
    ...(Array.isArray(body.categories) ? { categories: asArray<CategoryFacts>(body.categories).filter((c) => c && typeof c.tab === "string") } : {}),
    ...(Array.isArray(body.trending) ? { trending: asArray<TrendingArea>(body.trending).filter((t) => t && typeof t.area === "string" && typeof t.newListings === "number") } : {}),
    ...(Array.isArray(body.forYou) ? { forYou: asArray<ForYouRail>(body.forYou).filter((r) => r && Array.isArray(r.items) && r.items.length > 0) } : {}),
  };
}

/** A result was opened: what kind, where in the list. Fire and forget; never waits, never throws. */
export function sendIntelEvent(event: { event: "click"; q: string; tab: IntelligenceTab; kind: IntelligenceKind; position: number }): void {
  try {
    void fetch(INTEL_API.event, {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => undefined);
  } catch {
    /* Analytics never stands in the way of opening a result. */
  }
}

async function deleteRecent(query: string | null): Promise<boolean> {
  const url = query ? `${INTEL_API.recent}?${new URLSearchParams({ q: query }).toString()}` : INTEL_API.recent;
  try {
    const response = await fetch(url, { method: "DELETE", credentials: "same-origin" });
    return response.ok;
  } catch {
    return false;
  }
}

/** Forget one of the member's recent searches. True when the server did. */
export function removeRecentSearch(query: string): Promise<boolean> {
  return deleteRecent(query);
}

/** Forget all of them. True when the server did. */
export function clearRecentSearches(): Promise<boolean> {
  return deleteRecent(null);
}
