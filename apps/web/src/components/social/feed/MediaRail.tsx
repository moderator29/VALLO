"use client";

import { useRef, useState } from "react";
import type { PostMedia } from "./PostCard";
import { PostPicture } from "./PostPicture";

/**
 * MORE THAN ONE PICTURE: A RAIL, NEVER A CRAMPED GRID (the founder's feed set,
 * 7 October: "if someone wants to post more than 1, 2 or 3 things it should
 * be able to scroll sideways like that, clean UX smart and sharp").
 *
 * Each picture is a tall rounded card at about 80% of the card's width, with
 * the next one peeking at the edge so the reader can see there is more;
 * swiped sideways, snapping card by card. A small smoked-glass counter in the
 * corner says where you are ("2 / 3") and is announced politely. The rail
 * bleeds to the card's own edge so the peek is real, and it is a native
 * scroller, so it moves under the finger at the finger's speed on every
 * platform and Android's back gesture is untouched.
 *
 * Every card has its space before its bytes arrive (a fixed 4:5), and each
 * picture blurs up on its own (`PostPicture`).
 */
export function MediaRail({
  media,
  onOpen,
}: {
  media: PostMedia[];
  /** A tap on a picture. Optional: inside a post card the tap simply bubbles
      to the card, which opens the post (`PostCard`'s `openPost`). */
  onOpen?: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = media.length;

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.getBoundingClientRect().width + 8 : el.clientWidth;
    const next = Math.max(0, Math.min(count - 1, Math.round(Math.abs(el.scrollLeft) / Math.max(1, step))));
    if (next !== index) setIndex(next);
  };

  return (
    <div className="nf-post__rail">
      <div
        ref={scroller}
        className="nf-post__rail-track"
        onScroll={onScroll}
        onClick={onOpen}
        onAuxClick={onOpen}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${count} pictures on this post, swipe to see each`}
        tabIndex={0}
      >
        {media.map((picture, i) => (
          <PostPicture
            key={picture.url}
            src={picture.url}
            alt={`Picture ${i + 1} of ${count} on this post`}
            width={picture.width || 1200}
            height={picture.height || 1500}
            sizes="(max-width: 640px) 80vw, 480px"
          />
        ))}
      </div>
      <span className="nf-post__rail-count nf-numeric" aria-live="polite">
        {index + 1} / {count}
      </span>
      {/* The pager: one dot per picture, the one in view lit and wider. It is
          the eye's cue that the picture swipes, and it says nothing to a
          screen reader, which already hears the count above. */}
      <span className="nf-post__rail-dots" aria-hidden="true">
        {media.map((picture, i) => (
          <span key={picture.url} className="nf-post__rail-dot" data-on={i === index ? "" : undefined} />
        ))}
      </span>
    </div>
  );
}
