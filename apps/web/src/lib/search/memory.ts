/**
 * What the browser remembers between hunts.
 *
 * Three small memories, one module, because they are the same mechanism and
 * splitting them across three files is how two of them end up with different
 * pruning rules and a third with none:
 *
 *   the chosen view    list or map, in a COOKIE
 *   recent searches    the last few real hunts, in local storage
 *   recently viewed    the last few places opened, in local storage
 *
 * WHY THE VIEW IS A COOKIE AND THE OTHER TWO ARE NOT. The view has to be known
 * BEFORE the first byte of HTML: `/search` is rendered on the server, and a
 * map-preferring person arriving with no `view=` in the address must get the
 * map in that render, not a list that flips to a map a beat later. Only a
 * cookie is readable at that point. The other two are decoration on an already
 * correct page, so they can arrive after hydration, and keeping them out of
 * every request header is worth the flicker-free-ness they do not need.
 *
 * NOTHING HERE IS TRUSTED ON THE WAY BACK IN. Everything is read back through
 * a validator: local storage is user-writable, survives a deploy, and will
 * contain whatever shape this file wrote three versions ago. A bad entry is
 * dropped, never rendered and never thrown.
 */

import type { ViewKey } from "@/lib/listings/search-params";
import { isSafePhoto, type CardGlanceMark } from "@/lib/listings/card-glance";
import { syncRecentFlag } from "./recent-flag";

/* --------------------------------------------------------------- the view */

/** Read by `app/(app)/search/page.tsx` on the server when `view=` is absent. */
export const VIEW_COOKIE = "nf_view";

/** A year: this is a preference, not a session. */
const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Remember the view the person is actually looking at. Client only. */
export function rememberView(view: ViewKey): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${VIEW_COOKIE}=${view}; path=/; max-age=${VIEW_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    /* Cookies can be refused outright. The URL still carries the view, so the
       only thing lost is the memory. */
  }
}

/* ---------------------------------------------------------------- storage */

function readList<T>(key: string, valid: (value: unknown) => value is T, max: number): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(valid).slice(0, max);
  } catch {
    return [];
  }
}

function writeList<T>(key: string, entries: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    /* Private browsing, or a full quota. Both are survivable: the feature is
       a convenience and the page is complete without it. */
  }
  notifyRecent();
}

function clearKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* As above. */
  }
  /* Outside the `try`, on purpose. A clear that threw still has to tell the
     strip to re-read: what it reads back is then whatever is really there,
     which is the honest answer either way. */
  notifyRecent();
}

/* ------------------------------------------------- the strip's subscription */

/**
 * What the recent strip subscribes to, so it stops guessing at mount.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS HERE AND NOT IN THE COMPONENT.
 *
 * `RecentStrip` read both lists in a mount effect and pushed them into state.
 * That is `react-hooks/set-state-in-effect`, and more to the point it meant the
 * strip could only ever show what was in storage at the moment it mounted. On
 * `/search` the strip and the search form are on the same screen: a search run
 * from that form calls `rememberSearch`, and the strip above it went on showing
 * the list from before, with no way to be told.
 *
 * A store needs the writes to notify, and the writes are here. That is the whole
 * reason this lives beside `writeList` rather than in a component module: a
 * subscription whose publisher does not know about it is a subscription that
 * only works across tabs, which is the half-working control this codebase keeps
 * finding and taking out.
 *
 * ---------------------------------------------------------------------------
 * THE SNAPSHOTS ARE CACHED ON THE RAW STRING, WHICH IS NOT AN OPTIMISATION.
 *
 * `useSyncExternalStore` compares snapshots by identity, so a reader that parses
 * JSON into a fresh array on every call re-renders for ever. Each list caches
 * its parsed value against the raw text it was parsed from, and rebuilds only
 * when that text moves.
 */
const recentListeners = new Set<() => void>();

function notifyRecent(): void {
  /* The root's "this phone has opened listings" mark follows the store, so the
     Recently viewed row reserves its height correctly on a client-side visit
     to Home too (`recent-flag.ts`). */
  syncRecentFlag(readRecentListings().length);
  for (const listener of recentListeners) listener();
}

/** Both lists come back empty on the server, which is what there is to show. */
const NO_SEARCHES: RecentSearch[] = [];
const NO_LISTINGS: RecentListing[] = [];

function rawOf(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

let searchesRaw: string | null = null;
let searchesValue: RecentSearch[] = NO_SEARCHES;

export function recentSearchesSnapshot(): RecentSearch[] {
  const raw = rawOf(RECENT_SEARCHES_KEY);
  if (raw !== searchesRaw) {
    searchesRaw = raw;
    searchesValue = readRecentSearches();
  }
  return searchesValue;
}

let listingsRaw: string | null = null;
let listingsValue: RecentListing[] = NO_LISTINGS;

export function recentListingsSnapshot(): RecentListing[] {
  const raw = rawOf(RECENT_LISTINGS_KEY);
  if (raw !== listingsRaw) {
    listingsRaw = raw;
    listingsValue = readRecentListings();
  }
  return listingsValue;
}

export function recentSearchesServerSnapshot(): RecentSearch[] {
  return NO_SEARCHES;
}

export function recentListingsServerSnapshot(): RecentListing[] {
  return NO_LISTINGS;
}

export function subscribeRecent(onChange: () => void): () => void {
  recentListeners.add(onChange);
  /* The cross-tab half. `storage` fires only on OTHER documents of this origin,
     so it and the listener set above answer two different questions and both are
     needed. A null key is a whole-origin clear and counts as a change to both. */
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === RECENT_SEARCHES_KEY ||
      event.key === RECENT_LISTINGS_KEY
    ) {
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    recentListeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/* ------------------------------------------------------- recent searches */

export const RECENT_SEARCHES_KEY = "nf_recent_searches";

/**
 * Five. A recent list long enough to need scrolling has stopped being a
 * shortcut and become a second search problem.
 */
export const MAX_RECENT_SEARCHES = 5;

export type RecentSearch = {
  /** What the person reads on the chip, e.g. "Lagos, 2 beds". */
  label: string;
  /** The exact address that produced it, filters and all. */
  href: string;
};

function isRecentSearch(value: unknown): value is RecentSearch {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.label === "string" &&
    entry.label.length > 0 &&
    entry.label.length <= 80 &&
    typeof entry.href === "string" &&
    /* Same-origin, and specifically a search. An href read back from storage
       is attacker-controlled text, and it goes into a link. B2: the Stays
       search is a search too. */
    isSearchHref(entry.href)
  );
}

/** `/search` or `/stays/search`, bare or with a query, and nothing else. */
export function isSearchHref(href: string): boolean {
  return /^\/(stays\/)?search(\?|$)/.test(href);
}

/** B2: the recent searches that belong to one search screen. */
export function searchesFor(entries: readonly RecentSearch[], path: "/search" | "/stays/search"): RecentSearch[] {
  return entries.filter((entry) => entry.href === path || entry.href.startsWith(`${path}?`));
}

export function readRecentSearches(): RecentSearch[] {
  return readList(RECENT_SEARCHES_KEY, isRecentSearch, MAX_RECENT_SEARCHES);
}

/**
 * Record a hunt, newest first, de-duplicated by the address rather than by the
 * label. Two different filter sets can read the same on a chip, and offering
 * the wrong one of them back is worse than offering neither.
 */
export function rememberSearch(entry: RecentSearch): void {
  if (!isRecentSearch(entry)) return;
  const existing = readRecentSearches().filter((e) => e.href !== entry.href);
  writeList(RECENT_SEARCHES_KEY, [entry, ...existing].slice(0, MAX_RECENT_SEARCHES));
}

export function clearRecentSearches(): void {
  clearKey(RECENT_SEARCHES_KEY);
}

/* ------------------------------------------------------- recently viewed */

export const RECENT_LISTINGS_KEY = "nf_recent_listings";

export const MAX_RECENT_LISTINGS = 8;

export type RecentListing = {
  id: string;
  title: string;
  /** "Lekki, Lagos". Kept short: this is a chip, not a card. */
  place: string;
  /*
   * B2, 30 September 2026: what the small card on Home draws, all optional so
   * an entry written by an older build still reads. Each is the string the
   * listing's own card printed (`lib/listings/card-glance.ts`).
   */
  photo?: string | null;
  price?: string | null;
  priceNote?: string;
  mark?: CardGlanceMark;
};

function optionalShort(value: unknown, max: number): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.length <= max);
}

function isRecentListing(value: unknown): value is RecentListing {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    entry.id.length > 0 &&
    entry.id.length <= 120 &&
    /* The id becomes `/listing/${id}`, so it may only be an id: no slashes, no
       scheme, no `..`. */
    /^[A-Za-z0-9._-]+$/.test(entry.id) &&
    typeof entry.title === "string" &&
    entry.title.length > 0 &&
    typeof entry.place === "string" &&
    (entry.photo === undefined || entry.photo === null || isSafePhoto(entry.photo)) &&
    optionalShort(entry.price, 40) &&
    optionalShort(entry.priceNote, 40) &&
    (entry.mark === undefined || entry.mark === null || entry.mark === "verified" || entry.mark === "example")
  );
}

export function readRecentListings(): RecentListing[] {
  return readList(RECENT_LISTINGS_KEY, isRecentListing, MAX_RECENT_LISTINGS);
}

export function rememberListing(entry: RecentListing): void {
  if (!isRecentListing(entry)) return;
  const existing = readRecentListings().filter((e) => e.id !== entry.id);
  writeList(RECENT_LISTINGS_KEY, [entry, ...existing].slice(0, MAX_RECENT_LISTINGS));
}

export function clearRecentListings(): void {
  clearKey(RECENT_LISTINGS_KEY);
}
