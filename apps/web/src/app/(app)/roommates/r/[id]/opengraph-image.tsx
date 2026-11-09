import { ImageResponse } from "next/og";
import { DEFAULT_LOCALE, formatMoney, getDictionary, plural } from "@vallo/i18n";

import { ogCentredCard, OG_CARD_SIZE } from "@/components/share/og-centred-card";
import { asJpeg, ogFonts, photoData } from "@/app/s/[token]/door-image";
import { monthlyMinor } from "@/lib/features/roommates/model";
import { readRoomListing } from "@/lib/features/roommates/queries";

/**
 * THE ROOMMATE LISTING CARD A LINK UNFURLS AS (SHARE_AND_CONTROLS.md section
 * 1.2). The same design as the in-app share card: the room's cover
 * photograph full bleed (so the square crop keeps the room), the title, the
 * share-or-rent a month, and the rooms free. Through the same public read as
 * the page (`roommate_listing_view`, SECURITY DEFINER), so nothing private is
 * shown. The link is the short `/roommates/r/<id>`. Default locale: an
 * unfurler carries no cookie.
 */

export const alt = "A room to share on Vallo";
export const size = OG_CARD_SIZE;
export const contentType = "image/jpeg";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = getDictionary(DEFAULT_LOCALE).shareCard;
  const read = await readRoomListing(id);
  const fonts = await ogFonts();

  if (read.state !== "ok") {
    return asJpeg(new ImageResponse(ogCentredCard({ display: "Vallo" }), { ...size, fonts }), false);
  }
  const l = read.listing;
  const cover = l.photoUrls[0] ? await photoData(l.photoUrls[0]) : null;
  const monthly = monthlyMinor(l.shareMinor ?? l.rentMinor, l.rentPeriod);
  const stats = [
    monthly !== null ? { value: formatMoney(monthly, DEFAULT_LOCALE, "NGN", { compact: true }), label: t.listingStats.perMonth } : null,
    typeof l.roomsAvailable === "number" && l.roomsAvailable > 0
      ? { value: String(l.roomsAvailable), label: plural(l.roomsAvailable, t.listingStats.roomsFree, "en").replace(/^[\d,.]+\s*/, "") }
      : null,
  ].filter((s): s is { value: string; label: string } => s !== null);

  return asJpeg(
    new ImageResponse(
      ogCentredCard({
        photo: cover,
        eyebrow: [l.area, l.city].filter(Boolean).join(", ") || null,
        display: l.title,
        stats,
      }),
      { ...size, fonts },
    ),
    Boolean(cover),
  );
}
