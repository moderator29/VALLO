"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatMoney } from "@vallo/i18n/core";

import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "@/lib/actions/session";
import { oncePerTap, tapKey } from "@/lib/offline/replay-guard";
import { writeInAppNotice } from "@/lib/notify/in-app";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { SOCIAL_OFF_MESSAGE, isSocialEnabled } from "@/lib/social/flag";
import { listingPhotoUrl } from "@/lib/social/posts-media";
import { createAdminClient } from "@/lib/supabase/admin";

import { firstPhotoPath, statedPrice, type PostListingRow } from "../post-listing/model";
import {
  LIVE_LISTING_COLUMNS,
  SHARE_WORDS,
  cleanNote,
  decideShare,
  slotsFrom,
  wordsForDbCode,
  wordsForReason,
  type ShareSlots,
} from "./model";

/**
 * SHARE TO FEED: the server half (founder, 10 November 2026).
 *
 * Runs through the caller's own RLS-bound client: the posts policies decide
 * who may insert, `private.listing_share_guard()` decides the limit under a
 * per-user advisory lock, and the content scanner, rate limits and holds apply
 * as to any post. The checks here are so a person gets a sentence, and so a
 * refused share costs no round trip; they are not the authority.
 *
 * The role that lifts the limit is a `user_roles` row with role `super_admin`
 * (the source `requireAdmin` and `private.has_role` read). An admin who is not
 * a super admin is limited like everyone.
 */

type Db = SupabaseClient;

export type ShareCardPreview = {
  id: string;
  title: string;
  place: string;
  priceLabel: string;
  periodLabel: string;
  photoUrl: string | null;
};

export type SharePreview = {
  listing: ShareCardPreview;
  slots: ShareSlots;
  /** The caller already holds an active share of this listing. */
  alreadyShared: boolean;
  /** The caller lists this property themselves (they may still share it). */
  own: boolean;
};

const listingIdSchema = z.object({ listingId: z.string().uuid("That listing could not be found.") });
const shareSchema = listingIdSchema.extend({ note: z.string().max(2000).optional() });
const removeSchema = z.object({ postId: z.string().uuid() });

async function readSlots(db: Db, userId: string): Promise<ShareSlots | null> {
  const [roles, used] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin"),
    db
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId)
      .eq("is_listing_share", true)
      .neq("status", "REMOVED"),
  ]);
  if (used.error) return null;
  const unlimited = !roles.error && (roles.data ?? []).length > 0;
  return slotsFrom(used.count ?? 0, unlimited);
}

type LiveListing = PostListingRow & { agent_id: string; closed_at: string | null; is_demo: boolean | null };

/** A public, live listing, read as the caller (so RLS applies) and checked again here. */
async function readLiveListing(db: Db, listingId: string): Promise<LiveListing | null> {
  const { data, error } = await db
    .from("listings")
    .select(LIVE_LISTING_COLUMNS)
    .eq("id", listingId)
    .eq("status", "PUBLISHED")
    .is("closed_at", null)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as LiveListing;
  return row.is_demo ? null : row;
}

function previewOf(row: PostListingRow): ShareCardPreview {
  const price = statedPrice(row);
  return {
    id: row.id,
    title: row.title,
    place: [row.area, row.city].filter(Boolean).join(", "),
    priceLabel: price ? formatMoney(price.minor, "en") : "",
    periodLabel: price?.period ?? "",
    photoUrl: listingPhotoUrl(firstPhotoPath(row)),
  };
}

async function activeShareOf(db: Db, userId: string, listingId: string): Promise<boolean> {
  const { data } = await db
    .from("posts")
    .select("id")
    .eq("author_id", userId)
    .eq("is_listing_share", true)
    .eq("shared_listing_id", listingId)
    .neq("status", "REMOVED")
    .limit(1);
  return (data ?? []).length > 0;
}

/** What the sheet shows before the person tries: the card, the slots left, and whether they already shared it. */
export async function readListingSharePreview(input: { listingId: string }): Promise<ActionResult<SharePreview>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(listingIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const db = session.supabase as unknown as Db;

  const listing = await readLiveListing(db, parsed.data.listingId);
  if (!listing) return fail(SHARE_WORDS.notLive);
  const slots = await readSlots(db, session.user.id);
  if (!slots) return fail(SHARE_WORDS.loadFailed);
  const [alreadyShared, own] = await Promise.all([
    activeShareOf(db, session.user.id, listing.id),
    db
      .from("agents")
      .select("id")
      .eq("id", listing.agent_id)
      .eq("user_id", session.user.id)
      .then((r) => (r.data ?? []).length > 0),
  ]);
  return ok({ listing: previewOf(listing), slots, alreadyShared, own });
}

/**
 * Put a listing in the feed. Anyone signed in may share any public, live
 * listing, their own or somebody else's.
 */
export async function shareListingToFeed(input: {
  listingId: string;
  note?: string;
  /** The UUID minted when this was tapped; a replay answers with the first share. */
  tapKey?: string;
}): Promise<ActionResult<{ postId: string; held: boolean; slots: ShareSlots }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const { tapKey: rawKey, ...fields } = input;
  const parsed = validate(shareSchema, fields);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  return oncePerTap("listing.share", session.user.id, tapKey(rawKey), () => shareWork(session, parsed.data));
}

async function shareWork(
  session: Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>,
  input: z.infer<typeof shareSchema>,
): Promise<ActionResult<{ postId: string; held: boolean; slots: ShareSlots }>> {
  const note = cleanNote(input.note);
  if (!note.ok) return fail(note.error, { note: note.error });

  const verdict = await consume({ bucket: "social:listing-share", subject: subjectForUser(session.user.id), limit: 20, windowSeconds: 86_400 });
  if (!verdict.allowed) return fail(SHARE_WORDS.paced);

  const db = session.supabase as unknown as Db;
  const listing = await readLiveListing(db, input.listingId);
  const [slots, alreadyShared] = await Promise.all([
    readSlots(db, session.user.id),
    listing ? activeShareOf(db, session.user.id, listing.id) : Promise.resolve(false),
  ]);
  if (!slots) return fail(SHARE_WORDS.failed);

  const decision = decideShare({ signedIn: true, live: listing !== null, alreadyShared, slots });
  if (!decision.allowed) return fail(wordsForReason(decision.reason));

  /* The database counts again under its advisory lock; this insert is the one
     place the limit is actually enforced. */
  const { data, error } = await db
    .from("posts")
    .insert({
      author_id: session.user.id,
      author_kind: "USER",
      kind: "GIST",
      body: note.note,
      is_listing_share: true,
      shared_listing_id: input.listingId,
    })
    .select("id, status")
    .single();
  if (error || !data) {
    const said = wordsForDbCode(error?.code);
    if (said) return fail(said);
    /* The columns are not live yet (the SQL has not been run). */
    if (error?.code === "42703" || error?.code === "PGRST204") return fail(SHARE_WORDS.notOpen);
    return fail(SHARE_WORDS.failed);
  }

  const next = slotsFrom(slots.used + 1, slots.unlimited);
  if (listing) await tellOwner(session.user.id, listing);

  revalidatePath("/around");
  return ok({ postId: data.id as string, held: data.status === "HELD", slots: next });
}

/** The listing's owner is told once in a while, never for a share of their own listing. */
async function tellOwner(sharerId: string, listing: LiveListing): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: agent } = await admin.from("agents").select("user_id").eq("id", listing.agent_id).maybeSingle();
    const ownerId = agent?.user_id ?? null;
    if (!ownerId || ownerId === sharerId) return;
    /* One notice per sharer and listing a week, and a daily ceiling per owner,
       so a share, a removal and a re-share cannot pile up in somebody's bell. */
    const perListing = await consume({ bucket: "social:listing-share-note", subject: `share:${sharerId}:${listing.id}`, limit: 1, windowSeconds: 604_800 });
    if (!perListing.allowed) return;
    const perOwner = await consume({ bucket: "social:listing-share-owner", subject: subjectForUser(ownerId), limit: 10, windowSeconds: 86_400 });
    if (!perOwner.allowed) return;
    const { data: profile } = await admin.from("social_profiles").select("display_label, handle").eq("user_id", sharerId).maybeSingle();
    const name = profile?.display_label ?? (profile?.handle ? `@${profile.handle}` : "Someone");
    await writeInAppNotice(admin, {
      user_id: ownerId,
      kind: "listing",
      title: SHARE_WORDS.notifyTitle,
      body: SHARE_WORDS.notifyBody.replace("{name}", name).replace("{title}", listing.title),
      href: "/around",
    });
  } catch {
    /* The share has committed. A missing notice is a gap, not a failure. */
  }
}

/**
 * Take a share out of the feed, which frees the slot. Only the sharer's own
 * share, and only a listing share (this is not a way to delete other posts).
 */
export async function removeListingShare(input: { postId: string }): Promise<ActionResult<{ slots: ShareSlots }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(removeSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const db = session.supabase as unknown as Db;

  const { data, error } = await db
    .from("posts")
    .update({ status: "REMOVED", body: null, payload: null, removed_at: new Date().toISOString() })
    .eq("id", parsed.data.postId)
    .eq("author_id", session.user.id)
    .eq("is_listing_share", true)
    .select("id");
  if (error || !data || data.length === 0) return fail(SHARE_WORDS.failed);

  const slots = await readSlots(db, session.user.id);
  revalidatePath("/around");
  revalidatePath(`/post/${parsed.data.postId}`);
  return ok({ slots: slots ?? slotsFrom(0, false) });
}
