import { ImageResponse } from "next/og";
import { DEFAULT_LOCALE, getDictionary, plural } from "@vallo/i18n";

import { ogCentredCard, OG_CARD_SIZE } from "@/components/share/og-centred-card";
import { asJpeg, ogFonts, photoData } from "@/app/s/[token]/door-image";
import { loadPublicProfile } from "@/lib/social/profiles-queries";
import { siteUrl } from "@/lib/site";

/**
 * THE PROFILE CARD A LINK UNFURLS AS (SHARE_AND_CONTROLS.md section 1.2). What
 * WhatsApp, Telegram and iMessage draw when `/u/<handle>` is pasted: the same
 * design as the in-app share card, centred for the square crop, with the
 * person's face or a tinted initial, their name, their follower and post
 * counts, and the Vallo mark. Public fields only, through the same anonymous
 * read as the page (`loadPublicProfile`), so the image shows nothing a
 * signed-out visitor is not. No cover, no bio, no private field. The link is
 * the short `/u/<handle>`, never a query string. The locale is the default:
 * an unfurler carries no cookie.
 */

export const alt = "A member on Vallo";
export const size = OG_CARD_SIZE;
export const contentType = "image/jpeg";

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const t = getDictionary(DEFAULT_LOCALE).shareCard;
  const read = await loadPublicProfile(handle);
  const fonts = await ogFonts();

  if (read.state !== "found") {
    /* No such person, or not public: the mark's own light and nothing else. */
    return asJpeg(new ImageResponse(ogCentredCard({ display: "Vallo" }), { ...size, fonts }), false);
  }
  const p = read.profile;
  const avatar = p.avatarUrl ? await photoData(p.avatarUrl, siteUrl()) : null;
  const stats = [
    { value: new Intl.NumberFormat("en-NG").format(p.followerCount), label: plural(p.followerCount, t.profileStats.followers, "en").replace(/^[\d,.]+\s*/, "") },
    { value: new Intl.NumberFormat("en-NG").format(p.postCount), label: plural(p.postCount, t.profileStats.posts, "en").replace(/^[\d,.]+\s*/, "") },
  ];

  return asJpeg(
    new ImageResponse(
      ogCentredCard({
        avatar,
        initial: p.displayLabel || handle,
        eyebrow: `@${handle}`,
        display: p.displayLabel || `@${handle}`,
        stats,
      }),
      { ...size, fonts },
    ),
    Boolean(avatar),
  );
}
