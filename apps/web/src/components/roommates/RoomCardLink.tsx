"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import { motionQuiet } from "@/lib/motion/gate";
import { startPhotoMorph } from "@/lib/motion/photo-morph";

/**
 * THE ROOM CARD'S STRETCHED LINK, WHICH NAMES ITS PHOTO ON THE WAY OUT.
 *
 * The room card is server drawn; only this one link is a client island, so the
 * whole kit stays on the server. On a plain left tap it measures and names the
 * card's photo box (`[data-morph-id]` in the same card), and the room's gallery
 * answers to the same name as it commits (`aimPhotoMorph` in Gallery.tsx). The
 * browser then flies that one photograph from the card into the hero on the
 * compositor, the way a listing opens (lib/motion/photo-morph.ts).
 *
 * The name is lent on tap only, never kept, so a room shown twice on a screen is
 * never a duplicate name (which would abort the transition). A modified click, a
 * middle click or a quiet-motion reader gets the ordinary navigation and no name.
 */
export function RoomCardLink({
  id,
  href,
  className,
  children,
}: {
  id: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (motionQuiet()) return;
    const media = event.currentTarget.closest(".nf-rm-card")?.querySelector<HTMLElement>("[data-morph-id]") ?? null;
    if (!media) return;
    startPhotoMorph(id, media);
  };
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
