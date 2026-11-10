import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { faults, isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";

import {
  isCategory,
  isFormat,
  isPlatform,
  isSlot,
  isStatus,
  type SocialPost,
} from "./model";

export const MEDIA_BUCKET = "social-media-library";

export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "error" };

type Row = {
  id: string;
  platform: string;
  category: string;
  format: string;
  slot: string | null;
  campaign: string | null;
  caption: string;
  planned_at: string;
  status: string;
  media_urls: string[] | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  live_url: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(r: Row): SocialPost {
  return {
    id: r.id,
    platform: isPlatform(r.platform) ? r.platform : "other",
    category: isCategory(r.category) ? r.category : "other",
    format: isFormat(r.format) ? r.format : "other",
    slot: isSlot(r.slot) ? r.slot : null,
    campaign: r.campaign,
    caption: r.caption ?? "",
    plannedAt: r.planned_at,
    status: isStatus(r.status) ? r.status : "draft",
    mediaUrls: r.media_urls ?? [],
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    postedAt: r.posted_at,
    liveUrl: r.live_url,
    rejectionReason: r.rejection_reason,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT = "id, platform, category, format, slot, campaign, caption, planned_at, status, media_urls, approved_by, approved_at, posted_at, live_url, rejection_reason, created_by, created_at, updated_at";

/**
 * Every post the desk needs, read once and shaped on the server; the page
 * slices it into the week grid, the drafts list and the report. Capped at a
 * generous window so the desk stays fast once this has run for years: the
 * last 120 days plus everything still planned ahead.
 */
export async function readSocialPosts(db: SupabaseClient): Promise<DeskRead<SocialPost[]>> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 120);
  const sinceIso = since.toISOString().slice(0, 10);
  const { data, error } = await db
    .from("social_posts")
    .select(SELECT)
    .gte("planned_at", sinceIso)
    .order("planned_at", { ascending: true })
    .limit(2000);
  if (error) {
    await reportReadFault("read.admin.social-media.posts", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return { state: "ok", data: ((data ?? []) as unknown as Row[]).map(fromRow) };
}

export async function readSocialPost(db: SupabaseClient, id: string): Promise<DeskRead<SocialPost | null>> {
  const { data, error } = await db.from("social_posts").select(SELECT).eq("id", id).maybeSingle();
  if (error) {
    await reportReadFault("read.admin.social-media.post", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return { state: "ok", data: data ? fromRow(data as unknown as Row) : null };
}

export type MediaItem = { path: string; name: string; url: string | null; isVideo: boolean; createdAt: string | null };

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/**
 * The media library's contents. The bucket is private (no storage.objects
 * policy, like `identity-checks`), so a thumbnail is a short signed URL the
 * service client asks for itself, never a public link.
 */
export async function readMediaLibrary(db: SupabaseClient): Promise<DeskRead<MediaItem[]>> {
  const { data, error } = await db.storage.from(MEDIA_BUCKET).list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });
  if (error) {
    const message = (error as { message?: string } | null)?.message ?? "";
    if (/not found|bucket/i.test(message)) return { state: "not-open" };
    await reportReadFault("read.admin.social-media.media", error);
    return { state: "error" };
  }
  const files = (data ?? []).filter((f) => f.id !== null || f.name);
  const signed = await Promise.all(
    files.map(async (f) => {
      const { data: s } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(f.name, 600);
      return {
        path: f.name,
        name: f.name,
        url: s?.signedUrl ?? null,
        isVideo: VIDEO_EXT.test(f.name),
        createdAt: (f as { created_at?: string }).created_at ?? null,
      };
    }),
  );
  return { state: "ok", data: signed };
}
