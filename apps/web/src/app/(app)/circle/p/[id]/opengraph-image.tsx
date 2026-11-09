import { ImageResponse } from "next/og";
import { DEFAULT_LOCALE, getDictionary } from "@vallo/i18n";

import { ogCentredCard, OG_CARD_SIZE } from "@/components/share/og-centred-card";
import { asJpeg, ogFonts, photoData } from "@/app/s/[token]/door-image";
import { readThread } from "@/lib/features/circle/queries";
import { siteUrl } from "@/lib/site";

/**
 * THE CIRCLE POST CARD A LINK UNFURLS AS (SHARE_AND_CONTROLS.md section 1.2).
 * The same design as the in-app share card: the asker or author's face (or a
 * tinted initial), the community it is in, and the post's title, centred for
 * the square crop, with the Vallo mark. Through the same read as the page, so
 * nothing a signed-out visitor cannot already see. The link is the short
 * `/circle/p/<id>`. Default locale: an unfurler carries no cookie.
 */

export const alt = "A discussion on Vallo";
export const size = OG_CARD_SIZE;
export const contentType = "image/jpeg";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const C = getDictionary(DEFAULT_LOCALE).circleCopy;
  const thread = await readThread(id);
  const fonts = await ogFonts();

  if (!thread) {
    return asJpeg(new ImageResponse(ogCentredCard({ display: "Vallo" }), { ...size, fonts }), false);
  }
  const post = thread.post;
  const avatar = post.author?.avatar ? await photoData(post.author.avatar, siteUrl()) : null;

  return asJpeg(
    new ImageResponse(
      ogCentredCard({
        avatar,
        initial: post.author?.label || post.community?.name || post.title,
        eyebrow: post.community?.name ?? (post.type === "question" ? C.card.question : C.tabs.discussions),
        display: post.title,
      }),
      { ...size, fonts },
    ),
    Boolean(avatar),
  );
}
