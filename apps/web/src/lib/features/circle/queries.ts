import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSessionClaims } from "@/lib/actions/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { reportReadFault } from "@/lib/observability/read-error";

import { faults, isNotLive } from "../degrade";
import {
  PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  type CircleCategory,
  type CircleSort,
  type CircleType,
} from "./model";

/**
 * VALLO CIRCLE, THE READS.
 *
 * Everything goes through the viewer's own client, so RLS decides what a
 * private community shows (`posts_select` with `private.can_see_community`).
 * Nothing is invented: an absent table (the SQL not live yet) reads as
 * `live: false` and every list as empty, never as a sample.
 *
 * One page is 20 rows on a keyset cursor (created_at, id), never an offset.
 */

type Db = SupabaseClient;

export type Viewer = { id: string | null; db: Db };

async function viewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured()) return null;
  const claims = await resolveSessionClaims();
  if (claims.state === "signed-in") return { id: claims.userId, db: claims.supabase as unknown as Db };
  return { id: null, db: (await createClient()) as unknown as Db };
}

/* ------------------------------------------------------------------ shapes */

export type CircleAuthor = {
  id: string;
  handle: string | null;
  label: string;
  avatar: string | null;
  isAgent: boolean;
  verified: boolean;
};

export type CommunityView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: CircleCategory;
  visibility: "public" | "private";
  rules: string[];
  byVallo: boolean;
  members: number;
  posts: number;
  areaId: string | null;
  lastActivityAt: string | null;
};

export type CirclePostView = {
  id: string;
  title: string;
  body: string;
  type: CircleType;
  createdAt: string;
  editedAt: string | null;
  answers: number;
  likes: number;
  helpful: number;
  author: CircleAuthor | null;
  community: { slug: string; name: string } | null;
  listingId: string | null;
  answered: boolean;
};

export type ReplyView = {
  id: string;
  parentId: string | null;
  depth: number;
  body: string;
  createdAt: string;
  helpful: number;
  author: CircleAuthor | null;
  isMine: boolean;
  markedHelpful: boolean;
};

export type MembershipView = { role: "owner" | "moderator" | "member"; status: "active" | "requested" } | null;

export type HomeStats = { members: number; posts: number; active: number; communities: number };

/* ----------------------------------------------------------------- helpers */

const COMMUNITY_COLUMNS =
  "id, slug, name, description, category, visibility, rules, started_by_vallo, member_count, post_count, area_id, last_activity_at";

const POST_COLUMNS =
  "id, title, body, circle_type, created_at, edited_at, reply_count, like_count, helpful_count, author_id, community_id, listing_id";

type RawCommunity = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: CircleCategory;
  visibility: "public" | "private";
  rules: string[] | null;
  started_by_vallo: boolean | null;
  member_count: number | null;
  post_count: number | null;
  area_id: string | null;
  last_activity_at: string | null;
};

function toCommunity(row: RawCommunity): CommunityView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    visibility: row.visibility,
    rules: Array.isArray(row.rules) ? row.rules : [],
    byVallo: Boolean(row.started_by_vallo),
    members: Number(row.member_count ?? 0),
    posts: Number(row.post_count ?? 0),
    areaId: row.area_id,
    lastActivityAt: row.last_activity_at,
  };
}

type RawPost = {
  id: string;
  title: string | null;
  body: string | null;
  circle_type: CircleType | null;
  created_at: string;
  edited_at: string | null;
  reply_count: number | null;
  like_count: number | null;
  helpful_count: number | null;
  author_id: string | null;
  community_id: string | null;
  listing_id: string | null;
};

/** Authors, communities and accepted marks for a page of posts, in three reads. */
async function enrich(db: Db, rows: RawPost[]): Promise<CirclePostView[]> {
  if (rows.length === 0) return [];
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter((v): v is string => Boolean(v)))];
  const communityIds = [...new Set(rows.map((r) => r.community_id).filter((v): v is string => Boolean(v)))];
  const questionIds = rows.filter((r) => r.circle_type === "question").map((r) => r.id);
  const [authors, communities, accepted] = await Promise.all([
    readAuthors(db, authorIds),
    communityIds.length
      ? db.from("circle_communities").select("id, slug, name").in("id", communityIds)
      : Promise.resolve({ data: [], error: null }),
    questionIds.length
      ? db.from("circle_accepted_answers").select("question_id").in("question_id", questionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  await reportReadFault("read.circle.enrich", ...faults(communities.error, accepted.error));
  const byCommunity = new Map(((communities.data ?? []) as { id: string; slug: string; name: string }[]).map((c) => [c.id, c]));
  const answered = new Set(((accepted.data ?? []) as { question_id: string }[]).map((a) => a.question_id));
  return rows.map((r) => {
    const c = r.community_id ? byCommunity.get(r.community_id) : undefined;
    return {
      id: r.id,
      title: r.title ?? "",
      body: r.body ?? "",
      type: r.circle_type ?? "discussion",
      createdAt: r.created_at,
      editedAt: r.edited_at,
      answers: Number(r.reply_count ?? 0),
      likes: Number(r.like_count ?? 0),
      helpful: Number(r.helpful_count ?? 0),
      author: r.author_id ? (authors.get(r.author_id) ?? null) : null,
      community: c ? { slug: c.slug, name: c.name } : null,
      listingId: r.listing_id,
      answered: answered.has(r.id),
    };
  });
}

async function readAuthors(db: Db, ids: string[]): Promise<Map<string, CircleAuthor>> {
  const out = new Map<string, CircleAuthor>();
  if (ids.length === 0) return out;
  const [profiles, agents] = await Promise.all([
    db.from("social_profiles").select("user_id, handle, display_label, avatar_path, is_agent").in("user_id", ids),
    db.from("agents").select("user_id, verified").in("user_id", ids).eq("verified", true),
  ]);
  await reportReadFault("read.circle.authors", ...faults(profiles.error, agents.error));
  const verified = new Set(((agents.data ?? []) as { user_id: string }[]).map((a) => a.user_id));
  for (const p of (profiles.data ?? []) as {
    user_id: string;
    handle: string | null;
    display_label: string | null;
    avatar_path: string | null;
    is_agent: boolean | null;
  }[]) {
    out.set(p.user_id, {
      id: p.user_id,
      handle: p.handle,
      label: p.display_label?.trim() || (p.handle ? `@${p.handle}` : "Member"),
      avatar: p.avatar_path,
      isAgent: Boolean(p.is_agent),
      verified: verified.has(p.user_id),
    });
  }
  return out;
}

/* ------------------------------------------------------------------- reads */

export type CircleHome = {
  live: boolean;
  signedIn: boolean;
  stats: HomeStats | null;
  mine: CommunityView[];
  communities: CommunityView[];
  trending: CirclePostView[];
  questions: CirclePostView[];
};

const EMPTY_HOME: CircleHome = { live: false, signedIn: false, stats: null, mine: [], communities: [], trending: [], questions: [] };

/** The Circle home: the live counts, your communities, what to join, what people talk about. */
export async function readCircleHome(): Promise<CircleHome> {
  const v = await viewer();
  if (!v) return EMPTY_HOME;
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [stats, communities, trending, questions, mine] = await Promise.all([
    v.db.rpc("circle_home_stats"),
    v.db.from("circle_communities").select(COMMUNITY_COLUMNS).eq("status", "live").order("member_count", { ascending: false }).limit(12),
    v.db
      .from("posts")
      .select(POST_COLUMNS)
      .not("community_id", "is", null)
      .eq("depth", 0)
      .eq("status", "LIVE")
      .neq("circle_type", "question")
      .gte("created_at", since)
      .order("helpful_count", { ascending: false })
      .order("reply_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    v.db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("circle_type", "question")
      .eq("depth", 0)
      .eq("status", "LIVE")
      .order("reply_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    v.id
      ? v.db.from("circle_memberships").select("community_id").eq("user_id", v.id).eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
  ]);
  await reportReadFault("read.circle.home", ...faults(stats.error, communities.error, trending.error, questions.error, mine.error));
  if (isNotLive(stats.error) || isNotLive(communities.error)) return { ...EMPTY_HOME, signedIn: Boolean(v.id) };

  const row = Array.isArray(stats.data) ? (stats.data[0] as Record<string, unknown> | undefined) : undefined;
  const all = ((communities.data ?? []) as RawCommunity[]).map(toCommunity);
  const mineIds = new Set(((mine.data ?? []) as { community_id: string }[]).map((m) => m.community_id));
  return {
    live: true,
    signedIn: Boolean(v.id),
    stats: row
      ? {
          members: Number(row.members ?? 0),
          posts: Number(row.posts ?? 0),
          active: Number(row.active ?? 0),
          communities: Number(row.communities ?? 0),
        }
      : null,
    mine: all.filter((c) => mineIds.has(c.id)),
    communities: all.filter((c) => !mineIds.has(c.id)),
    trending: await enrich(v.db, (trending.data ?? []) as RawPost[]),
    questions: await enrich(v.db, (questions.data ?? []) as RawPost[]),
  };
}

export type PostPage = { live: boolean; posts: CirclePostView[]; next: string | null };

/** A tab's list or a community's list, one page. */
export async function readCirclePosts(input: {
  type?: CircleType | null;
  communityId?: string | null;
  sort: CircleSort;
  cursor?: string | null;
}): Promise<PostPage> {
  const v = await viewer();
  if (!v) return { live: false, posts: [], next: null };
  let q = v.db.from("posts").select(POST_COLUMNS).not("community_id", "is", null).eq("depth", 0).eq("status", "LIVE");
  if (input.type) q = q.eq("circle_type", input.type);
  if (input.communityId) q = q.eq("community_id", input.communityId);
  if (input.sort === "unanswered") q = q.eq("reply_count", 0);
  const cursor = input.sort === "popular" ? null : decodeCursor(input.cursor);
  if (cursor) q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  q =
    input.sort === "popular"
      ? q.order("helpful_count", { ascending: false }).order("reply_count", { ascending: false }).order("created_at", { ascending: false })
      : q.order("created_at", { ascending: false }).order("id", { ascending: false });
  const { data, error } = await q.limit(PAGE_SIZE + 1);
  await reportReadFault("read.circle.posts", ...faults(error));
  if (error) return { live: !isNotLive(error), posts: [], next: null };
  const rows = (data ?? []) as RawPost[];
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    live: true,
    posts: await enrich(v.db, page),
    next: rows.length > PAGE_SIZE && last && input.sort !== "popular" ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
  };
}

export async function readCommunities(category?: CircleCategory | null): Promise<{ live: boolean; communities: CommunityView[] }> {
  const v = await viewer();
  if (!v) return { live: false, communities: [] };
  let q = v.db.from("circle_communities").select(COMMUNITY_COLUMNS).eq("status", "live");
  if (category) q = q.eq("category", category);
  const { data, error } = await q.order("member_count", { ascending: false }).limit(60);
  await reportReadFault("read.circle.communities", ...faults(error));
  if (error) return { live: false, communities: [] };
  return { live: true, communities: ((data ?? []) as RawCommunity[]).map(toCommunity) };
}

export type CommunityPage = {
  community: CommunityView;
  membership: MembershipView;
  active: number;
  signedIn: boolean;
  viewerId: string | null;
};

export async function readCommunity(slug: string): Promise<CommunityPage | null> {
  const v = await viewer();
  if (!v || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const { data, error } = await v.db.from("circle_communities").select(COMMUNITY_COLUMNS).eq("slug", slug).maybeSingle();
  await reportReadFault("read.circle.community", ...faults(error));
  if (error || !data) return null;
  const community = toCommunity(data as RawCommunity);
  const [membership, active] = await Promise.all([
    v.id
      ? v.db.from("circle_memberships").select("role, status").eq("community_id", community.id).eq("user_id", v.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    v.db.rpc("circle_community_active", { p_ids: [community.id] }),
  ]);
  await reportReadFault("read.circle.community", ...faults(membership.error, active.error));
  const activeRow = Array.isArray(active.data) ? (active.data[0] as { active?: unknown } | undefined) : undefined;
  return {
    community,
    membership: (membership.data as MembershipView) ?? null,
    active: Number(activeRow?.active ?? 0),
    signedIn: Boolean(v.id),
    viewerId: v.id,
  };
}

export type JoinRequest = { userId: string; author: CircleAuthor | null; at: string };

export async function readJoinRequests(communityId: string): Promise<JoinRequest[]> {
  const v = await viewer();
  if (!v?.id) return [];
  const { data, error } = await v.db
    .from("circle_memberships")
    .select("user_id, joined_at")
    .eq("community_id", communityId)
    .eq("status", "requested")
    .order("joined_at", { ascending: true })
    .limit(100);
  await reportReadFault("read.circle.requests", ...faults(error));
  if (error) return [];
  const rows = (data ?? []) as { user_id: string; joined_at: string }[];
  const authors = await readAuthors(v.db, rows.map((r) => r.user_id));
  return rows.map((r) => ({ userId: r.user_id, author: authors.get(r.user_id) ?? null, at: r.joined_at }));
}

export type Thread = {
  post: CirclePostView;
  replies: ReplyView[];
  acceptedId: string | null;
  following: boolean;
  isAsker: boolean;
  canReply: boolean;
  signedIn: boolean;
};

export async function readThread(id: string): Promise<Thread | null> {
  const v = await viewer();
  if (!v || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await v.db.from("posts").select(POST_COLUMNS).eq("id", id).eq("depth", 0).maybeSingle();
  await reportReadFault("read.circle.thread", ...faults(error));
  if (error || !data || !(data as RawPost).community_id) return null;
  const [post] = await enrich(v.db, [data as RawPost]);
  if (!post) return null;

  const [replies, accepted, follow, membership] = await Promise.all([
    v.db
      .from("posts")
      .select("id, parent_id, depth, body, created_at, helpful_count, author_id, status")
      .eq("root_id", id)
      .eq("status", "LIVE")
      .order("created_at", { ascending: true })
      .limit(300),
    v.db.from("circle_accepted_answers").select("answer_id").eq("question_id", id).maybeSingle(),
    v.id
      ? v.db.from("circle_question_follows").select("question_id").eq("question_id", id).eq("user_id", v.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    v.id && (data as RawPost).community_id
      ? v.db
          .from("circle_memberships")
          .select("status")
          .eq("community_id", (data as RawPost).community_id as string)
          .eq("user_id", v.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  await reportReadFault("read.circle.thread", ...faults(replies.error, accepted.error, follow.error, membership.error));

  const rows = (replies.data ?? []) as {
    id: string;
    parent_id: string | null;
    depth: number;
    body: string | null;
    created_at: string;
    helpful_count: number | null;
    author_id: string | null;
  }[];
  const authors = await readAuthors(v.db, [...new Set(rows.map((r) => r.author_id).filter((x): x is string => Boolean(x)))]);
  const marks = v.id && rows.length
    ? await v.db.from("post_helpful").select("post_id").eq("user_id", v.id).in("post_id", rows.map((r) => r.id))
    : { data: [], error: null };
  await reportReadFault("read.circle.thread", ...faults(marks.error));
  const marked = new Set(((marks.data ?? []) as { post_id: string }[]).map((m) => m.post_id));
  const acceptedId = (accepted.data as { answer_id?: string } | null)?.answer_id ?? null;

  const views: ReplyView[] = rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    depth: r.depth,
    body: r.body ?? "",
    createdAt: r.created_at,
    helpful: Number(r.helpful_count ?? 0),
    author: r.author_id ? (authors.get(r.author_id) ?? null) : null,
    isMine: Boolean(v.id && r.author_id === v.id),
    markedHelpful: marked.has(r.id),
  }));
  /* The accepted answer first, then the most helpful, then the oldest. */
  views.sort((a, b) =>
    a.id === acceptedId ? -1 : b.id === acceptedId ? 1 : a.depth !== b.depth ? a.depth - b.depth : b.helpful - a.helpful || a.createdAt.localeCompare(b.createdAt),
  );

  return {
    post,
    replies: views,
    acceptedId,
    following: Boolean(follow.data),
    isAsker: Boolean(v.id && post.author?.id === v.id),
    canReply: (membership.data as { status?: string } | null)?.status === "active",
    signedIn: Boolean(v.id),
  };
}

export type NeighbourhoodView = { id: string; slug: string; name: string; kind: string; members: number; posts: number };

/** The Neighbourhoods tab: the live areas, as they are. */
export async function readNeighbourhoods(): Promise<NeighbourhoodView[]> {
  const v = await viewer();
  if (!v) return [];
  const { data, error } = await v.db
    .from("areas")
    .select("id, slug, name, kind, member_count, post_count")
    .eq("status", "ACTIVE")
    .order("member_count", { ascending: false })
    .limit(60);
  await reportReadFault("read.circle.neighbourhoods", ...faults(error));
  if (error) return [];
  return ((data ?? []) as { id: string; slug: string; name: string; kind: string; member_count: number | null; post_count: number | null }[]).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    kind: a.kind,
    members: Number(a.member_count ?? 0),
    posts: Number(a.post_count ?? 0),
  }));
}

export type ProfessionalView = { author: CircleAuthor; headline: string; kinds: string[]; years: number | null };

export async function readProfessionals(): Promise<ProfessionalView[]> {
  const v = await viewer();
  if (!v) return [];
  const { data, error } = await v.db
    .from("professional_profiles")
    .select("user_id, headline, kinds, years")
    .eq("listed", true)
    .order("updated_at", { ascending: false })
    .limit(40);
  await reportReadFault("read.circle.professionals", ...faults(error));
  if (error) return [];
  const rows = (data ?? []) as { user_id: string; headline: string; kinds: string[] | null; years: number | null }[];
  const authors = await readAuthors(v.db, rows.map((r) => r.user_id));
  return rows.flatMap((r) => {
    const author = authors.get(r.user_id);
    return author ? [{ author, headline: r.headline, kinds: r.kinds ?? [], years: r.years }] : [];
  });
}
