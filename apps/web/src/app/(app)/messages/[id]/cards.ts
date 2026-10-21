import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { countOf, formatDate, formatMoney, getDictionary, type Locale } from "@vallo/i18n";
import type { ChatCardData, ThreadCardData } from "@/components/app/messages/ChatCard";
import { cardRefFor, type ParsedShare, type SharedRef } from "@/components/app/messages/share";
import { getListingRepository } from "@/lib/listings/repository";
import { getStayDetail } from "@/lib/stays/queries";
import { readPassportCard } from "@/lib/passport/passport-read";
import { buildPassportView } from "@/lib/passport/view";
import { accommodationPhotoUrl } from "@/lib/stays/photos";
import type { Listing, ListingKind } from "@/lib/listings/types";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/**
 * Expand the shares in a thread into the cards the bubbles draw.
 *
 * A share is a body the grammar in `components/app/messages/share.ts`
 * recognises. This turns each one into card data by reading the thing it
 * points at through the reader's own client, so a booking that is not theirs
 * does not resolve (RLS answers) and the bubble falls back to the words and
 * the path, which still open the thing for whoever may open it.
 *
 * Listings go through the listing repository so a seed catalogue entry and a
 * database row both resolve, exactly as the listing page does it. Bookings
 * are one select on the bookings table under RLS, joined to their listing.
 *
 * Money and dates are formatted here, once, so the card component never
 * touches a formatter and can render on either side of the boundary.
 */

/** The markets let by the year, so a missing period never prints "per night" on a flat. */
const LONG_LET = new Set<ListingKind>(["rental", "shop", "office", "land"]);

const DAY: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
};

function dayLabel(iso: string, locale: Locale): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00+01:00`) : new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatDate(date, locale, DAY);
}


function listingCard(listing: Listing, locale: Locale): ChatCardData {
  /* The repository has already decided the headline: `priceMinor` and
     `pricePeriod` for a letting or a stay, `salePriceMinor` for a sale. A
     period is only printed where one exists. */
  const sale = listing.intent === "sale";
  const minor = sale ? (listing.salePriceMinor ?? listing.priceMinor) : listing.priceMinor;
  const period = listing.pricePeriod ?? (LONG_LET.has(listing.kind) ? "year" : "night");
  return {
    kind: "listing",
    id: listing.id,
    title: listing.title,
    area: listing.area,
    city: listing.city,
    photo: listing.photos[0] ?? null,
    hue: listing.hue,
    listingKind: listing.kind,
    verified: listing.verified,
    priceLabel: formatMoney(minor, locale),
    periodLabel: sale ? "" : getDictionary(locale).agentListings.pricing.period[period],
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    rating: listing.reviewCount > 0 ? listing.rating : null,
  };
}

async function bookingCard(db: Db, id: string, locale: Locale): Promise<ChatCardData | null> {
  const { data } = await db
    .from("bookings")
    .select(
      "id, listing_id, status, check_in, check_out, nights, adults, children, total_minor, listings(id, title, area, city, bedrooms, bathrooms)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.listings) return null;
  const row = data.listings;
  /* The repository already knows how to turn a row's kind and photos into
     the shapes the frame draws; one read there keeps this file from growing
     a second copy of the photo URL rule. */
  const listing = await getListingRepository().byId(row.id);
  const kind: ListingKind = listing?.kind ?? "shortlet";
  const features = [
    countOf(row.bedrooms, "bedrooms", locale),
    countOf(row.bathrooms, "bathrooms", locale),
  ];
  const partyLines = [countOf(data.adults, "adults", locale)];
  if (data.children > 0) partyLines.push(countOf(data.children, "children", locale));
  return {
    kind: "booking",
    id: data.id,
    listingId: row.id,
    title: row.title,
    area: row.area ?? "",
    city: row.city ?? "",
    photo: listing?.photos[0] ?? null,
    hue: listing?.hue ?? 0,
    listingKind: kind,
    status: data.status,
    statusLabel: (getDictionary(locale).threads.reservation.status as Record<string, string>)[data.status] ?? data.status,
    checkInLabel: dayLabel(data.check_in, locale),
    checkOutLabel: dayLabel(data.check_out, locale),
    partyLines,
    roomName: row.title,
    features,
    totalLabel: formatMoney(data.total_minor, locale),
    nightsLabel: countOf(data.nights, "nights", locale),
    rating: listing && listing.reviewCount > 0 ? listing.rating : null,
  };
}

/**
 * A stay shared from `/stay/<id>`.
 *
 * `/stay/<id>` takes an ACCOMMODATION id where a host has onboarded one and
 * falls through to the catalogue listing otherwise, so this tries the
 * accommodation first and then the listing. Without it an accommodation-backed
 * stay shared into a thread resolved nothing and the bubble drew the words and
 * the path rather than a card.
 *
 * Only what the record can say: the venue's name, where it is, its first
 * photograph and the cheapest published rate. No rating, because
 * `accommodations` carries none and a star count nobody earned is an invented
 * number (rule 15).
 */
async function stayCard(id: string, locale: Locale): Promise<ChatCardData | null> {
  const detail = await getStayDetail(id);
  if (!detail) {
    /* Not an accommodation. `/stay/<id>` falls through to the listing page in
       exactly this case, so the card falls through with it. */
    const listing = await getListingRepository().byId(id);
    return listing ? listingCard(listing, locale) : null;
  }

  const { accommodation, photos, room_types } = detail;
  const cover = [...photos].sort((a, b) => a.position - b.position)[0];
  const rates = room_types
    .flatMap((room) => room.rate_plans.map((plan) => plan.rate_minor))
    .filter((minor) => minor > 0);
  const cheapest = rates.length > 0 ? Math.min(...rates) : null;

  return {
    kind: "listing",
    id: accommodation.id,
    title: accommodation.name,
    area: accommodation.area ?? "",
    city: accommodation.city ?? "",
    photo: cover ? accommodationPhotoUrl(cover.storage_path) : null,
    hue: 0,
    listingKind: "hotel",
    verified: false,
    priceLabel: cheapest === null ? "" : formatMoney(cheapest, locale),
    periodLabel: cheapest === null ? "" : getDictionary(locale).agentListings.pricing.period.night,
    bedrooms: 0,
    bathrooms: 0,
    rating: null,
    shareKind: "stay",
  };
}

/**
 * A member's passport as a card. The read is the same one the passport page
 * makes, so it answers to the owner's switches, to blocks and to being signed
 * in: a passport that is off, or between two people who blocked each other,
 * resolves to nothing and the bubble falls back to its words and path.
 */
async function passportCard(ownerId: string, locale: Locale): Promise<ThreadCardData | null> {
  const facts = await readPassportCard(ownerId);
  if (!facts) return null;
  const t = getDictionary(locale);
  const copy = t.passportV2;
  return {
    kind: "passport",
    id: ownerId,
    view: buildPassportView(facts, copy, t.socialProfile.roleLine, locale),
    copy: { title: copy.title, open: copy.cardOpen, joined: copy.cardJoined },
  };
}

/** One card for one reference, or null when it does not resolve for this reader. */
export async function resolveCard(
  db: Db,
  ref: SharedRef,
  locale: Locale,
): Promise<ChatCardData | null> {
  try {
    if (ref.kind === "listing") {
      const listing = await getListingRepository().byId(ref.id);
      return listing ? listingCard(listing, locale) : null;
    }
    if (ref.kind === "stay") return await stayCard(ref.id, locale);
    return await bookingCard(db, ref.id, locale);
  } catch {
    return null;
  }
}

/**
 * Every card in a list of message bodies, keyed by message id. Bodies that
 * are not shares cost nothing; the same reference shared twice is read once.
 */
export async function resolveCards(
  db: Db,
  messages: { id: string; body: string; senderId?: string | null }[],
  locale: Locale,
): Promise<Map<string, ThreadCardData>> {
  const refs = new Map<string, ParsedShare>();
  const wanted = new Map<string, string>();
  for (const message of messages) {
    /* The same rule the open thread applies to a message arriving live
       (`cardRefFor`): a passport card is the sender's own, and nothing else
       draws as one. */
    const ref = cardRefFor(message);
    if (!ref) continue;
    const key = `${ref.kind}:${ref.id}`;
    refs.set(key, ref);
    wanted.set(message.id, key);
  }
  const resolved = new Map<string, ThreadCardData | null>();
  await Promise.all(
    [...refs.entries()].map(async ([key, ref]) => {
      resolved.set(key, ref.kind === "passport" ? await passportCard(ref.id, locale) : await resolveCard(db, ref, locale));
    }),
  );
  const out = new Map<string, ThreadCardData>();
  for (const [messageId, key] of wanted) {
    const card = resolved.get(key);
    if (card) out.set(messageId, card);
  }
  return out;
}
