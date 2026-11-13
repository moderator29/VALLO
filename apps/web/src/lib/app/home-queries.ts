import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { resolveSession } from "../actions/session";
import { getShellIdentity } from "./shell-queries";
import { memo } from "../cache/memo";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";
import { MEDIA_BUCKET } from "../social/posts-media";
import { knownInterests } from "../interests/model";
import { parseSettings } from "../profile/schema";

/**
 * Everything the home overview renders, in one place.
 *
 * Home is the first screen anybody sees, so every number on it has to be a
 * number the database actually holds. That rules out a hardcoded city, a
 * hardcoded post count and an invented greeting: the city comes from the
 * caller's own profile, the places and their post counts come from
 * `public.areas`, and the greeting comes from the clock in Lagos.
 *
 * Nothing here throws. A home screen is not worth taking down for a failed
 * count, so every read falls back to the honest empty answer and the page
 * renders the designed state for it.
 */

type Db = SupabaseClient<Database>;

/** The four parts of a Nigerian day, decided in Africa/Lagos and nowhere else. */
export type Daypart = "morning" | "afternoon" | "evening" | "night";

export type HomePlace = {
  /** Two-letter state code, empty when the person has not said. */
  stateCode: string;
  /** The state's name, empty when unknown. */
  stateName: string;
  /** Local government code, empty when the person has not said. */
  lgaCode: string;
  /** The local government's name, empty when unknown. */
  lgaName: string;
  /**
   * The line under "Explore your city". Their local government when they have
   * one, otherwise their state, otherwise the city the platform is open in.
   */
  label: string;
  /** The smaller line beside it: the state, or the country. */
  context: string;
  /** True when this is the caller's own answer rather than the platform's. */
  isOwn: boolean;
};

export type HomeArea = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  city: string;
  postCount: number;
  memberCount: number;
  /** Decimal degrees, or null when nobody has placed this area yet. */
  lat: number | null;
  lng: number | null;
};

export type TrendingItem = {
  key: string;
  href: string;
  /** "Story" or "Gist", so the reader knows what they are about to open. */
  kindLabel: string;
  headline: string;
  /** The place it was posted in, for the second line. */
  placeLabel: string;
  /** A signed thumbnail, or null when there is no picture to show. */
  imageUrl: string | null;
  likeCount: number;
};

export type HomeOverview = {
  daypart: Daypart;
  /** First name where we have one, otherwise empty. Never a fiction. */
  firstName: string;
  avatarUrl: string;
  unreadNotifications: number;
  signedIn: boolean;
  place: HomePlace;
  areas: HomeArea[];
  trending: TrendingItem[];
  /**
   * True when this person has never been asked what they came here for.
   *
   * Home is where sign-up lands and where the OAuth callback returns to, so it
   * is the honest definition of "first entry to the app" and the one place the
   * first-run question is gated. It is answered from the profile read this
   * function already does rather than by a second round trip, because a
   * question about onboarding is not worth an extra query on every home render.
   *
   * False for a signed-out visitor, for a profile row that cannot be read, and
   * the moment the question has been answered or skipped. Interrupting somebody
   * on a guess is worse than not asking at all.
   */
  askIntent: boolean;
};

const EMPTY_PLACE: HomePlace = {
  stateCode: "",
  stateName: "",
  lgaCode: "",
  lgaName: "",
  label: "",
  context: "Nigeria",
  isOwn: false,
};

/**
 * The hour in Lagos, whatever clock the server is running on.
 *
 * Vercel runs in UTC and a phone in Lagos does not, so reading the server's own
 * hour would greet somebody with "Good evening" over breakfast. `Intl` is the
 * only correct way to ask, and it carries the rules with it, which for West
 * Africa Time is a fixed +01:00 but should still not be hardcoded.
 */
export function lagosHour(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    hour12: false,
  });
  const parsed = Number.parseInt(formatter.format(now), 10);
  return Number.isNaN(parsed) ? now.getUTCHours() : parsed % 24;
}

/**
 * Four dayparts, cut where a Lagos day actually turns rather than at the
 * textbook 12 and 18. Morning runs to noon, afternoon to five, evening to ten,
 * and everything after that is night.
 */
export function daypartFor(hour: number): Daypart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/* The greeting for each daypart is the reader's: `t.experienceDiscover.home.greeting[daypart]`. */

const AREA_LIMIT = 8;
const TRENDING_LIMIT = 6;

/** The first sentence of a post, for a single line of copy in a strip. */
function firstLine(body: string | null, limit = 90): string {
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  if (text.length === 0) return "";
  if (text.length <= limit) return text;
  // Never truncate with an ellipsis: cut back to the last whole word instead,
  // so the strip shows a shorter true sentence rather than a broken one.
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
}

/**
 * `trending: false` skips the strip's reads (stories, posts and the signing of
 * their photographs) and answers `trending: []`: for a page that draws the
 * greeting and the place but never the strip (the stays home).
 */
export const getHomeOverview = cache(async function getHomeOverview(
  wants: { trending?: boolean } = {},
): Promise<HomeOverview> {
  const withTrending = wants.trending !== false;
  const daypart = daypartFor(lagosHour());
  const base: HomeOverview = {
    daypart,
    firstName: "",
    avatarUrl: "",
    unreadNotifications: 0,
    signedIn: false,
    place: EMPTY_PLACE,
    areas: [],
    trending: [],
    askIntent: false,
  };

  const session = await resolveSession();

  if (session.state !== "signed-in") {
    // Signed out, the platform still has a face: the open places and what is
    // happening in them are public, so show them and say whose city it is.
    const guest = await anonClient();
    if (!guest) return base;
    const anonymous = await readOpenPlaces(guest, "");
    const trending = withTrending ? await readTrending(guest, anonymous.areas) : [];
    return { ...base, place: anonymous.place, areas: anonymous.areas, trending };
  }

  const { supabase, user } = session;

  /*
   * The unread count comes from the shell identity rather than a second
   * `notifications` count. `getShellIdentity` is wrapped in `cache` and the
   * `(app)` layout already awaits it in the same request, so this joins that
   * execution instead of paying another round trip. It fails soft to zero,
   * which is what the count here always did. The profile read stays: the shell
   * does not select the place codes, interests or settings this page needs.
   */
  const [profileResult, shell] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "first_name, nickname, display_name, avatar_url, state_code, lga_code, interests, settings",
      )
      .eq("id", user.id)
      .maybeSingle(),
    getShellIdentity(),
  ]);

  const profile = profileResult.data;
  const firstName =
    firstWord(profile?.nickname ?? "") ||
    firstWord(profile?.first_name ?? "") ||
    firstWord(profile?.display_name ?? "");

  const stateCode = profile?.state_code ?? "";
  const lgaCode = profile?.lga_code ?? "";

  const [named, places] = await Promise.all([
    readPlaceNames(stateCode, lgaCode),
    readOpenPlaces(supabase, stateCode),
  ]);

  const place: HomePlace =
    named.lgaName || named.stateName
      ? {
          stateCode,
          stateName: named.stateName,
          lgaCode,
          lgaName: named.lgaName,
          label: named.lgaName || named.stateName,
          context: named.lgaName && named.stateName ? `${named.stateName} State` : "Nigeria",
          isOwn: true,
        }
      : places.place;

  const trending = withTrending ? await readTrending(supabase, places.areas) : [];

  return {
    daypart,
    firstName,
    avatarUrl: profile?.avatar_url ?? "",
    unreadNotifications: shell.unreadNotifications,
    signedIn: true,
    place,
    areas: places.areas,
    trending,
    askIntent:
      profile !== null &&
      profile !== undefined &&
      knownInterests(profile.interests).length === 0 &&
      !parseSettings(profile.settings).interestsAsked,
  };
});

/* --------------------------------------------------------------- internals */

function firstWord(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

/**
 * The two reference tables that turn a profile's codes into names.
 *
 * `public.states` holds 37 rows and `public.local_governments` holds 774, and
 * neither changes without a migration. This used to be two `maybeSingle()`
 * queries per signed-in home render, forever, to answer a question whose entire
 * answer set is 811 short strings and fits in a map.
 *
 * Both are held for an hour through `lib/cache/memo`, which means a failed
 * refresh keeps the last good map rather than blanking the greeting, and
 * concurrent renders at the moment the TTL expires share one query. The loaders
 * build their own client for the reason `lib/listings/supabase-repository.ts`
 * gives: a cache that outlives a request must not close over a cookie-bound,
 * request-scoped client.
 *
 * The tables are readable by anyone, so nothing user-specific is being cached
 * here. The pairing of a code to a person stays where it belongs, on the
 * profile read.
 */
const PLACE_NAME_TTL_MS = 3_600_000;

const stateNames = memo<Map<string, string>>({
  ttlMs: PLACE_NAME_TTL_MS,
  empty: new Map(),
  load: async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("states").select("code, name");
    if (error || !data) throw new Error("states unavailable");
    return new Map(data.map((row) => [row.code, row.name]));
  },
});

const lgaNames = memo<Map<string, string>>({
  ttlMs: PLACE_NAME_TTL_MS,
  empty: new Map(),
  load: async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("local_governments").select("code, name");
    if (error || !data) throw new Error("local governments unavailable");
    return new Map(data.map((row) => [row.code, row.name]));
  },
});

/** Turn the two codes on a profile into the two names a person recognises. */
async function readPlaceNames(
  stateCode: string,
  lgaCode: string,
): Promise<{ stateName: string; lgaName: string }> {
  if (!stateCode && !lgaCode) return { stateName: "", lgaName: "" };
  try {
    const [states, lgas] = await Promise.all([
      stateCode ? stateNames.get() : Promise.resolve(new Map<string, string>()),
      lgaCode ? lgaNames.get() : Promise.resolve(new Map<string, string>()),
    ]);
    return {
      stateName: states.get(stateCode) ?? "",
      lgaName: lgas.get(lgaCode) ?? "",
    };
  } catch {
    return { stateName: "", lgaName: "" };
  }
}

/**
 * The open places to draw on the hero.
 *
 * With a state we show that state's places. Without one we show the busiest
 * places the platform has open anywhere, and the label says which city they are
 * in rather than claiming it is the reader's.
 */
async function readOpenPlaces(
  supabase: Db,
  stateCode: string,
): Promise<{ place: HomePlace; areas: HomeArea[] }> {
  try {
    const query = supabase
      .from("areas")
      .select("id, slug, name, kind, city, post_count, member_count, centre_lat, centre_lng")
      .eq("status", "ACTIVE");

    const scoped = stateCode ? query.eq("state_code", stateCode) : query;

    const { data, error } = await scoped
      .order("post_count", { ascending: false })
      .order("name", { ascending: true })
      .limit(AREA_LIMIT);

    if (error || !data) return { place: EMPTY_PLACE, areas: [] };

    const areas: HomeArea[] = data.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      city: row.city,
      postCount: row.post_count ?? 0,
      memberCount: row.member_count ?? 0,
      lat: toNumber(row.centre_lat),
      lng: toNumber(row.centre_lng),
    }));

    const city = mostCommonCity(areas);
    return {
      place: city ? { ...EMPTY_PLACE, label: city, context: "Nigeria", isOwn: false } : EMPTY_PLACE,
      areas,
    };
  } catch {
    return { place: EMPTY_PLACE, areas: [] };
  }
}

/**
 * Stories and gists worth a tap, from the places already on the hero.
 *
 * Stories come first because a story carries its own picture and headline, so
 * it fills the strip properly. Gists top it up. Both are read under the
 * caller's own policies, so a held or removed one can never appear.
 */
async function readTrending(supabase: Db, areas: HomeArea[]): Promise<TrendingItem[]> {
  if (areas.length === 0) return [];
  const areaIds = areas.map((area) => area.id);
  const nameById = new Map(areas.map((area) => [area.id, area.name]));

  try {
    const [storyResult, postResult] = await Promise.all([
      supabase
        .from("stories")
        .select("id, area_id, headline, image_path, like_count")
        .eq("status", "LIVE")
        .in("area_id", areaIds)
        .order("like_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(TRENDING_LIMIT),
      supabase
        .from("posts")
        .select("id, area_id, body, like_count")
        .eq("status", "LIVE")
        .eq("kind", "GIST")
        .is("parent_id", null)
        .in("area_id", areaIds)
        .order("like_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(TRENDING_LIMIT),
    ]);

    const stories = storyResult.data ?? [];
    const posts = postResult.data ?? [];

    const signed = await signThumbnails(
      supabase,
      stories.map((story) => story.image_path),
    );

    const items: TrendingItem[] = [];

    for (const story of stories) {
      items.push({
        key: `story-${story.id}`,
        href: `/stories/${story.id}`,
        kindLabel: "Story",
        headline: story.headline,
        placeLabel: story.area_id ? (nameById.get(story.area_id) ?? "") : "",
        imageUrl: signed.get(story.image_path) ?? null,
        likeCount: story.like_count ?? 0,
      });
    }

    for (const post of posts) {
      const headline = firstLine(post.body);
      if (headline.length === 0) continue;
      items.push({
        key: `post-${post.id}`,
        href: `/post/${post.id}`,
        kindLabel: "Gist",
        headline,
        placeLabel: post.area_id ? (nameById.get(post.area_id) ?? "") : "",
        imageUrl: null,
        likeCount: post.like_count ?? 0,
      });
    }

    return items.slice(0, TRENDING_LIMIT);
  } catch {
    return [];
  }
}

/** Sign a handful of private object paths, dropping any that will not sign. */
async function signThumbnails(supabase: Db, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;
  try {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(unique, 3600);
    for (const entry of data ?? []) {
      if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
    }
  } catch {
    // A thumbnail that will not sign is simply absent. The tile has a designed
    // state without a picture, so nothing here is worth failing the page for.
  }
  return out;
}

/** A read-only client for a visitor with no session, or null when unconfigured. */
async function anonClient(): Promise<Db | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    return await createClient();
  } catch {
    return null;
  }
}

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The city most of these places sit in, used only when nobody has told us. */
function mostCommonCity(areas: HomeArea[]): string {
  const tally = new Map<string, number>();
  for (const area of areas) {
    if (!area.city) continue;
    tally.set(area.city, (tally.get(area.city) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [city, count] of tally) {
    if (count > bestCount) {
      best = city;
      bestCount = count;
    }
  }
  return best;
}
