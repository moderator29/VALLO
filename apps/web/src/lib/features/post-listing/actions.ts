"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney } from "@vallo/i18n/core";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "@/lib/actions/session";
import { listingPhotoUrl } from "@/lib/social/posts-media";

import { POST_LISTING_COLUMNS, firstPhotoPath, listingIdFromText, statedPrice, type PostListingRow } from "./model";

/**
 * THE COMPOSER'S LISTING PICKER (FEED_AND_CIRCLE_BRIEF part 2.2): what a
 * member can feature in a post. Three honest sources, all PUBLISHED listings
 * read under the member's own RLS: a Vallo listing link they paste, the places
 * they saved, and their own live listings. Nothing else is offered, so a post
 * can only ever carry a genuine listing (the database refuses anything that is
 * not live: `posts_genuine_listing`).
 */
export type ListingOption = {
  id: string;
  title: string;
  area: string;
  priceLabel: string;
  periodLabel: string;
  photoUrl: string | null;
  source: "link" | "saved" | "mine";
};

function toOption(row: PostListingRow, source: ListingOption["source"]): ListingOption {
  const price = statedPrice(row);
  return {
    id: row.id,
    title: row.title,
    area: row.area || row.city || "",
    priceLabel: price ? formatMoney(price.minor, "en") : "",
    periodLabel: price?.period ?? "",
    photoUrl: listingPhotoUrl(firstPhotoPath(row)),
    source,
  };
}

export async function listingOptions(input: { link?: string | null }): Promise<ActionResult<{ options: ListingOption[] }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const db = session.supabase as unknown as SupabaseClient;
  const uid = session.user.id;

  const linked = listingIdFromText(input.link ?? "");
  const [saved, agents] = await Promise.all([
    db.from("saved_items").select("listing_id").eq("user_id", uid).order("created_at", { ascending: false }).limit(30),
    db.from("agents").select("id").eq("user_id", uid),
  ]);
  if (saved.error || agents.error) return fail("Your places could not be read. Try again.");
  const savedIds = ((saved.data ?? []) as { listing_id: string }[]).map((r) => r.listing_id);
  const agentIds = ((agents.data ?? []) as { id: string }[]).map((r) => r.id);

  const [byId, mine] = await Promise.all([
    savedIds.length || linked
      ? db.from("listings").select(POST_LISTING_COLUMNS).in("id", [...savedIds, ...(linked ? [linked] : [])]).eq("status", "PUBLISHED").is("closed_at", null)
      : Promise.resolve({ data: [], error: null }),
    agentIds.length
      ? db.from("listings").select(POST_LISTING_COLUMNS).in("agent_id", agentIds).eq("status", "PUBLISHED").is("closed_at", null).order("published_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (byId.error || mine.error) return fail("Your places could not be read. Try again.");

  const rows = new Map(((byId.data ?? []) as unknown as PostListingRow[]).map((r) => [r.id, r]));
  const out: ListingOption[] = [];
  const seen = new Set<string>();
  const push = (row: PostListingRow | undefined, source: ListingOption["source"]) => {
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    out.push(toOption(row, source));
  };
  if (linked) push(rows.get(linked), "link");
  for (const id of savedIds) push(rows.get(id), "saved");
  for (const row of (mine.data ?? []) as unknown as PostListingRow[]) push(row, "mine");
  return ok({ options: out });
}
