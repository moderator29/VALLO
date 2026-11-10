import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { faults, isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";

import { isKind, isStatus, type ContentItem } from "./model";

export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "error" };

type Row = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  body: string | null;
  status: string;
  planned_for: string | null;
  owner_id: string | null;
  approver_id: string | null;
  approved_at: string | null;
  review_note: string | null;
  link_url: string | null;
  published_url: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const ITEM_SELECT =
  "id, kind, title, summary, body, status, planned_for, owner_id, approver_id, approved_at, review_note, link_url, published_url, published_at, created_by, created_at, updated_at";

export function itemFromRow(r: Row): ContentItem {
  return {
    id: r.id,
    kind: isKind(r.kind) ? r.kind : "other",
    title: r.title,
    summary: r.summary ?? "",
    body: r.body ?? "",
    status: isStatus(r.status) ? r.status : "draft",
    plannedFor: r.planned_for,
    ownerId: r.owner_id,
    approverId: r.approver_id,
    approvedAt: r.approved_at,
    reviewNote: r.review_note,
    linkUrl: r.link_url,
    publishedUrl: r.published_url,
    publishedAt: r.published_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function readContentItems(db: SupabaseClient): Promise<DeskRead<ContentItem[]>> {
  const { data, error } = await db.from("content_items").select(ITEM_SELECT).order("created_at", { ascending: false }).limit(1000);
  if (error) {
    if (isNotLive(error)) return { state: "not-open" };
    await reportReadFault("read.admin.content.items", ...faults(error));
    return { state: "error" };
  }
  return { state: "ok", data: ((data ?? []) as unknown as Row[]).map(itemFromRow) };
}

/**
 * THE FEED MODERATION COUNTS THE CONTENT DESK SHOWS (read only). The Content
 * Manager does not hold the moderation scope and cannot open the queue, so
 * these are counts and nothing else: no post, no name, no reason. Each one is
 * read on its own and is `null` when it could not be read, so the desk says
 * "not available" for it and never draws a zero. The links beside them open
 * for people who hold moderation access.
 */
export type FeedModeration = {
  openReports: number | null;
  heldPosts: number | null;
  heldStories: number | null;
  heldComments: number | null;
  openFeedCases: number | null;
  openCircleCases: number | null;
};

export async function readFeedModeration(db: SupabaseClient): Promise<FeedModeration> {
  const head = async (kind: `read.${string}`, query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> => {
    const { count, error } = await query;
    if (error) {
      if (!isNotLive(error)) await reportReadFault(kind, ...faults(error));
      return null;
    }
    return count ?? 0;
  };
  const count = { count: "exact", head: true } as const;
  const [openReports, heldPosts, heldStories, heldComments, openFeedCases, openCircleCases] = await Promise.all([
    head("read.admin.content.reports", db.from("reports").select("id", count).in("status", ["open", "reviewing"]) as never),
    head("read.admin.content.held_posts", db.from("posts").select("id", count).eq("status", "HELD") as never),
    head("read.admin.content.held_stories", db.from("stories").select("id", count).eq("status", "HELD") as never),
    head("read.admin.content.held_comments", db.from("story_comments").select("id", count).eq("status", "HELD") as never),
    head("read.admin.content.feed_cases", db.from("moderation_cases").select("id", count).eq("module", "feed").not("status", "in", "(resolved,closed)") as never),
    head("read.admin.content.circle_cases", db.from("moderation_cases").select("id", count).eq("module", "circle").not("status", "in", "(resolved,closed)") as never),
  ]);
  return { openReports, heldPosts, heldStories, heldComments, openFeedCases, openCircleCases };
}
