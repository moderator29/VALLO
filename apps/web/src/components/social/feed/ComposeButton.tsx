"use client";

import { Button } from "@/components/ui/Button";

/** The window event the feed's create control (`CreateBloom`) answers. */
export const COMPOSE_POST_EVENT = "nf:compose-post";

/**
 * THE FEED'S OWN PLUS (founder, 7 October: "There is no + on the feed page").
 *
 * The dock's centre plus is the platform's create sheet, a different thing:
 * it offers a listing, a story, a review. This one does one job on the one
 * page it sits on, and opens the post composer at once. It is the platform's
 * primary blue button, glyph only, the 44px circle beside the place and the
 * search on the feed's own head row (`GOVERNING-feed-plus-bloom` draws the
 * feed's plus in blue).
 *
 * It asks rather than owns: the composer, its draft, the place picker and the
 * signed-out answer all already live in `CreateBloom`, which is mounted on
 * the same page (`AroundFab`) and listens for this event. One composer per
 * screen, two doors into it.
 */
export function ComposeButton({ label }: { label: string }) {
  return (
    <Button
      variant="primary"
      size="sm"
      iconOnly
      /* A pencil, the compose mark: no "+" anywhere (29 October 2026). */
      leadingIcon="pencil"
      className="nf-feed-compose"
      aria-label={label}
      data-testid="feed-compose"
      onClick={() => window.dispatchEvent(new CustomEvent(COMPOSE_POST_EVENT))}
    />
  );
}
