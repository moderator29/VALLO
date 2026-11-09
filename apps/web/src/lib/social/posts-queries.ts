import "server-only";

/**
 * Around: reading posts.
 *
 * Every read goes through the caller's own RLS-bound client, so the database
 * decides what a person may see rather than a `where` clause we remembered to
 * write. A blocked author disappears from the feed because `posts_select` says
 * so, not because this file filtered them out, which is the only way a block
 * cannot leak through a count somewhere.
 *
 * Nothing here throws. A feed that 500s because one row is odd is worse than a
 * feed that is briefly short.
 */

import { SUPABASE_URL, isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";
import { resolveSession } from "../actions/session";
import { formatMoney } from "@vallo/i18n/core";
import type { PostListing, PostRoommateListing, PostView } from "@/components/social/feed/PostCard";
import { getDictionary } from "@vallo/i18n";
import { isNotLive } from "../features/degrade";
import { ROOMMATES_ROUTES, roommatePhotoUrl } from "../features/roommates/model";
import { EDIT_WINDOW_MINUTES } from "./posts-schema";
import { listingPhotoUrl, readMediaFor, type SignedMedia } from "./posts-media";
import { encodeFeedCursor, parseFeedCursor } from "./posts-cursor";
import { DELETED_STATUS, conversationIsGone, pruneDeleted } from "./deleted-posts";
import {
  POST_LISTING_COLUMNS,
  amenityLabels,
  countOrNull,
  firstPhotoPath,
  statedPrice,
  type PostListingRow,
} from "../features/post-listing/model";

const POST_COLUMNS = `
  id, area_id, root_id, parent_id, depth, author_id, author_kind, kind, body,
  listing_id, payload, reply_count, like_count, repost_count, view_count,
  status, hold_reason, created_at, edited_at
`;

type RawPost = {
  id: string;
  area_id: string | null;
  root_id: string | null;
  parent_id: string | null;
  depth: number;
  author_id: string | null;
  author_kind: "USER" | "BOT" | "SYSTEM";
  kind: "GIST" | "ASK" | "REPLY" | "SHOWCASE" | "SYSTEM";
  body: string | null;
  listing_id: string | null;
  payload: unknown;
  reply_count: number;
  like_count: number;
  repost_count: number;
  view_count: number;
  status: "LIVE" | "HELD" | "REMOVED";
  hold_reason: string | null;
  created_at: string;
  edited_at: string | null;
};

/**
 * Relative time, in the shortest honest form.
 *
 * Deliberately not a library. Four branches and a date is the whole
 * requirement, and Lagos is the only timezone this product cares about, which
 * `formatDate` does not default to yet (R-108).
 */
function whenLabel(iso: string): string {
  const then = new Date(iso).getTime();
  /*
   * A row with no timestamp, or an unparseable one, used to take the whole page
   * down: `Intl.DateTimeFormat.format` raises RangeError on an invalid date,
   * inside a `map`, inside a server component. This module's own header
   * promises that nothing here throws, because a feed that 500s over one odd
   * row is worse than a feed that is briefly short, and this was the one place
   * that broke the promise. Caught in a real render, not in review.
   */
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Africa/Lagos",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

type Enrichment = {
  authors: Map<
    string,
    {
      handle: string | null;
      displayLabel: string | null;
      avatarPath: string | null;
      isAgent: boolean;
      supplyRole: "owner" | "agent" | null;
    }
  >;
  moderatorAreas: Map<string, string>;
  liked: Set<string>;
  saved: Set<string>;
  reposted: Set<string>;
  areas: Map<string, { name: string; slug: string }>;
  /** Signed picture URLs, by post. Empty for a post with none. */
  media: Map<string, SignedMedia[]>;
  /** The flat a post is about, by listing id. */
  listings: Map<string, PostListing>;
  /** A roommate post shared to the feed (`posts.roommate_listing_id`), by post id. */
  roommates: Map<string, PostRoommateListing>;
};

/**
 * VALLO ROOMMATES ON THE FEED (8 November 2026). A roommate post shared to
 * the feed is a GIST with `posts.roommate_listing_id` set. That column arrives
 * with the roommate SQL, so it is read on its own here rather than added to
 * `POST_COLUMNS`: before the SQL is pasted the read answers "no such column",
 * this returns nothing, and every feed read stays exactly as it was. The
 * room's summary goes through `roommate_listings`' own policy, so a post that
 * was paused or removed since simply draws no card.
 */
async function readRoommateShares(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postIds: string[],
): Promise<Map<string, PostRoommateListing>> {
  const out = new Map<string, PostRoommateListing>();
  if (!postIds.length) return out;
  try {
    const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
    const { data: links, error } = await db.from("posts").select("id, roommate_listing_id").in("id", postIds).not("roommate_listing_id", "is", null);
    if (error || !links?.length) {
      if (error && !isNotLive(error)) console.error("[feed] roommate shares read failed", error.code);
      return out;
    }
    const byPost = links as { id: string; roommate_listing_id: string }[];
    const ids = [...new Set(byPost.map((l) => l.roommate_listing_id))];
    const { data: rooms } = await db
      .from("roommate_listings")
      .select("id, kind, status, title, city, area, rent_minor, rent_period, share_minor, photos, verified_at")
      .in("id", ids)
      .eq("status", "live");
    const R = getDictionary("en").roommates;
    const byId = new Map<string, PostRoommateListing>();
    for (const r of (rooms ?? []) as {
      id: string;
      kind: "room_offer" | "roommate_wanted" | "together";
      title: string;
      city: string | null;
      area: string | null;
      rent_minor: number | null;
      rent_period: "month" | "year";
      share_minor: number | null;
      photos: string[] | null;
      verified_at: string | null;
    }[]) {
      const price = r.share_minor ?? r.rent_minor;
      const photo = r.photos?.[0] ?? null;
      byId.set(r.id, {
        id: r.id,
        href: ROOMMATES_ROUTES.listing(r.id),
        title: r.title,
        kindLabel: R.listingKinds[r.kind] ?? R.title,
        place: [r.area, r.city].filter(Boolean).join(", "),
        priceLabel: price !== null ? formatMoney(price, "en") : null,
        periodLabel: price !== null ? (R.perPeriod[r.rent_period] ?? "") : "",
        photoUrl: photo ? roommatePhotoUrl(SUPABASE_URL, photo) : null,
        verified: Boolean(r.verified_at),
        words: { kicker: R.entryX.feedKicker, view: R.entryX.feedView, verified: R.entryX.feedVerified },
      });
    }
    for (const l of byPost) {
      const room = byId.get(l.roommate_listing_id);
      if (room) out.set(l.id, room);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * The flats the posts on this page are about.
 *
 * **`post.listing` was hard-coded null and three things depended on it.** The
 * card carries a whole second architecture for a post about a flat, a
 * photographic plate with the title, the place, the price and a way through to
 * the listing; the district feed's Apartments chip filters on it; and the card
 * menu offers Contact agent only when it is set. None of the three could ever
 * fire, and the trigger that announces a newly published listing in its own
 * area has been writing `listing_id` onto posts since it landed. So the plate
 * existed, the posts existed, and nothing joined them up.
 *
 * `listings_select_published` does the filtering, so a listing that has been
 * taken down since the post was written simply does not come back and the post
 * renders as ordinary words rather than as a plate pointing at a dead page.
 *
 * Money is integer kobo and goes through `formatMoney`. Nothing here divides by
 * a hundred.
 */
async function readPostListings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingIds: string[],
): Promise<Map<string, PostListing>> {
  const out = new Map<string, PostListing>();
  if (listingIds.length === 0) return out;
  try {
    /* The columns `listings` really has (Agent FEATURES, 7 November 2026):
       the old select named `price_per_night_minor` and `price_period`, which
       do not exist, so this read failed and no plate ever rendered. The
       mapping is pure and tested in `lib/features/post-listing/model.ts`. */
    const { data, error } = await supabase
      .from("listings")
      .select(POST_LISTING_COLUMNS)
      .in("id", listingIds)
      .eq("status", "PUBLISHED");
    if (error || !data) return out;

    for (const row of data as unknown as PostListingRow[]) {
      const price = statedPrice(row);
      out.set(row.id, {
        id: row.id,
        title: row.title,
        area: row.area ?? "",
        city: row.city ?? "",
        priceLabel: price ? formatMoney(price.minor, "en") : "",
        periodLabel: price?.period ?? "",
        photoUrl: listingPhotoUrl(firstPhotoPath(row)),
        /* The verified mark is first-party inventory only, and a PUBLISHED row
           in `public.listings` is first-party by definition: it was reviewed by
           an admin before it could reach that status. `listings` carries no
           `verified` column, and the catalogue read reaches the same conclusion
           the same way. */
        verified: true,
        kind: price?.kind ?? "property",
        beds: countOrNull(row.bedrooms),
        baths: countOrNull(row.bathrooms),
        amenities: amenityLabels(row),
      });
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * One round of lookups for a whole page of posts, rather than a query per card.
 * Six small reads instead of six times the number of rows.
 */
async function enrich(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: RawPost[],
  viewerId: string | null,
): Promise<Enrichment> {
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter((v): v is string => Boolean(v)))];
  const areaIds = [...new Set(rows.map((r) => r.area_id).filter((v): v is string => Boolean(v)))];
  /* A post's own listing, plus anything the assistant cited in its payload. One
     read for both, because they resolve to the same rows through the same
     policy and two reads would be two chances to disagree. */
  const listingIds = [
    ...new Set([
      ...rows.map((r) => r.listing_id).filter((v): v is string => Boolean(v)),
      ...rows.flatMap((r) => citedIds(r.payload)),
    ]),
  ];
  const postIds = rows.map((r) => r.id);

  const [profiles, areas, mods, reactions, reposts, listings, roommates] = await Promise.all([
    authorIds.length
      ? supabase
          .from("social_profiles")
          .select("user_id, handle, display_label, avatar_path, is_agent, supply_role")
          .in("user_id", authorIds)
      : Promise.resolve({ data: [] as never[] }),
    areaIds.length
      ? supabase.from("areas").select("id, name, slug").in("id", areaIds)
      : Promise.resolve({ data: [] as never[] }),
    authorIds.length && areaIds.length
      ? supabase
          .from("area_members")
          .select("user_id, area_id")
          .eq("role", "MODERATOR")
          .in("user_id", authorIds)
          .in("area_id", areaIds)
      : Promise.resolve({ data: [] as never[] }),
    viewerId && postIds.length
      ? supabase
          .from("post_reactions")
          .select("post_id, mark")
          .eq("user_id", viewerId)
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as never[] }),
    viewerId && postIds.length
      ? supabase
          .from("post_reposts")
          .select("post_id")
          .eq("user_id", viewerId)
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as never[] }),
    readPostListings(supabase, listingIds),
    readRoommateShares(supabase, postIds),
  ]);

  const authors = new Map<string, ReturnType<() => Enrichment["authors"] extends Map<string, infer V> ? V : never>>();
  for (const p of (profiles.data ?? []) as {
    user_id: string;
    handle: string | null;
    display_label: string | null;
    avatar_path: string | null;
    is_agent: boolean;
    supply_role: "owner" | "agent" | null;
  }[]) {
    authors.set(p.user_id, {
      handle: p.handle,
      displayLabel: p.display_label,
      avatarPath: p.avatar_path,
      isAgent: p.is_agent,
      supplyRole: p.supply_role,
    });
  }

  const areaMap = new Map<string, { name: string; slug: string }>();
  for (const a of (areas.data ?? []) as { id: string; name: string; slug: string }[]) {
    areaMap.set(a.id, { name: a.name, slug: a.slug });
  }

  const moderatorAreas = new Map<string, string>();
  for (const m of (mods.data ?? []) as { user_id: string; area_id: string }[]) {
    moderatorAreas.set(`${m.user_id}:${m.area_id}`, m.area_id);
  }

  const liked = new Set<string>();
  const saved = new Set<string>();
  for (const r of (reactions.data ?? []) as { post_id: string; mark: string }[]) {
    if (r.mark === "LIKE") liked.add(r.post_id);
    if (r.mark === "SAVE") saved.add(r.post_id);
  }

  const reposted = new Set<string>(
    ((reposts.data ?? []) as { post_id: string }[]).map((r) => r.post_id),
  );

  /* Signed last, and for the whole page at once. `social-media` is private, so
     a picture needs a signed URL and sixty tiles would otherwise be sixty round
     trips. */
  const media = await readMediaFor(supabase, postIds);

  return { authors, moderatorAreas, liked, saved, reposted, areas: areaMap, media, listings, roommates };
}

/**
 * `posts.payload` is `jsonb`, which means it is whatever was put there, and the
 * only safe way to read it is to check every step. A bot reply written before
 * the shape settled, or a row somebody edited by hand, has to render as a post
 * with no citations rather than take a feed down.
 */
function payloadSource(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { source?: unknown }).source;
  return typeof value === "string" && value.trim() ? value : null;
}

function citedIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as { listingIds?: unknown }).listingIds;
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string").slice(0, 4);
}

function toView(row: RawPost, e: Enrichment, viewerId: string | null): PostView {
  const author = row.author_id ? (e.authors.get(row.author_id) ?? null) : null;
  const area = row.area_id ? (e.areas.get(row.area_id) ?? null) : null;
  const isMine = Boolean(viewerId && row.author_id === viewerId);

  /*
   * Whether Edit is worth offering.
   *
   * `posts_update_own` allows an update only on your own LIVE post inside
   * fifteen minutes, and this is that same rule read at render time so the
   * control is absent rather than present and refused. It goes stale while a
   * page sits open, which is fine: the action asks the database again and the
   * refusal has its own sentence.
   */
  const editable =
    isMine &&
    row.status === "LIVE" &&
    Date.now() - new Date(row.created_at).getTime() < EDIT_WINDOW_MINUTES * 60_000;

  /*
   * A removed post is a tombstone, and a tombstone carries nothing.
   *
   * Only the body was dropped here before, which was half the job. `posts_select`
   * hands a person their own removed rows back, and an admin removal never
   * nulls anything, so the card kept every picture, the listing plate with its
   * price, and the assistant's citations on a post that had been taken down.
   * The database now deletes the `post_media` rows as the status lands; this is
   * the same rule on the read side, for the rows already stored and for the
   * fields the trigger cannot reach.
   */
  const removed = row.status === "REMOVED";

  return {
    id: row.id,
    kind: row.kind,
    authorKind: row.author_kind,
    author: author && row.author_id
      ? {
          id: row.author_id,
          handle: author.handle,
          displayLabel: author.displayLabel,
          avatarPath: author.avatarPath,
          isAgent: author.isAgent,
          supplyRole: author.supplyRole,
          moderatorOf:
            row.author_id && row.area_id && e.moderatorAreas.has(`${row.author_id}:${row.area_id}`)
              ? (area?.name ?? null)
              : null,
        }
      : null,
    // A removed post keeps its place in a thread and loses its words. Deleting
    // the row would take other people's replies with it.
    body: removed ? null : row.body,
    createdLabel: whenLabel(row.created_at),
    edited: Boolean(row.edited_at),
    areaName: area?.name ?? null,
    areaSlug: area?.slug ?? null,
    listing: removed || !row.listing_id ? null : (e.listings.get(row.listing_id) ?? null),
    roommateListing: removed ? null : (e.roommates.get(row.id) ?? null),
    /* The assistant's own note about where its answer came from. Written into
       `payload` by `summonBot` and, until it was, a field on every card that was
       hard-coded null beside a renderer that had always been ready for it. */
    sourceNote: removed ? null : payloadSource(row.payload),
    cited: removed
      ? []
      : citedIds(row.payload)
          .map((id) => e.listings.get(id))
          .filter((item): item is PostListing => Boolean(item)),
    replyingTo: null,
    repostedBy: null,
    replyCount: row.reply_count,
    likeCount: row.like_count,
    repostCount: row.repost_count,
    viewCount: row.view_count,
    liked: e.liked.has(row.id),
    reposted: e.reposted.has(row.id),
    saved: e.saved.has(row.id),
    // The hold reason is only ever handed to the post's own author. The RLS
    // policy already refuses the row to anybody else, and this is the second
    // lock on the same door.
    heldReason: row.status === "HELD" && isMine ? row.hold_reason : null,
    removed,
    isMine,
    editable,
    media: removed
      ? []
      : (e.media.get(row.id) ?? []).map((item) => ({
          url: item.url,
          width: item.width,
          height: item.height,
        })),
    /* The raw body, so the editor opens on what is actually there rather than
       on whatever the card chose to render. A removed post has none. */
    rawBody: isMine ? row.body : null,
  };
}

/**
 * The people, posts and places this viewer has muted.
 *
 * **A mute used to write a row and change nothing.** Three controls wrote to
 * `public.mutes`, the card menu's "Mute", its "See less from them" and the
 * profile menu's, and the toast said "Muted. You will not see their posts."
 * Nothing anywhere read the table back: `private.can_see_post` and
 * `private.can_see_story` carry `blocked_with` and no mute test, which is
 * correct, because a block is a security boundary and a mute is a preference.
 * A preference still has to be honoured, and this is where it is honoured.
 *
 * It is deliberately a filter on a feed read rather than a policy. `mutes` is
 * one way and private: nobody is hidden from anybody else by it, nothing is
 * disclosed by it, and somebody who opens a muted person's own page or a thread
 * they were part of should still see them. Silencing a timeline is exactly the
 * promise the copy makes, and it is the whole promise.
 *
 * One small read per feed, and an empty answer on any failure, because a feed
 * that fails to load a preference should still be a feed.
 */
export type Muted = { users: Set<string>; posts: Set<string>; areas: Set<string> };

const NO_MUTES: Muted = { users: new Set(), posts: new Set(), areas: new Set() };

export async function readMutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerId: string | null,
): Promise<Muted> {
  if (!viewerId) return NO_MUTES;
  try {
    const { data, error } = await supabase
      .from("mutes")
      .select("target_kind, target_id")
      .eq("user_id", viewerId)
      .limit(500);
    if (error || !data) return NO_MUTES;
    const muted: Muted = { users: new Set(), posts: new Set(), areas: new Set() };
    for (const row of data as { target_kind: string; target_id: string }[]) {
      if (row.target_kind === "USER") muted.users.add(row.target_id);
      else if (row.target_kind === "POST") muted.posts.add(row.target_id);
      else if (row.target_kind === "AREA") muted.areas.add(row.target_id);
    }
    return muted;
  } catch {
    return NO_MUTES;
  }
}

export type FeedPage = {
  posts: PostView[];
  /**
   * Where the next page starts: the last consumed row's `created_at` and its
   * id, as `posts-cursor` writes them. Null when the feed ends. Opaque to
   * every caller; only `posts-cursor` knows the shape.
   */
  cursor: string | null;
  ended: boolean;
  /**
   * The read itself failed. Set only then, and always with no posts and no
   * cursor. Without it a dropped read was the same object as the true end of
   * the timeline, so a load-more that failed mid-scroll told the reader they
   * had seen everything and took the control away.
   */
  failed?: true;
};

const PAGE_SIZE = 20;

const EMPTY_PAGE: FeedPage = { posts: [], cursor: null, ended: true };
const FAILED_PAGE: FeedPage = { posts: [], cursor: null, ended: true, failed: true };

/**
 * One page of a timeline over a set of places.
 *
 * Roots only: replies belong to their thread, not to the timeline, or the same
 * conversation appears four times.
 *
 * Cursor pagination on created_at rather than offset, so a post arriving while
 * somebody reads cannot shift a page under them and make them see a row twice.
 *
 * Every read is the caller's own RLS-bound client, handed in by whichever
 * exported function resolved the session. Nothing here uses a service role, and
 * `posts_select` is still the only thing deciding which rows come back: the
 * `in` on `area_id` narrows a set the policy has already allowed, it does not
 * widen one.
 *
 * `muteAreas` is the one behavioural difference between a place's own feed and
 * a feed stitched from several. Opening a place is a deliberate act, so a place
 * mute does not apply there, exactly as a person mute does not apply on that
 * person's own page. On a combined timeline the reader never asked for that
 * place in particular, so the preference is honoured. `mutes` rows of kind
 * AREA have been written since the mute action landed and nothing had ever read
 * them back.
 */
async function readFeedPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerId: string | null,
  /**
   * Which places to read, or `null` for "everywhere".
   *
   * `null` is not the empty list and does not mean the same thing. An empty
   * list is a question with no rows behind it. `null` is no area restriction at
   * all, which hands the whole decision to `posts_select`, and `posts_select`
   * already says exactly the right thing: LIVE, in an ACTIVE or PAUSED place or
   * in no place at all, and not from somebody who blocked you. Filtering by a
   * list on top of that could only ever remove rows the policy had already
   * allowed, which is how posts went missing from a feed that claimed to show
   * everything.
   */
  areaIds: string[] | null,
  {
    cursor,
    muteAreas,
    includePublic = false,
    authorIds,
  }: { cursor?: string; muteAreas: boolean; includePublic?: boolean; authorIds?: string[] },
): Promise<FeedPage> {
  /* Posts by these people only (the Friends timeline). An empty list is a
     question with no rows behind it, so it never reaches Postgres. */
  if (authorIds && authorIds.length === 0) return EMPTY_PAGE;
  // No places is not an error and not an empty read: it is a question with no
  // rows behind it, and asking Postgres `in ()` would be a wasted round trip.
  // Unless public posts are wanted too, in which case there is still a feed to
  // read: somebody who has joined nothing can post to the whole platform and
  // must be able to see what they wrote.
  if (areaIds !== null && areaIds.length === 0 && !includePublic) return EMPTY_PAGE;

  /* A deleted post is deleted (founder, item 4). `posts_select` still hands
     an author their own removed rows, so the feed excludes them here, at the
     read, rather than drawing a tombstone in somebody's timeline. */
  let query = supabase.from("posts").select(POST_COLUMNS).neq("status", DELETED_STATUS);

  /* Circle posts stay in Circle: a post written inside a community is read
     by `lib/features/circle`, never by the Around feed. */
  query = query.is("community_id", null);

  if (areaIds === null) {
    /* Everywhere. No area predicate at all; the policy is the filter. */
  } else if (areaIds.length === 0) {
    query = query.is("area_id", null);
  } else if (includePublic) {
    // A post with no place belongs to everybody, so it sits alongside the
    // places this person reads rather than in a feed of its own.
    query = query.or(`area_id.is.null,area_id.in.(${areaIds.join(",")})`);
  } else {
    query = query.in("area_id", areaIds);
  }

  if (authorIds) query = query.in("author_id", authorIds);

  /* Vallo's own notes show for today only (founder, 1 November 2026): the
     older ones stay in the database and are simply not drawn. A day is the
     Lagos day, one hour ahead of UTC all year. */
  const lagosHour = 60 * 60 * 1000;
  const lagosDayStart = new Date(Math.floor((Date.now() + lagosHour) / 86_400_000) * 86_400_000 - lagosHour).toISOString();
  query = query.or(`author_kind.neq.SYSTEM,created_at.gte.${lagosDayStart}`);

  /* A TOTAL order, newest first. `id` is the primary key, so the pair can
     never tie and a keyset cursor over it can never skip or repeat a row. */
  query = query
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  const at = parseFeedCursor(cursor);
  if (at?.id) {
    /* Strictly after the named row in that order. PostgREST ANDs repeated
       `or` parameters, so this narrows the public-post `or` above rather than
       replacing it. */
    query = query.or(`created_at.lt.${at.at},and(created_at.eq.${at.at},id.lt.${at.id})`);
  } else if (at) {
    query = query.lt("created_at", at.at);
  }

  const [{ data, error }, muted] = await Promise.all([query, readMutes(supabase, viewerId)]);
  if (error || !data) return FAILED_PAGE;

  const all = data as unknown as RawPost[];
  const ended = all.length <= PAGE_SIZE;
  /* One row past the page is fetched only to answer "is there more", so the
     rows this call actually consumes are the first PAGE_SIZE of them, and the
     cursor is the last of THOSE. Taking it from the filtered list instead would
     step over every row a mute removed, and the next page would silently lose
     the posts that sat between them. */
  const consumed = ended ? all : all.slice(0, PAGE_SIZE);
  const last = consumed.length > 0 ? consumed[consumed.length - 1] : null;
  const cursorOut = ended || !last ? null : encodeFeedCursor(last.created_at, last.id);

  const page = consumed.filter(
    (row) =>
      !muted.posts.has(row.id) &&
      !(row.author_id && muted.users.has(row.author_id)) &&
      !(muteAreas && row.area_id && muted.areas.has(row.area_id)),
  );
  if (page.length === 0) return { posts: [], cursor: cursorOut, ended };

  const e = await enrich(supabase, page, viewerId);
  return {
    posts: page.map((row) => toView(row, e, viewerId)),
    cursor: cursorOut,
    ended,
  };
}

/** The client and viewer a feed read runs as. One place, so no caller can
    accidentally reach for a different one. */
async function feedClient() {
  const session = await resolveSession();
  const supabase = session.state === "signed-in" ? session.supabase : await createClient();
  const viewerId = session.state === "signed-in" ? session.user.id : null;
  return { supabase, viewerId };
}

/** A place's feed. */
export async function getAreaFeed(areaId: string, cursor?: string): Promise<FeedPage> {
  if (!isSupabaseConfigured()) return EMPTY_PAGE;
  const { supabase, viewerId } = await feedClient();
  return readFeedPage(supabase, viewerId, [areaId], { cursor, muteAreas: false });
}

/**
 * Everything happening in the places this person has joined, newest first.
 *
 * This is what `/around` is. The membership is read back through the viewer's
 * own client rather than trusted from the caller, so a userId that is not the
 * signed-in person returns nothing at all: `area_members_select` only ever
 * hands somebody their own rows, which makes the RLS policy the check rather
 * than an `if` somebody could forget to write.
 *
 * A place the person joined and then muted is still their place, so an AREA
 * mute is honoured here: it silences the timeline without leaving the place.
 */
export async function getJoinedFeed(userId: string, cursor?: string): Promise<FeedPage> {
  if (!isSupabaseConfigured()) return EMPTY_PAGE;

  const { supabase, viewerId } = await feedClient();
  if (!viewerId || viewerId !== userId) return EMPTY_PAGE;

  const { data, error } = await supabase
    .from("area_members")
    .select("area_id")
    .eq("user_id", userId)
    /* The same ceiling `listMyAreas` uses. Somebody in more places than this is
       reading a timeline, not a shelf, and the extra rows would only widen an
       `in` list that is already the whole of their Around. */
    .limit(60);
  if (error || !data) return FAILED_PAGE;

  const areaIds = (data as { area_id: string }[])
    .map((row) => row.area_id)
    .filter((id): id is string => Boolean(id));

  return readFeedPage(supabase, viewerId, areaIds, {
    cursor,
    muteAreas: true,
    // Your places, plus what was said to the whole platform. A public post is
    // addressed to everybody, and "everybody" includes somebody who has joined
    // three places.
    includePublic: true,
  });
}

/**
 * Everything anybody may read, newest first.
 *
 * This used to read the twenty-four busiest places and pass their ids as an
 * `in` list, which was two mistakes wearing one name. It could not see a post
 * that belongs to no place at all, which is now the ordinary way to write
 * something here. And it silently cut the feed off at place twenty-five, so a
 * post in the twenty-sixth busiest place existed, was public, was allowed by
 * policy, and simply never appeared: the screen said "nothing has been said"
 * about rooms it had not looked in.
 *
 * There is no list now. `posts_select` is the filter, and it is a better one
 * than any list this function could build: LIVE, in an ACTIVE or PAUSED place
 * or in no place at all, not from somebody who blocked you, plus your own held
 * posts. That is precisely "everything this person may read", it is enforced by
 * the database rather than by this file remembering to, and it is what makes
 * the read safe signed out.
 */
export async function getEverywhereFeed(cursor?: string): Promise<FeedPage> {
  if (!isSupabaseConfigured()) return EMPTY_PAGE;
  const { supabase, viewerId } = await feedClient();
  return readFeedPage(supabase, viewerId, null, { cursor, muteAreas: true });
}

/**
 * FRIENDS: what the people this member follows have written, newest first.
 *
 * The second half of the feed's For you / Friends pair. The follows are read
 * back through the viewer's own client (`follows_select` is public, and a
 * `userId` that is not the signed-in person returns nothing), then the same
 * read as every other timeline runs over those authors, so `posts_select`
 * still decides what may be seen and a person who blocked you is still absent.
 * A person's own posts are not mixed in: this is the people you follow.
 *
 * Capped at the same 200 follows a timeline `in` list can carry; somebody who
 * follows more than that reads their newest 200 follows, not an error.
 */
export async function getFriendsFeed(userId: string, cursor?: string): Promise<FeedPage> {
  if (!isSupabaseConfigured()) return EMPTY_PAGE;
  const { supabase, viewerId } = await feedClient();
  if (!viewerId || viewerId !== userId) return EMPTY_PAGE;

  const { data, error } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return FAILED_PAGE;

  const authorIds = (data as { followee_id: string }[])
    .map((row) => row.followee_id)
    .filter((id): id is string => Boolean(id));

  return readFeedPage(supabase, viewerId, null, { cursor, muteAreas: true, authorIds });
}

export type ThreadReply = PostView & {
  depth: number;
  /**
   * The row this one hangs off, which the thread view needs for one reason: a
   * reply to something already at the depth cap has to attach to the parent
   * instead, because `private.place_post` refuses anything deeper. Without it
   * the deepest comment in every conversation carried a reply control that
   * could only ever produce an error.
   */
  parentId: string | null;
  /**
   * The viewer muted this reply's author.
   *
   * The row is still returned rather than filtered out, and that is the whole
   * design: dropping it would leave the replies underneath it hanging off a
   * parent that is not there, and a mute is not a reason to delete other
   * people's words from somebody's screen. The thread renders one collapsed
   * line with a way to read it anyway.
   */
  mutedAuthor: boolean;
};

export type Thread = {
  root: PostView;
  replies: ThreadReply[];
};

/**
 * One post and everything under it.
 *
 * Read in one query on root_id rather than walking the tree, which is exactly
 * what root_id is denormalised for. Depth is capped at three by trigger, so the
 * whole thread is bounded and there is no pagination to design here yet.
 */
export async function getThread(postId: string): Promise<Thread | null> {
  if (!isSupabaseConfigured()) return null;

  const session = await resolveSession();
  const supabase = session.state === "signed-in" ? session.supabase : await createClient();
  const viewerId = session.state === "signed-in" ? session.user.id : null;

  const { data: rootRow, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .maybeSingle();
  if (error || !rootRow) return null;

  const root = rootRow as unknown as RawPost;
  // Opening a reply shows its whole thread from the top, so the answer always
  // arrives with the question rather than on its own.
  const rootId = root.root_id ?? root.id;

  const [topRes, repliesRes] = await Promise.all([
    rootId === root.id
      ? Promise.resolve({ data: rootRow })
      : supabase.from("posts").select(POST_COLUMNS).eq("id", rootId).maybeSingle(),
    supabase
      .from("posts")
      .select(POST_COLUMNS)
      .eq("root_id", rootId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  const top = (topRes.data ?? rootRow) as unknown as RawPost;
  /*
   * The one place a deleted post may still show, and only as a tombstone:
   * inside this conversation, while a reply that is still there hangs off it.
   * A deleted reply nobody answered goes; a deleted root with nothing left
   * under it is not a conversation, so the page reads as not found.
   */
  const replyRows = pruneDeleted(
    (repliesRes.data ?? []) as unknown as RawPost[],
    (row) => ({ id: row.id, parentId: row.parent_id, deleted: row.status === DELETED_STATUS }),
  );
  if (conversationIsGone(top.status === DELETED_STATUS, replyRows.length)) return null;

  const [e, muted] = await Promise.all([
    enrich(supabase, [top, ...replyRows], viewerId),
    readMutes(supabase, viewerId),
  ]);
  const byId = new Map(replyRows.map((r) => [r.id, r]));

  return {
    root: toView(top, e, viewerId),
    replies: replyRows.map((row) => {
      const view = toView(row, e, viewerId);
      const parent = row.parent_id ? byId.get(row.parent_id) : null;
      const parentAuthor = parent?.author_id ? e.authors.get(parent.author_id) : null;
      return {
        ...view,
        // Only say who a reply answers when it is not the obvious one. Every
        // reply saying "replying to the person above" is noise.
        replyingTo:
          parent && parent.id !== top.id
            ? parentAuthor?.handle
              ? `@${parentAuthor.handle}`
              : parent.author_kind === "BOT"
                ? "Vallo AI"
                : null
            : null,
        depth: row.depth,
        /* Carried so the thread view can retarget a reply that would land
           deeper than the trigger allows. See `replyTargetOf` in ThreadView. */
        parentId: row.parent_id,
        mutedAuthor: Boolean(
          muted.posts.has(row.id) || (row.author_id && muted.users.has(row.author_id)),
        ),
      };
    }),
  };
}

const PROFILE_LIMIT = 40;

/**
 * The three reads behind a profile's tabs.
 *
 * They are three functions rather than one with a mode, because each has a
 * different `where` and a different shape of answer, and a single function with
 * a switch would hide that a Replies row needs a parent lookup a Posts row does
 * not. What they share is the client, the enrichment and the view mapping, so
 * a change to how a card reads lands on all three at once.
 *
 * Every one goes through the caller's own RLS-bound client, so somebody's page
 * shows a stranger exactly what `posts_select` allows a stranger to see, and
 * shows the person themselves their own held posts, without either rule being
 * written here.
 */
async function profileClient() {
  const session = await resolveSession();
  const supabase = session.state === "signed-in" ? session.supabase : await createClient();
  const viewerId = session.state === "signed-in" ? session.user.id : null;
  return { supabase, viewerId };
}

/** Somebody's own posts, for their profile. Roots only, as the timeline is. */
export async function getProfileFeed(userId: string): Promise<PostView[]> {
  if (!isSupabaseConfigured()) return [];

  const { supabase, viewerId } = await profileClient();

  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("author_id", userId)
    /* Deleted is gone, and never a tombstone on a profile (founder, item 4). */
    .neq("status", DELETED_STATUS)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(PROFILE_LIMIT);

  if (error || !data) return [];
  const rows = data as unknown as RawPost[];
  if (rows.length === 0) return [];

  const e = await enrich(supabase, rows, viewerId);
  return rows.map((row) => toView(row, e, viewerId));
}

/**
 * Somebody's replies.
 *
 * Each one carries who it answers, because a reply shown away from its thread
 * is half a sentence. The parents are read in one extra query for the whole
 * page, not one per row, and a parent that the viewer may not see comes back
 * missing rather than as an error: `posts_select` refuses it, the reply still
 * renders, and the line above it simply says nothing rather than naming
 * somebody this viewer is not allowed to know about.
 */
export async function getProfileReplies(userId: string): Promise<PostView[]> {
  if (!isSupabaseConfigured()) return [];

  const { supabase, viewerId } = await profileClient();

  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("author_id", userId)
    .neq("status", DELETED_STATUS)
    .not("parent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(PROFILE_LIMIT);

  if (error || !data) return [];
  const rows = data as unknown as RawPost[];
  if (rows.length === 0) return [];

  const parentIds = [...new Set(rows.map((r) => r.parent_id).filter((v): v is string => Boolean(v)))];
  const { data: parents } = parentIds.length
    ? await supabase.from("posts").select("id, author_id, author_kind").in("id", parentIds)
    : { data: [] as never[] };

  const parentRows = (parents ?? []) as { id: string; author_id: string | null; author_kind: string }[];
  const parentById = new Map(parentRows.map((p) => [p.id, p]));

  /* One more lookup for the parents' handles. The page's own enrichment covers
     the reply authors, which on a profile is one person, and says nothing about
     the people being answered. */
  const parentAuthorIds = [
    ...new Set(parentRows.map((p) => p.author_id).filter((v): v is string => Boolean(v))),
  ];
  const { data: parentProfiles } = parentAuthorIds.length
    ? await supabase.from("social_profiles").select("user_id, handle").in("user_id", parentAuthorIds)
    : { data: [] as never[] };
  const handleById = new Map(
    ((parentProfiles ?? []) as { user_id: string; handle: string | null }[]).map((p) => [
      p.user_id,
      p.handle,
    ]),
  );

  const e = await enrich(supabase, rows, viewerId);

  return rows.map((row) => {
    const parent = row.parent_id ? parentById.get(row.parent_id) : null;
    const handle = parent?.author_id ? handleById.get(parent.author_id) : null;
    return {
      ...toView(row, e, viewerId),
      replyingTo: handle
        ? `@${handle}`
        : parent?.author_kind === "BOT"
          ? "Vallo AI"
          : null,
    };
  });
}

/**
 * Somebody's posts that carry a picture.
 *
 * `post_media!inner` makes the join do the filtering, so a post with no media
 * never comes back at all. Doing it the other way round, reading `post_media`
 * first and then the posts, would need a second query and would still have to
 * pass `posts_select`, which is where the answer has to come from anyway.
 *
 * Replies are included here, unlike the Posts tab. A picture is a picture
 * wherever somebody put it, and a media grid that silently drops the ones
 * posted inside a conversation would be missing most of them.
 */
export async function getProfileMedia(userId: string): Promise<PostView[]> {
  if (!isSupabaseConfigured()) return [];

  const { supabase, viewerId } = await profileClient();

  const { data, error } = await supabase
    .from("posts")
    .select(`${POST_COLUMNS}, post_media!inner(id)`)
    .eq("author_id", userId)
    .neq("status", DELETED_STATUS)
    .order("created_at", { ascending: false })
    .limit(PROFILE_LIMIT);

  if (error || !data) return [];
  const rows = data as unknown as RawPost[];
  if (rows.length === 0) return [];

  const e = await enrich(supabase, rows, viewerId);
  return rows.map((row) => toView(row, e, viewerId));
}

/* ----------------------------------------------------------------- Activity */

export type ActivityEntry = {
  kind: "LIKE" | "REPOST";
  post: PostView;
};

/**
 * What somebody has been doing, rather than what they wrote.
 *
 * Likes and reposts, newest first, because those are the two the database
 * publishes: `post_reactions_select` exposes `LIKE` rows and keeps every other
 * mark private to its author, and `post_reposts_select` is public outright.
 * Saves are deliberately absent and always will be, because a save is private
 * to the person who made it and a profile is not the place to leak it.
 *
 * This lives beside the feed reads rather than with the other tab reads because
 * it needs `enrich` and `toView`, and a second copy of "what a card looks like"
 * is exactly the drift those two exist to prevent.
 */
export async function getProfileActivity(userId: string): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const { supabase, viewerId } = await profileClient();

  const [likes, reposts] = await Promise.all([
    supabase
      .from("post_reactions")
      .select("post_id, created_at")
      .eq("user_id", userId)
      .eq("mark", "LIKE")
      .order("created_at", { ascending: false })
      .limit(PROFILE_LIMIT),
    supabase
      .from("post_reposts")
      .select("post_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(PROFILE_LIMIT),
  ]);

  const entries = [
    ...((likes.data ?? []) as { post_id: string; created_at: string }[]).map((row) => ({
      kind: "LIKE" as const,
      postId: row.post_id,
      at: row.created_at,
    })),
    ...((reposts.data ?? []) as { post_id: string; created_at: string }[]).map((row) => ({
      kind: "REPOST" as const,
      postId: row.post_id,
      at: row.created_at,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, PROFILE_LIMIT);

  if (entries.length === 0) return [];

  const [{ data }, muted] = await Promise.all([
    supabase
      .from("posts")
      .select(POST_COLUMNS)
      .in("id", [...new Set(entries.map((entry) => entry.postId))])
      /* A like on a post that has since been deleted is not activity worth
         showing: the post is gone, so the entry goes with it. */
      .neq("status", DELETED_STATUS),
    readMutes(supabase, viewerId),
  ]);

  /* Activity is other people's posts surfaced on a third person's page, so a
     mute belongs here for the same reason it belongs on a feed: the reader said
     they did not want to read this author, and whose page it appears on does not
     change that. The muted person's OWN page is the one place it does not apply,
     because going there is a deliberate act. */
  const rows = ((data ?? []) as unknown as RawPost[]).filter(
    (row) => !muted.posts.has(row.id) && !(row.author_id && muted.users.has(row.author_id)),
  );
  if (rows.length === 0) return [];

  const e = await enrich(supabase, rows, viewerId);
  const byId = new Map(rows.map((row) => [row.id, toView(row, e, viewerId)]));

  /* Put back in the order the activity happened, not the order the rows came
     back. A post the viewer may not see drops out entirely: `posts_select`
     refuses it, and an entry with nothing to point at is not an entry. */
  return entries
    .map((entry) => {
      const post = byId.get(entry.postId);
      return post ? { kind: entry.kind, post } : null;
    })
    .filter((entry): entry is ActivityEntry => entry !== null);
}
