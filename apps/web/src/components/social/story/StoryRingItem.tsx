"use client";

import { useMemo, useRef } from "react";
import { motionQuiet } from "@/lib/motion/gate";
import { startPhotoMorph } from "@/lib/motion/photo-morph";
import Link from "next/link";
import { initial } from "@/lib/text/initial";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { allSeen, ringGradient, ringWindow } from "./ring";
import { useSeenStories } from "./seen";

/**
 * One person's ring in the row under the location chip.
 *
 * The row stays a server component and ships no script for the pictures; only
 * this wrapper reads the device's seen list, because a seen ring is a fact
 * about this reader on this phone and nothing the server knows (see
 * `./seen`). The link goes to the person's newest story, as it always did.
 *
 * `storyIds` is every live story this person has, OLDEST first, so the ring
 * reads clockwise in the order they were told. Segments are drawn from the
 * ids, not from a number: a segment goes quiet when that exact story has been
 * opened.
 *
 * `seenWord` is said to a screen reader after the name, because a quiet
 * segment must never be the only way to learn a story was already opened.
 */
export function StoryRingItem({
  href,
  title,
  name,
  headline,
  imageUrl,
  storyIds,
  seenWord,
  viewerId,
}: {
  href: string;
  title: string;
  name: string;
  headline: string;
  imageUrl: string | null;
  storyIds: readonly string[];
  seenWord: string;
  /** The signed-in reader's id, or null; the seen list is kept per account. */
  viewerId: string | null;
}) {
  /* The server snapshot is "nothing opened", so the first paint is every ring
     lit, the same as the server drew, and the device's list takes over right
     after hydration with no flash. */
  const seenIds = useSeenStories(viewerId);
  /* The ring draws the newest six, so "all seen" is asked of those six too. */
  const flags = useMemo(() => ringWindow(storyIds.map((id) => seenIds.includes(id))), [storyIds, seenIds]);
  const done = allSeen(flags);

  /* THE PHOTO MORPH (round 5's listing flight, lent to stories): the tap
     names this disc, and the viewer aims the flight at its full-bleed
     picture when it commits, so the face grows into the story instead of the
     page cutting to it. A plain tap only; a new-tab click and reduced motion
     open as before. */
  const disc = useRef<HTMLSpanElement>(null);
  const storyId = href.startsWith("/stories/") ? href.slice("/stories/".length).split(/[?#]/)[0] : null;
  const onOpen = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!storyId || !disc.current || motionQuiet()) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    startPhotoMorph(storyMorphId(storyId), disc.current);
  };

  return (
    <Link href={href} className="nf-story-ring__item" title={title} onClick={onOpen}>
      <span
        ref={disc}
        className="nf-story-ring__disc nf-vt-morph"
        data-seen={done ? "all" : undefined}
        style={{ "--nf-ring": ringGradient(flags) } as React.CSSProperties}
      >
        {imageUrl ? (
          <RemoteImage src={imageUrl} alt="" width={128} height={128} sizes="64px" loading="lazy" />
        ) : (
          <span className="nf-story-ring__monogram" aria-hidden="true">
            {initial(title)}
          </span>
        )}
      </span>
      {/* The first name, as the render labels its rings; the whole name and
          the headline are read out. */}
      <span className="nf-story-ring__name" aria-hidden="true">
        {name}
      </span>
      <span className="sr-only">{title}</span>
      <span className="sr-only">: {headline}</span>
      {done ? <span className="sr-only">, {seenWord}</span> : null}
    </Link>
  );
}

/** The morph's name for a story, shared by the ring and the viewer. */
export function storyMorphId(storyId: string): string {
  return `story-${storyId}`;
}
