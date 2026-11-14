"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { requireAdmin } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNotLive } from "@/lib/features/degrade";

import {
  isCategory,
  isFormat,
  isPlatform,
  isSlot,
  type Category,
  type Format,
  type Platform,
  type Slot,
} from "./model";
import { MEDIA_BUCKET } from "./queries";

/**
 * THE SOCIAL MEDIA DESK'S WRITES. No platform API, no OAuth, no credential:
 * every action here only reads and writes `public.social_posts` and the
 * private `social-media-library` storage bucket. Posting itself happens by
 * hand, on the real platform, outside this app; `markPosted` only records
 * that it happened.
 *
 * `requireAdmin("social_media")` hands a holder of the scope the service
 * client once the database has already checked the scope and the handbook,
 * so every write below runs on that client, exactly like the other scoped
 * desks (`lib/admin/cases/actions.ts`).
 */

const NOT_OPEN = "The social media table is not set up on this server yet. Ask the lead to apply the pending migration.";
const FAILED = "That did not go through. Try again.";
const PATH = "/admin/social-media";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Staff = { db: SupabaseClient; actorId: string };

async function staff(): Promise<Staff | { error: string }> {
  const access = await requireAdmin("social_media");
  if (access.state === "unconfigured") return { error: "The console is not configured on this server." };
  if (access.state === "signed-out") return { error: "Sign in with your operations account to continue." };
  if (access.state === "step-up") return { error: "Confirm it is you to use the console." };
  if (access.state !== "admin") return { error: "This desk is for the Social Media Manager." };
  return { db: access.supabase as unknown as SupabaseClient, actorId: access.user.id };
}

function words(error: unknown): string {
  if (isNotLive(error)) return NOT_OPEN;
  if ((error as { code?: string } | null)?.code === "42501") return "Your staff role does not allow this.";
  return FAILED;
}

async function audit(s: Staff, action: string, entityId: string | null, detail: Record<string, string | number | boolean | null> = {}): Promise<string | null> {
  let written = false;
  try {
    written = await writeAudit(createAdminClient(), { actorId: s.actorId, action, entityType: "social_post", entityId, detail });
  } catch {
    written = false;
  }
  return written ? null : "Done, but the audit line could not be written. Operations has been alerted.";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DraftInput = {
  platform: string;
  category: string;
  format: string;
  slot: string;
  campaign: string;
  caption: string;
  plannedAt: string;
  mediaUrls: string[];
};

function validateDraft(input: DraftInput): { value: { platform: Platform; category: Category; format: Format; slot: Slot | null; campaign: string | null; caption: string; planned_at: string; media_urls: string[] } } | { error: string; fieldErrors?: Record<string, string> } {
  if (!isPlatform(input.platform)) return { error: "Choose a platform.", fieldErrors: { platform: "Choose one." } };
  if (!isCategory(input.category)) return { error: "Choose a category.", fieldErrors: { category: "Choose one." } };
  const format: Format = isFormat(input.format) ? input.format : "feed_post";
  const slot: Slot | null = isSlot(input.slot) ? input.slot : null;
  const caption = (input.caption ?? "").trim();
  if (caption.length > 5000) return { error: "That caption is too long.", fieldErrors: { caption: "Shorten it." } };
  if (!DATE.test(input.plannedAt ?? "")) return { error: "Choose a planned date.", fieldErrors: { plannedAt: "Choose a date." } };
  const campaign = (input.campaign ?? "").trim().slice(0, 140) || null;
  const mediaUrls = Array.isArray(input.mediaUrls) ? input.mediaUrls.filter((u) => typeof u === "string").slice(0, 20) : [];
  return {
    value: { platform: input.platform, category: input.category, format, slot, campaign, caption, planned_at: input.plannedAt, media_urls: mediaUrls },
  };
}

/** Create a post as a draft. */
export async function createDraft(input: DraftInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  const parsed = validateDraft(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await s.db
    .from("social_posts")
    .insert({ ...parsed.value, status: "draft", created_by: s.actorId })
    .select("id")
    .single();
  if (error || !data) return fail(words(error));
  const id = (data as { id: string }).id;
  const note = await audit(s, "social_post.create", id, { platform: parsed.value.platform, category: parsed.value.category });
  revalidatePath(PATH);
  return ok({ id, note });
}

/** Edit a draft that has not yet been sent for approval (or was sent back). */
export async function updateDraft(id: string, input: DraftInput): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(id)) return fail(FAILED);
  const parsed = validateDraft(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await s.db
    .from("social_posts")
    .update(parsed.value)
    .eq("id", id)
    .in("status", ["draft", "awaiting_approval"])
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("This post can no longer be edited; it has moved past that stage.");
  const note = await audit(s, "social_post.update", id);
  revalidatePath(PATH);
  return ok({ note });
}

/** Draft -> awaiting_approval. */
export async function submitForApproval(id: string): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(id)) return fail(FAILED);
  const { data, error } = await s.db
    .from("social_posts")
    .update({ status: "awaiting_approval", rejection_reason: null })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Only a draft can be sent for approval.");
  const note = await audit(s, "social_post.submit", id);
  revalidatePath(PATH);
  return ok({ note });
}

/** awaiting_approval -> approved. Anyone holding the social_media scope may approve, per the founder's brief: no second approval tier yet. */
export async function approveDraft(id: string): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(id)) return fail(FAILED);
  const { data, error } = await s.db
    .from("social_posts")
    .update({ status: "approved", approved_by: s.actorId, approved_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", id)
    .eq("status", "awaiting_approval")
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Only a post awaiting approval can be approved.");
  const note = await audit(s, "social_post.approve", id);
  revalidatePath(PATH);
  return ok({ note });
}

/** awaiting_approval -> draft, with the reason the manager will read. */
export async function sendBack(id: string, reason: string): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(id)) return fail(FAILED);
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 5) return fail("Give a reason of at least five characters.", { reason: "Say why." });
  const { data, error } = await s.db
    .from("social_posts")
    .update({ status: "draft", rejection_reason: trimmed.slice(0, 1000) })
    .eq("id", id)
    .eq("status", "awaiting_approval")
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Only a post awaiting approval can be sent back.");
  const note = await audit(s, "social_post.send_back", id, { reason: trimmed.slice(0, 200) });
  revalidatePath(PATH);
  return ok({ note });
}

const URL_RE = /^https?:\/\/.+/i;

/**
 * approved -> posted. The Social Media Manager does this themselves, by
 * hand, after actually posting on the real platform in a different browser
 * tab. This is the permanent record, nothing more.
 */
export async function markPosted(id: string, input: { liveUrl: string; postedAt: string }): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(id)) return fail(FAILED);
  const liveUrl = (input.liveUrl ?? "").trim();
  if (liveUrl && (!URL_RE.test(liveUrl) || liveUrl.length > 2000)) return fail("That does not look like a link.", { liveUrl: "Paste the post's link, or leave it blank." });
  const postedAt = input.postedAt ? new Date(input.postedAt) : new Date();
  if (Number.isNaN(postedAt.getTime())) return fail("Give a valid date and time.", { postedAt: "Check the date and time." });
  const { data, error } = await s.db
    .from("social_posts")
    .update({ status: "posted", live_url: liveUrl || null, posted_at: postedAt.toISOString() })
    .eq("id", id)
    .eq("status", "approved")
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Only an approved post can be marked posted.");
  const note = await audit(s, "social_post.posted", id, { liveUrl: liveUrl || null });
  revalidatePath(PATH);
  return ok({ note });
}

/** Cancel a post that will not go out after all. */
export async function cancelPost(id: string): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(id)) return fail(FAILED);
  const { data, error } = await s.db
    .from("social_posts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["draft", "awaiting_approval", "approved"])
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("That post can no longer be cancelled.");
  const note = await audit(s, "social_post.cancel", id);
  revalidatePath(PATH);
  return ok({ note });
}

/**
 * The inverse of `cancelPost`, behind the banner's Undo. A cancelled post
 * comes back as a DRAFT, never as approved: an approval is a decision by a
 * second person and is not carried across a cancel, so the post goes through
 * "Send for approval" again. Only a cancelled post is touched.
 */
export async function restoreCancelledPost(id: string): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(id)) return fail(FAILED);
  const { data, error } = await s.db.from("social_posts").update({ status: "draft" }).eq("id", id).eq("status", "cancelled").select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("That post is not cancelled any more, so there is nothing to restore.");
  const note = await audit(s, "social_post.restore", id);
  revalidatePath(PATH);
  return ok({ note });
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // matches lib/host/photos.ts PHOTO_MAX_BYTES
const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // matches lib/agent/listings-model.ts MAX_UPLOAD_BYTES
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"]);

function safeName(name: string): string {
  const ext = (name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase().slice(0, 8);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}${ext}`;
}

/** Upload one file into the media library. Runs on the service client, so the bucket's own (no) policy never has to be reasoned about per upload. */
export async function uploadMedia(formData: FormData): Promise<ActionResult<{ path: string; note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose a file.");
  if (!ALLOWED_TYPES.has(file.type)) return fail("That file type is not supported. Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, MOV, WebM).");
  const isVideo = file.type.startsWith("video/");
  const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > maxBytes) return fail(isVideo ? "That video is over 100MB. Export it at a lower resolution and try again." : "That image is over 10MB. Use a smaller file and try again.");
  const path = safeName(file.name || "upload");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await s.db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) {
    const message = (error as { message?: string } | null)?.message ?? "";
    if (/not found|bucket/i.test(message)) return fail(NOT_OPEN);
    return fail("The upload did not go through. Try again.");
  }
  const note = await audit(s, "social_media.upload", path, { contentType: file.type, bytes: file.size });
  revalidatePath(PATH);
  return ok({ path, note });
}

/** Remove a file from the media library. Refuses when a post still points at it. */
export async function deleteMedia(path: string): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!path || path.includes("/") || path.includes("..")) return fail(FAILED);
  const { data: inUse } = await s.db.from("social_posts").select("id").contains("media_urls", [path]).limit(1);
  if (inUse && inUse.length > 0) return fail("That file is attached to a post. Remove it from the post first.");
  const { error } = await s.db.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) return fail(words(error));
  const note = await audit(s, "social_media.delete_media", path);
  revalidatePath(PATH);
  return ok({ note });
}
