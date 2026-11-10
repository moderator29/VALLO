import {
  EMPTY_PEOPLE_FILTERS,
  EMPTY_ROOM_FILTERS,
  GENDER_PREFS,
  ROOM_TYPES,
  type GenderPref,
  type Period,
  type PeopleFilters,
  type RoomCard,
  type RoomFilters,
  type RoomType,
  type RoommateCard,
} from "./model";

/**
 * THE ROOMMATES FEED, AS DATA (pure, safe on both sides). The home screen is
 * a feed: the chips (All, Looking for a room, Offering a room), a search box
 * and a Filters sheet. This file turns that state into the two reads the
 * database already has (rooms posted by people with a home, and people
 * looking for one) and weaves the two pages into one list. Every filter runs
 * in the database; nothing here filters a list.
 */

export const FEED_TABS = ["all", "looking", "offering"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export type FeedFilters = {
  q: string;
  stateCode: string | null;
  city: string | null;
  /** Budget range in whole naira per month (what the slider shows). */
  minNaira: number | null;
  maxNaira: number | null;
  genderPref: GenderPref | null;
  roomType: RoomType | null;
  moveBy: string | null;
};

export const EMPTY_FEED_FILTERS: FeedFilters = { q: "", stateCode: null, city: null, minNaira: null, maxNaira: null, genderPref: null, roomType: null, moveBy: null };

/** The slider's ends and step, in naira per month. */
export const BUDGET_SLIDER = { min: 0, max: 500_000, step: 10_000 } as const;

export function feedActiveCount(f: FeedFilters): number {
  let n = 0;
  if (f.stateCode) n += 1;
  if (f.city) n += 1;
  if (f.minNaira !== null || f.maxNaira !== null) n += 1;
  if (f.genderPref) n += 1;
  if (f.roomType) n += 1;
  if (f.moveBy) n += 1;
  return n;
}

/** Whole naira to kobo, the way every amount is stored. */
export const nairaToMinor = (naira: number): number => Math.round(naira) * 100;

/** The room read for a tab and a set of filters. The budget is always per month. */
export function toRoomFilters(tab: FeedTab, f: FeedFilters): RoomFilters {
  const period: Period = "month";
  return {
    ...EMPTY_ROOM_FILTERS,
    q: f.q.trim().slice(0, 80),
    stateCode: f.stateCode,
    city: f.city?.trim() ? f.city.trim().slice(0, 60) : null,
    kinds: tab === "offering" ? ["room_offer", "roommate_wanted"] : undefined,
    minMinor: f.minNaira !== null && f.minNaira > 0 ? nairaToMinor(f.minNaira) : null,
    maxMinor: f.maxNaira !== null && f.maxNaira > 0 ? nairaToMinor(f.maxNaira) : null,
    period,
    moveBy: f.moveBy,
    roomType: f.roomType,
    genderPref: f.genderPref,
    sort: "newest",
  };
}

/** The people read: people who are looking for a room. Gender and room type are about a home, so they are left to the rooms. */
export function toPeopleFilters(f: FeedFilters): PeopleFilters {
  return {
    ...EMPTY_PEOPLE_FILTERS,
    q: f.q.trim().slice(0, 80),
    stateCode: f.stateCode,
    city: f.city?.trim() ? f.city.trim().slice(0, 60) : null,
    maxMinor: f.maxNaira !== null && f.maxNaira > 0 ? nairaToMinor(f.maxNaira) : null,
    period: "month",
    moveBy: f.moveBy,
    intent: "find_room",
    sort: "newest",
  };
}

export type FeedItem = { type: "room"; room: RoomCard } | { type: "person"; person: RoommateCard };

/** Where the next page starts in each read; null means that read has no more. */
export type FeedCursor = { rooms: number | null; people: number | null };

export const START_CURSOR: FeedCursor = { rooms: 0, people: 0 };

/** Which reads a tab uses. */
export function tabReads(tab: FeedTab): { rooms: boolean; people: boolean } {
  return { rooms: tab !== "looking", people: tab !== "offering" };
}

/** The cursor a tab starts from: a read the tab does not use is already done. */
export function startCursor(tab: FeedTab): FeedCursor {
  const r = tabReads(tab);
  return { rooms: r.rooms ? 0 : null, people: r.people ? 0 : null };
}

/** Weave two pages into one list, a person after every two rooms, so neither crowds the other out. */
export function weave(rooms: RoomCard[], people: RoommateCard[]): FeedItem[] {
  const out: FeedItem[] = [];
  let r = 0;
  let p = 0;
  while (r < rooms.length || p < people.length) {
    for (let i = 0; i < 2 && r < rooms.length; i += 1) out.push({ type: "room", room: rooms[r++]! });
    if (p < people.length) out.push({ type: "person", person: people[p++]! });
  }
  return out;
}

export const hasMore = (c: FeedCursor): boolean => c.rooms !== null || c.people !== null;

const nairaShape = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

/** Read a feed state from an address (`?tab=`, `?q=`, `?min=`...), so a shared link and Back land the same. */
export function readFeedState(p: Record<string, string | string[] | undefined>): { tab: FeedTab; filters: FeedFilters } {
  const one = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const tab = (FEED_TABS as readonly string[]).includes(one(p.tab) ?? "") ? (one(p.tab) as FeedTab) : "all";
  const gender = one(p.gender);
  const room = one(p.room);
  const by = one(p.by);
  return {
    tab,
    filters: {
      q: one(p.q)?.slice(0, 80) ?? "",
      stateCode: one(p.state)?.toUpperCase().slice(0, 2) ?? null,
      city: one(p.city)?.slice(0, 60) ?? null,
      minNaira: nairaShape(Number(one(p.min))),
      maxNaira: nairaShape(Number(one(p.max))),
      genderPref: gender && (GENDER_PREFS as readonly string[]).includes(gender) ? (gender as GenderPref) : null,
      roomType: room && (ROOM_TYPES as readonly string[]).includes(room) ? (room as RoomType) : null,
      moveBy: by && /^\d{4}-\d{2}-\d{2}$/.test(by) ? by : null,
    },
  };
}

/** The address for a feed state (only what is set). */
export function feedQuery(tab: FeedTab, f: FeedFilters): string {
  const q = new URLSearchParams();
  if (tab !== "all") q.set("tab", tab);
  if (f.q.trim()) q.set("q", f.q.trim());
  if (f.stateCode) q.set("state", f.stateCode);
  if (f.city) q.set("city", f.city);
  if (f.minNaira) q.set("min", String(f.minNaira));
  if (f.maxNaira) q.set("max", String(f.maxNaira));
  if (f.genderPref) q.set("gender", f.genderPref);
  if (f.roomType) q.set("room", f.roomType);
  if (f.moveBy) q.set("by", f.moveBy);
  const s = q.toString();
  return s ? `?${s}` : "";
}

