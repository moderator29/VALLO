"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { isOptimisable } from "@/lib/images/optimisable";

/**
 * A PICTURE ON A POST THAT NEVER JUMPS AND ARRIVES SOFTLY (A.5: "media that
 * never jumps. Reserved space, blur up, no layout shift").
 *
 * The space is the grid's: every layout in `.nf-post__media` is a fixed shape,
 * so the card is its final height before a byte arrives. This adds the blur
 * up. Until the picture has decoded, the element shows its own background
 * through a 14px blur: a 32px copy of the same picture from the image
 * optimiser where the source can be optimised (our own assets, a public
 * listing photo), and the inset ground where it cannot. When the full picture
 * has loaded, the blur settles out on `glide` (`social-feed.css`, `.nf-pic`).
 *
 * WHY NOT A LOW-RES COPY FOR EVERY PICTURE. A member's own photographs are
 * signed URLs against a private bucket. Running one through the optimiser
 * would cache a private photograph behind a URL that outlives its signature
 * (the reason `RemoteImage` exists), so those blur up from the ground, not
 * from a copy. Nothing about that is faked: there is simply no copy to show.
 *
 * It is `next/image` directly rather than `RemoteImage` only because the
 * shared wrapper does not pass `onLoad`; the optimise decision is the same
 * function it uses.
 */
export function PostPicture({
  src,
  alt,
  width,
  height,
  sizes,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
}) {
  const [loaded, setLoaded] = useState(false);
  /* A picture the browser finished before React hydrated fires its `load`
     with no listener attached, so the element is asked on attach as well:
     already complete means already loaded, and it is shown sharp at once. */
  const settleIfComplete = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  const optimisable = isOptimisable(src);
  /* 32 is on the optimiser's default `imageSizes` ladder and 75 is its only
     permitted quality, so this URL is one the optimiser will answer. */
  const lowRes = optimisable ? `/_next/image?url=${encodeURIComponent(src)}&w=32&q=75` : null;
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading="lazy"
      quality={90}
      unoptimized={!optimisable}
      className="nf-pic"
      data-loaded={loaded ? "" : undefined}
      style={lowRes ? { backgroundImage: `url("${lowRes}")` } : undefined}
      ref={settleIfComplete}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
    />
  );
}
