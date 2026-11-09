import "server-only";

import { readCountedReviews } from "../reviews/weight";

/**
 * What sits under the tabs on a person's page.
 *
 * A normal person and an agent are asked different questions about themselves,
 * so they get different tabs: Posts, Replies, Media and Activity for one,
 * Properties, Stories, Reviews and Activity for the other. This module is the
 * four reads the second set needs, plus the grid the first set's Media tab
 * renders.
 *
 * Every one goes through the caller's own row level security bound client. The
 * interesting consequence is on Activity: `post_reactions_select` publishes
 * `LIKE` rows and keeps every other mark private to its author, so "what this
 * person liked" is a public fact by design and "what they saved" is not. That
 * distinction is the database's, and this file does not restate it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LOCALE, intlTag, type Locale } from "@vallo/i18n/core";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";
import { resolveSession } from "../actions/session";
import type { Database } from "../supabase/database.types";
import { listingPhotoUrl, signMedia, type PostMediaItem } from "./posts-media";
import { DELETED_STATUS } from "./deleted-posts";
import {
  headlinePeriod,
  headlinePrice,
  type ListingIntent,
  type PricePeriod,
} from "../listings/pricing";

const LIMIT = 30;

async function reader() {
  const session = await resolveSession();
  const supabase = session.state === "signed-in" ? session.supabase : await createClient();
  const viewerId = session.state === "signed-in" ? session.user.id : null;
  return { supabase, viewerId };
}

/* --------------------------------------------------------------- Properties */

export type PropertyCard = {
  id: string;
  title: string;
  area: string;
  city: string;
  priceMinor: number;
  /**
   * What the figure is quoted in, or "sale" when it is an asking price. Comes
   * from `headlinePrice`, the same resolution the public catalogue uses, so a
   * property on somebody's profile and the same property in search cannot
   * print two different numbers.
   */
  pricePeriod: PricePeriod | "sale";
  intent: ListingIntent;
  bedrooms: number;
  bathrooms: number;
  photoUrl: string | null;
};

/**
 * An agent's live listings.
 *
 * Keyed on the `agents.id` projected onto the social profile, because `agents`
 * itself is readable only by its owner and by an admin, so there is no way to
 * walk from a person to their listings without that projection. When it is
 * absent this answers with an empty list and the profile does not offer the tab
 * at all, rather than offering one that could only ever be empty.
 *
 * `listings_select_published` does the filtering, so a draft or a rejected
 * listing cannot appear here even if this forgot to ask.
 */
export async function getAgentProperties(agentId: string | null): Promise<PropertyCard[]> {
  if (!isSupabaseConfigured() || !agentId) return [];
  const { supabase } = await reader();

  try {
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, title, area, city, listing_intent, rent_amount_minor, rent_period, rate_minor, rate_period, sale_price_minor, bedrooms, bathrooms, listing_photos ( storage_path, position )",
      )
      .eq("agent_id", agentId)
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false })
      .limit(LIMIT);
    if (error || !data) return [];

    return data.map((row) => {
      const photos = (row.listing_photos ?? []) as { storage_path: string; position: number }[];
      const first = [...photos].sort((a, b) => a.position - b.position)[0];
      const headline = headlinePrice(row);
      return {
        id: row.id,
        title: row.title,
        area: row.area ?? "",
        city: row.city ?? "",
        priceMinor: headline.minor,
        pricePeriod: headlinePeriod(headline),
        intent: row.listing_intent === "sale" ? "sale" : "rent",
        bedrooms: row.bedrooms ?? 0,
        bathrooms: row.bathrooms ?? 0,
        /* The row stores a bucket path, not an address. Handing that straight
           to an `img` is an empty frame, which is what this tab rendered. */
        photoUrl: listingPhotoUrl(first?.storage_path),
      };
    });
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ Reviews */

export type ReviewCard = {
  id: string;
  rating: number;
  body: string;
  createdLabel: string;
  listingTitle: string;
  authorLabel: string;
};

/**
 * What guests said about this agent's places.
 *
 * `reviews_select` already limits this to reviews on published listings plus
 * the reader's own, so a review sitting on a listing that was taken down does
 * not resurface here.
 */
export async function getAgentReviews(agentId: string | null): Promise<ReviewCard[]> {
  if (!isSupabaseConfigured() || !agentId) return [];
  const { supabase } = await reader();

  try {
    const { data: listings } = await supabase
      .from("listings")
      .select("id, title")
      .eq("agent_id", agentId)
      .eq("status", "PUBLISHED")
      .limit(100);
    const rows = (listings ?? []) as { id: string; title: string }[];
    if (rows.length === 0) return [];
    const titleById = new Map(rows.map((l) => [l.id, l.title]));

    /* V-58: a review from the lister's own shadow is not on their page. */
    const { data, error } = await readCountedReviews<{
      id: string;
      rating: number;
      body: string | null;
      created_at: string;
      listing_id: string;
      author_id: string | null;
    }>((table) =>
      (supabase as unknown as SupabaseClient)
        .from(table)
        .select("id, rating, body, created_at, listing_id, author_id")
        .in(
          "listing_id",
          rows.map((l) => l.id),
        )
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    );
    if (error || !data) return [];

    const authorIds = [
      ...new Set(data.map((r) => r.author_id).filter((v): v is string => Boolean(v))),
    ];
    const { data: authors } = authorIds.length
      ? await supabase
          .from("social_profiles")
          .select("user_id, display_label, handle")
          .in("user_id", authorIds)
      : { data: [] as never[] };
    const labelById = new Map(
      ((authors ?? []) as { user_id: string; display_label: string | null; handle: string }[]).map(
        (a) => [a.user_id, a.display_label || `@${a.handle}`],
      ),
    );

    return data.map((row) => ({
      id: row.id,
      rating: Number(row.rating ?? 0),
      body: row.body ?? "",
      createdLabel: monthYear(row.created_at),
      listingTitle: titleById.get(row.listing_id) ?? "a stay",
      /* A guest who never claimed a handle is "A guest", not a blank. Naming
         somebody who has no public identity would be inventing one for them. */
      authorLabel: (row.author_id && labelById.get(row.author_id)) || "A guest",
    }));
  } catch {
    return [];
  }
}

export type RatingAggregate = {
  average: number;
  count: number;
  breakdown: [number, number, number, number, number];
};

export async function getAgentRatingAggregate(agentId: string | null): Promise<RatingAggregate | null> {
  if (!isSupabaseConfigured() || !agentId) return null;
  const { supabase } = await reader();

  try {
    const { data: listings } = await supabase
      .from("listings")
      .select("id")
      .eq("agent_id", agentId)
      .eq("status", "PUBLISHED")
      .limit(100);
    const ids = ((listings ?? []) as { id: string }[]).map((l) => l.id);
    if (ids.length === 0) return null;

    const { data, error } = await readCountedReviews<{ rating: number }>((table) =>
      (supabase as unknown as SupabaseClient)
        .from(table)
        .select("rating")
        .in("listing_id", ids),
    );
    if (error || !data || data.length === 0) return null;

    const breakdown: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    let sum = 0;
    for (const row of data) {
      const r = Math.round(Number(row.rating));
      const idx = r - 1;
      if (idx >= 0 && idx <= 4) {
        const arr = breakdown as number[];
        arr[idx] = (arr[idx] ?? 0) + 1;
        sum += r;
      }
    }
    const count = breakdown.reduce((a, b) => a + b, 0);
    if (count === 0) return null;
    return { average: sum / count, count, breakdown };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------- Media */

export type MediaTile = {
  postId: string;
  url: string;
  width: number | null;
  height: number | null;
};

/**
 * Every picture this person has posted, as a grid rather than as cards.
 *
 * `social-media` is a private bucket read through `private.can_see_post`, so
 * these are signed URLs with a short life rather than public ones. That is the
 * whole reason a media grid is a different read from a media feed: forty signed
 * URLs in one call, not one call per card.
 */
export async function getProfileMediaGrid(userId: string): Promise<MediaTile[]> {
  if (!isSupabaseConfigured()) return [];
  const { supabase } = await reader();

  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, created_at, post_media!inner ( storage_path, position, width, height )")
      .eq("author_id", userId)
      /* A deleted post is deleted (founder, item 4). The media rows are dropped
         by `posts_drop_media_on_remove` as the status lands, and this says the
         same thing at the read, so the grid never depends on that alone. */
      .neq("status", DELETED_STATUS)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error || !data) return [];

    const items: PostMediaItem[] = [];
    for (const row of data as unknown as {
      id: string;
      post_media: { storage_path: string; position: number; width: number | null; height: number | null }[];
    }[]) {
      for (const media of [...(row.post_media ?? [])].sort((a, b) => a.position - b.position)) {
        items.push({
          postId: row.id,
          storagePath: media.storage_path,
          width: media.width,
          height: media.height,
        });
      }
    }

    const signed = await signMedia(supabase, items);
    return signed.map((item) => ({
      postId: item.postId,
      url: item.url,
      width: item.width,
      height: item.height,
    }));
  } catch {
    return [];
  }
}

/**
 * "May 2025", for a joined line and a review date.
 *
 * This used to ask yo-NG, ha-NG and ig-NG, so that "Joined March 2024" in
 * Yoruba did not carry an English month. Node gave Yoruba, Hausa and Igbo
 * month names, but Chrome has none and writes the phone's own language, so
 * the same page wrote a date one way on the server and another in the
 * browser. Every date on the platform is now written the en-NG way in every
 * locale (`intlTag` in @vallo/i18n/core says why), and the month in the
 * reader's language comes back when the locale files carry it.
 *
 * The locale is optional and English is the default deliberately: the review
 * date this also formats is read from a server module that has no request
 * locale in hand, and quietly changing what that renders is not this
 * function's business.
 */
export function monthYear(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!iso || !Number.isFinite(new Date(iso).getTime())) return "";
  try {
    return new Intl.DateTimeFormat(intlTag[locale], {
      month: "long",
      year: "numeric",
      timeZone: "Africa/Lagos",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export type { SupabaseClient, Database };
