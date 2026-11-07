"use client";

import { Button } from "@/components/ui/Button";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { initial } from "@/lib/text/initial";

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
export function ComposeButton({
  label,
  prompt,
  you = null,
  actions,
}: {
  label: string;
  /** The words on the feed's compose entry. Given, the control is the quiet
      one-line entry under the stories (your face, the invitation, the pencil)
      rather than the bare pencil disc; it is still one tap into the same
      composer, so nothing about posting changes but where the eye finds it. */
  prompt?: string;
  you?: { label: string; avatarUrl: string } | null;
  /** The doors at the line's right (the feed reference): a photo and a post.
      Each opens the same composer, whose photo control is one tap inside.
      Video and a featured listing join here only once the composer can carry
      them, so no door on this line leads nowhere. */
  actions?: { photo: string; send: string };
}) {
  const open = () => window.dispatchEvent(new CustomEvent(COMPOSE_POST_EVENT));
  if (prompt) {
    return (
      <div className="nf-feed-prompt" data-testid="feed-compose-row">
        <button type="button" className="nf-feed-prompt__main" aria-label={label} data-testid="feed-compose" onClick={open}>
          <span className="nf-feed-prompt__face" aria-hidden="true">
            {you?.avatarUrl ? (
              <RemoteImage src={you.avatarUrl} alt="" width={72} height={72} sizes="36px" loading="lazy" />
            ) : you?.label ? (
              <span className="nf-feed-prompt__monogram">{initial(you.label)}</span>
            ) : (
              <UiIcon name="pencil" size={18} />
            )}
          </span>
          <span className="nf-feed-prompt__words" aria-hidden="true">
            {prompt}
          </span>
        </button>
        {actions ? (
          <span className="nf-feed-prompt__doors">
            <button type="button" className="nf-tap nf-feed-prompt__door" aria-label={actions.photo} onClick={open} data-testid="feed-compose-photo">
              <UiIcon name="picture" size={20} />
            </button>
            <button type="button" className="nf-tap nf-feed-prompt__door" aria-label={actions.send} onClick={open} data-testid="feed-compose-send">
              <UiIcon name="send" size={20} />
            </button>
          </span>
        ) : (
          <span className="nf-feed-prompt__pic" aria-hidden="true">
            <UiIcon name="picture" size={20} />
          </span>
        )}
      </div>
    );
  }
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
      onClick={open}
    />
  );
}
