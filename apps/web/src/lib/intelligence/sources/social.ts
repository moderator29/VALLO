import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readFollowSuggestions } from "@/lib/social/follow-suggestions";
import { isSocialEnabled } from "@/lib/social/flag";
import { readPersonBadges } from "@/lib/trust/badge-tier";
import type { IntelligenceResult, ResultAction } from "../contract";
import { placeFromLabel } from "../places";
import { compact, safePattern } from "./format";
import type { Source, SourceContext } from "./types";

/**
 * PEOPLE, COMMUNITIES AND POSTS: AROUND AND CIRCLE.
 *
 * Signed in only, like the Find people page and the feed they come from
 * (`/around` is not a public segment), and only while Around is switched on
 * (`isSocialEnabled`, the platform's kill switch, failing open like it).
 *
 * Every read is the member's OWN client, so RLS applies the rules the product
 * already has: `social_profiles_select` removes anybody a block touches in
 * either direction, `posts_select` removes blocked authors, private
 * communities and held or removed posts. Because an admin's own session can
 * see more than a member's, every read ALSO states the public predicate
 * itself (live posts, live public communities), so the console role never
 * widens what this search shows.
 *
 * People: the same two ways in as Find people (`lib/social/people-queries`),
 * a handle or a name, and never occupation or place (V-64). With no name
 * typed, the "People to follow" list (`social_follow_suggestions`).
 */

type Db = SupabaseClient;

function dbOf(ctx: SourceContext): Db | null {
  return ctx.viewer.signedIn && ctx.viewer.db ? (ctx.viewer.db as Db) : null;
}

function socialApplies(kinds: string[]) {
  return ({ understood, viewer }: Parameters<Source["applies"]>[0]) =>
    viewer.signedIn && (kinds.includes(understood.kind ?? "") || ((understood.kind === undefined || understood.kind === "place") && Boolean(understood.text)));
}

/* ------------------------------------------------------------------ people */

type ProfileRow = {
  user_id: string;
  handle: string;
  display_label: string | null;
  avatar_path: string | null;
  is_agent: boolean | null;
  supply_role: string | null;
  follower_count: number | null;
};

const PROFILE_COLUMNS = "user_id, handle, display_label, avatar_path, is_agent, supply_role, follower_count";

function roleOf(row: Pick<ProfileRow, "is_agent" | "supply_role">): string | undefined {
  if (row.supply_role === "owner") return "Landlord";
  if (row.supply_role === "agent" || row.is_agent) return "Agent";
  return undefined;
}

export function personResult(
  row: ProfileRow,
  extra: { verified: boolean; following: boolean; isYou: boolean; signedIn: boolean },
): IntelligenceResult {
  const href = `/u/${encodeURIComponent(row.handle)}`;
  const actions: ResultAction[] = [{ id: "view-profile", label: "View profile", href }];
  if (extra.signedIn && !extra.isYou && !extra.following) actions.push({ id: "follow", label: "Follow" });
  const role = roleOf(row);
  return compact({
    key: `person:${row.user_id}`,
    kind: "person",
    title: row.display_label?.trim() || `@${row.handle}`,
    href,
    subtitle: [`@${row.handle}`, role].filter(Boolean).join(" · "),
    imageUrl: row.avatar_path || undefined,
    verified: extra.verified,
    count: typeof row.follower_count === "number" ? { value: row.follower_count, noun: "followers" } : undefined,
    actions,
    person: { handle: row.handle, ...(role ? { role } : {}), following: extra.following, isYou: extra.isYou },
  });
}

async function decorate(db: Db, rows: ProfileRow[], viewerId: string | null): Promise<IntelligenceResult[]> {
  const ids = rows.map((r) => r.user_id);
  const [tiers, following] = await Promise.all([
    readPersonBadges(db, ids).catch(() => new Map()),
    (async () => {
      const set = new Set<string>();
      if (!viewerId || ids.length === 0) return set;
      const { data } = await db.from("follows").select("followee_id").eq("follower_id", viewerId).in("followee_id", ids);
      for (const row of (data ?? []) as { followee_id: string }[]) set.add(row.followee_id);
      return set;
    })().catch(() => new Set<string>()),
  ]);
  return rows.map((row) =>
    personResult(row, {
      verified: (tiers.get(row.user_id) ?? "none") !== "none",
      following: following.has(row.user_id),
      isYou: row.user_id === viewerId,
      signedIn: Boolean(viewerId),
    }),
  );
}

/** People to follow: the platform's suggestions, never the viewer. Shared with discover. */
export async function peopleToFollow(db: Db, viewerId: string | null, city: string | null, limit: number): Promise<IntelligenceResult[]> {
  let suggested = await readFollowSuggestions({ city, limit: limit + 1 });
  if (suggested.state === "ready" && suggested.people.length === 0 && city) suggested = await readFollowSuggestions({ city: null, limit: limit + 1 });
  if (suggested.state !== "ready") return [];
  const handles = suggested.people.filter((p) => p.userId !== viewerId).map((p) => p.handle).slice(0, limit);
  if (handles.length === 0) return [];
  const { data, error } = await db.from("social_profiles").select(PROFILE_COLUMNS).in("handle", handles);
  if (error || !data) return [];
  const byHandle = new Map((data as ProfileRow[]).map((r) => [r.handle, r]));
  const rows = handles.map((h) => byHandle.get(h)).filter((r): r is ProfileRow => Boolean(r) && r!.user_id !== viewerId);
  return decorate(db, rows, viewerId);
}

export const personSource: Source = {
  kind: "person",
  applies: socialApplies(["person"]),
  async run(ctx) {
    const db = dbOf(ctx);
    if (!db || !(await isSocialEnabled())) return { results: [] };
    const words = (ctx.understood.text ?? "").replace(/^@+/, "");
    const pattern = safePattern(words);
    if (pattern.length < 2) {
      if (ctx.understood.kind !== "person") return { results: [] };
      const people = await peopleToFollow(db, ctx.viewer.userId, placeFromLabel(ctx.understood.place)?.city ?? null, ctx.limit);
      return { results: people, more: "/around/people" };
    }
    const { data, error } = await db
      .from("social_profiles")
      .select(PROFILE_COLUMNS)
      .or(`handle.ilike.%${pattern}%,display_label.ilike.%${pattern}%`)
      .order("follower_count", { ascending: false, nullsFirst: false })
      .range(ctx.offset, ctx.offset + ctx.limit);
    if (error) throw new Error("people read failed");
    const rows = (data ?? []) as ProfileRow[];
    const q = pattern.toLowerCase();
    const rank = (r: ProfileRow) => (r.handle === q ? 0 : r.handle.startsWith(q) ? 1 : (r.display_label ?? "").toLowerCase().startsWith(q) ? 2 : 3);
    rows.sort((a, b) => rank(a) - rank(b));
    const page = rows.slice(0, ctx.limit);
    return {
      results: await decorate(db, page, ctx.viewer.userId),
      total: ctx.offset === 0 && rows.length <= ctx.limit ? rows.length : undefined,
      more: `/around/people?q=${encodeURIComponent(words.slice(0, 40))}`,
    };
  },
};

/* ------------------------------------------------------------------ communities */

type CommunityRow = { id: string; slug: string; name: string; description: string | null; category: string | null; member_count: number | null; cover_path: string | null };

export const communitySource: Source = {
  kind: "community",
  applies: socialApplies(["community"]),
  async run(ctx) {
    const db = dbOf(ctx);
    if (!db || !(await isSocialEnabled())) return { results: [] };
    const pattern = safePattern(ctx.understood.text ?? "");
    let read = db
      .from("circle_communities")
      .select("id, slug, name, description, category, member_count, cover_path")
      .eq("status", "live")
      .eq("visibility", "public");
    if (pattern.length >= 2) read = read.or(`name.ilike.%${pattern}%,description.ilike.%${pattern}%,category.ilike.%${pattern}%`);
    else if (ctx.understood.kind !== "community") return { results: [] };
    const { data, error } = await read.order("member_count", { ascending: false, nullsFirst: false }).range(ctx.offset, ctx.offset + ctx.limit);
    if (error) throw new Error("community read failed");
    const rows = (data ?? []) as CommunityRow[];
    return {
      results: rows.slice(0, ctx.limit).map((c) =>
        compact({
          key: `community:${c.id}`,
          kind: "community",
          title: c.name,
          href: `/circle/c/${encodeURIComponent(c.slug)}`,
          subtitle: c.category ?? undefined,
          count: typeof c.member_count === "number" ? { value: c.member_count, noun: "members" } : undefined,
          actions: [{ id: "open", label: "Open", href: `/circle/c/${encodeURIComponent(c.slug)}` }],
        }),
      ),
      total: ctx.offset === 0 && rows.length <= ctx.limit ? rows.length : undefined,
      more: "/circle",
    };
  },
};

/* ------------------------------------------------------------------ posts */

type PostRow = {
  id: string;
  title: string | null;
  body: string | null;
  community_id: string | null;
  area_id: string | null;
  reply_count: number | null;
  created_at: string;
};

export const postSource: Source = {
  kind: "post",
  applies: socialApplies(["post", "community"]),
  async run(ctx) {
    const db = dbOf(ctx);
    if (!db || !(await isSocialEnabled())) return { results: [] };
    const pattern = safePattern(ctx.understood.text ?? "");
    if (pattern.length < 3) return { results: [] };
    const { data, error } = await db
      .from("posts")
      .select("id, title, body, community_id, area_id, reply_count, created_at")
      .eq("status", "LIVE")
      .eq("depth", 0)
      .neq("kind", "REPLY")
      .or(`title.ilike.%${pattern}%,body.ilike.%${pattern}%`)
      .order("created_at", { ascending: false })
      .range(ctx.offset, ctx.offset + ctx.limit * 2);
    if (error) throw new Error("post read failed");
    let rows = (data ?? []) as PostRow[];

    /* The public predicate, stated here as well as in RLS: a post in a
       community shows only when that community is live and public, and a post
       in an area only when the area is open. */
    const communityIds = [...new Set(rows.map((r) => r.community_id).filter((x): x is string => Boolean(x)))];
    const areaIds = [...new Set(rows.map((r) => r.area_id).filter((x): x is string => Boolean(x)))];
    const [communities, areas] = await Promise.all([
      communityIds.length
        ? db.from("circle_communities").select("id, name").eq("status", "live").eq("visibility", "public").in("id", communityIds)
        : Promise.resolve({ data: [], error: null }),
      areaIds.length ? db.from("areas").select("id, status").in("id", areaIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const openCommunity = new Map(((communities.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
    const openArea = new Set(((areas.data ?? []) as { id: string; status: string }[]).filter((a) => a.status === "ACTIVE" || a.status === "PAUSED").map((a) => a.id));
    rows = rows.filter((r) => (r.community_id ? openCommunity.has(r.community_id) : true) && (r.area_id ? openArea.has(r.area_id) : true));

    return {
      results: rows.slice(0, ctx.limit).map((p) => {
        const href = p.community_id ? `/circle/p/${p.id}` : `/post/${p.id}`;
        const text = (p.title?.trim() || p.body?.trim() || "").replace(/\s+/g, " ");
        return compact({
          key: `post:${p.id}`,
          kind: "post",
          title: text.length > 90 ? `${text.slice(0, 89).trimEnd()}…` : text,
          href,
          subtitle: p.community_id ? openCommunity.get(p.community_id) : "Around",
          count: typeof p.reply_count === "number" && p.reply_count > 0 ? { value: p.reply_count, noun: "replies" } : undefined,
          actions: [{ id: "open", label: "Open", href }],
        });
      }),
      more: "/around",
    };
  },
};
