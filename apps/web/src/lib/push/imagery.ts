import "server-only";

import { photoUrl } from "@/lib/listings/supabase-repository";
import { accommodationPhotoUrl } from "@/lib/stays/photos";
import { siteUrl } from "@/lib/site";
import { conversationOf } from "./policy";
import type { PushClient } from "./schema";

/**
 * THE PICTURE ON THE LOCK SCREEN (FEATURE_BACKLOG A1 to A3, Agent NATIVE job
 * 6). A push about a place, or a booking of one, carries that place's cover
 * photograph; a message
 * carries the face of the person who wrote it, or, when they have none, the
 * place the conversation is about. iOS draws it through the Notification
 * Service Extension, Android as the big picture and its thumbnail, and web
 * push as the notification's image.
 *
 * WHAT IS NEVER SENT. Only an https address the phone can fetch without a
 * session: the public listing and stay buckets, a profile photo that is
 * already public, or Vallo's own `/brand/photos` files made absolute. A
 * private object (a walkthrough, a document, a message attachment) has no
 * public URL here, so it can never reach a lock screen.
 *
 * Read in three small batched queries per drain at most, never one per
 * push, and best effort: any failure is a push without a picture.
 */

export type ImageTarget = { kind: "listing" | "stay" | "thread" | "booking"; id: string };

const ID = "[A-Za-z0-9-]{8,64}";
const PLACE = new RegExp(`^/(listing|stay)/(${ID})(?:[/?#]|$)`);
const BOOKING = /^\/bookings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

/** What a push's destination is a picture of, or null. Pure. */
export function imageTargetOf(href: string | null | undefined): ImageTarget | null {
  if (!href) return null;
  const place = href.match(PLACE);
  if (place) return { kind: place[1] === "stay" ? "stay" : "listing", id: place[2]! };
  const booking = href.match(BOOKING);
  if (booking) return { kind: "booking", id: booking[1]!.toLowerCase() };
  const thread = conversationOf(href);
  return thread ? { kind: "thread", id: thread } : null;
}

/** An address a phone can fetch with no session: https, or our own path made absolute. Pure. */
export function absoluteImage(url: string | null | undefined, site: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    try {
      const absolute = new URL(trimmed, site);
      return absolute.protocol === "https:" ? absolute.href : null;
    } catch {
      return null;
    }
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && trimmed.length <= 1024 ? parsed.href : null;
  } catch {
    return null;
  }
}

function firstByOwner(rows: Array<{ owner: string; storage_path: string; position: number }>): Map<string, string> {
  const out = new Map<string, { path: string; position: number }>();
  for (const row of rows) {
    const had = out.get(row.owner);
    if (!had || row.position < had.position) out.set(row.owner, { path: row.storage_path, position: row.position });
  }
  return new Map([...out].map(([k, v]) => [k, v.path]));
}

/**
 * The picture for each of these destinations, for one recipient (so a
 * thread's picture is the OTHER person). Keyed by href.
 */
export async function resolvePushImages(admin: PushClient, recipientId: string, hrefs: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const site = siteUrl();
  const targets = new Map<string, ImageTarget>();
  for (const href of hrefs) {
    const target = imageTargetOf(href);
    if (target) targets.set(href, target);
  }
  if (targets.size === 0) return out;

  try {
    const threadIds = [...new Set([...targets.values()].filter((t) => t.kind === "thread").map((t) => t.id))];
    const threads = new Map<string, { counterpart: string | null; listing: string | null }>();
    if (threadIds.length > 0) {
      const { data } = await admin.from("conversations").select("id, guest_id, agent_id, listing_id").in("id", threadIds);
      for (const row of data ?? []) {
        const counterpart = row.guest_id === recipientId ? row.agent_id : row.agent_id === recipientId ? row.guest_id : null;
        threads.set(row.id, { counterpart, listing: row.listing_id });
      }
    }

    /* A booking shows its place, read only as the recipient's own: the guest,
       or the host of that listing or stay. Anything else draws no picture. */
    const bookingPlace = new Map<string, { kind: "listing" | "stay"; id: string }>();
    const bookingIds = [...new Set([...targets.values()].filter((t) => t.kind === "booking").map((t) => t.id))];
    if (bookingIds.length > 0) {
      const { data: rows } = await admin.from("bookings").select("id, guest_id, listing_id, accommodation_id").in("id", bookingIds);
      const hostListings = (rows ?? []).filter((r) => r.guest_id !== recipientId && r.listing_id).map((r) => r.listing_id!);
      const hostStays = (rows ?? []).filter((r) => r.guest_id !== recipientId && r.accommodation_id).map((r) => r.accommodation_id!);
      const [listingHosts, stayHosts] = await Promise.all([
        hostListings.length > 0
          ? admin.from("listings").select("id, agents(user_id)").in("id", hostListings)
          : Promise.resolve({ data: [] as Array<{ id: string; agents: { user_id: string | null } | null }> }),
        hostStays.length > 0
          ? admin.from("accommodations").select("id, businesses(owner_id)").in("id", hostStays)
          : Promise.resolve({ data: [] as Array<{ id: string; businesses: { owner_id: string | null } | null }> }),
      ]);
      const listingHost = new Map(((listingHosts.data ?? []) as Array<{ id: string; agents: { user_id: string | null } | null }>).map((r) => [r.id, r.agents?.user_id ?? null]));
      const stayHost = new Map(((stayHosts.data ?? []) as Array<{ id: string; businesses: { owner_id: string | null } | null }>).map((r) => [r.id, r.businesses?.owner_id ?? null]));
      for (const r of rows ?? []) {
        const guest = r.guest_id === recipientId;
        if (r.listing_id && (guest || listingHost.get(r.listing_id) === recipientId)) bookingPlace.set(r.id, { kind: "listing", id: r.listing_id });
        else if (r.accommodation_id && (guest || stayHost.get(r.accommodation_id) === recipientId)) bookingPlace.set(r.id, { kind: "stay", id: r.accommodation_id });
      }
    }

    const listingIds = new Set<string>();
    const stayIds = new Set<string>();
    for (const t of targets.values()) {
      if (t.kind === "listing") listingIds.add(t.id);
      if (t.kind === "stay") stayIds.add(t.id);
      if (t.kind === "booking") {
        const place = bookingPlace.get(t.id);
        if (place?.kind === "listing") listingIds.add(place.id);
        if (place?.kind === "stay") stayIds.add(place.id);
      }
      if (t.kind === "thread") {
        const listing = threads.get(t.id)?.listing;
        if (listing) listingIds.add(listing);
      }
    }
    const people = [...new Set([...threads.values()].map((t) => t.counterpart).filter((v): v is string => Boolean(v)))];

    const [listingPhotos, stayPhotos, faces] = await Promise.all([
      listingIds.size > 0
        ? admin.from("listing_photos").select("listing_id, storage_path, position").in("listing_id", [...listingIds]).lte("position", 3)
        : Promise.resolve({ data: [] as Array<{ listing_id: string; storage_path: string; position: number }> }),
      stayIds.size > 0
        ? admin.from("accommodation_photos").select("accommodation_id, storage_path, position").in("accommodation_id", [...stayIds]).lte("position", 3)
        : Promise.resolve({ data: [] as Array<{ accommodation_id: string; storage_path: string; position: number }> }),
      people.length > 0
        ? admin.from("profiles").select("id, avatar_url").in("id", people)
        : Promise.resolve({ data: [] as Array<{ id: string; avatar_url: string | null }> }),
    ]);

    const listingCover = firstByOwner((listingPhotos.data ?? []).map((r) => ({ owner: r.listing_id, storage_path: r.storage_path, position: r.position })));
    const stayCover = firstByOwner((stayPhotos.data ?? []).map((r) => ({ owner: r.accommodation_id, storage_path: r.storage_path, position: r.position })));
    const face = new Map((faces.data ?? []).map((r) => [r.id, r.avatar_url]));

    for (const [href, t] of targets) {
      let url: string | null = null;
      if (t.kind === "listing") url = listingCover.has(t.id) ? photoUrl(listingCover.get(t.id)!) : null;
      else if (t.kind === "stay") url = stayCover.has(t.id) ? accommodationPhotoUrl(stayCover.get(t.id)!) : null;
      else if (t.kind === "booking") {
        const place = bookingPlace.get(t.id);
        url =
          place?.kind === "listing" && listingCover.has(place.id)
            ? photoUrl(listingCover.get(place.id)!)
            : place?.kind === "stay" && stayCover.has(place.id)
              ? accommodationPhotoUrl(stayCover.get(place.id)!)
              : null;
      }
      else {
        const thread = threads.get(t.id);
        const avatar = thread?.counterpart ? face.get(thread.counterpart) : null;
        url = avatar ?? (thread?.listing && listingCover.has(thread.listing) ? photoUrl(listingCover.get(thread.listing)!) : null);
      }
      const absolute = absoluteImage(url, site);
      if (absolute) out.set(href, absolute);
    }
  } catch {
    /* A push without a picture is still the push. */
  }
  return out;
}
