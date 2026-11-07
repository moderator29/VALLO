"use client";

import { POST_COPY } from "@/lib/social/posts-model";
import { displayHost } from "@/lib/brand-domain";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";

/**
 * Share, floating on the cover beside the `…`.
 *
 * **Why this position is not a bookmark, settled here so it is not reopened.**
 * The reference board draws a bookmark in this corner. On Vallo a bookmark
 * already means one exact thing and has meant it since the day `saved_items`
 * shipped: keep this FLAT so I can find it again. The same glyph on a post is
 * a `post_reactions` row with the mark `SAVE`. Neither of those is a person.
 *
 * The thing a person is asking for when they reach for a bookmark on somebody's
 * page is "let me come back to them", and this product answers that with
 * Follow, which is one tap away on the same screen, writes a real row, has a
 * real list behind it at `/u/[handle]/following`, and tells the other person.
 * A second, private "saved people" pile would need its own table, its own
 * policy and its own screen to read it back, and until all three exist it is
 * half a feature wearing a familiar icon. So the corner carries the two things
 * that genuinely act on a page rather than on a person: send it to somebody,
 * and everything else.
 *
 * The Web Share API where the device has one, which on a phone is the sheet
 * people already know, and the clipboard everywhere else. A share control that
 * only works on a phone is one that most of a desktop audience finds broken.
 */
export function ProfileShare({
  handle,
  displayLabel,
}: {
  handle: string;
  displayLabel: string;
}) {
  const who = displayLabel || `@${handle}`;

  const share = () => {
    const url = `${window.location.origin}/u/${handle}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      void navigator.share({ title: who, url }).catch(() => {
        /* Cancelling a share sheet is not a failure and gets no message. */
      });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      banner.success(POST_COPY.copied);
      return;
    }
    /* No share sheet and no clipboard, which is an old browser on a hotel wifi
       rather than a hypothetical. The address is the thing being shared, so
       say it rather than failing silently. */
    banner.info(`The address is ${displayHost()}/u/${handle}`);
  };

  return (
    <button
      type="button"
      className="nf-social-round nf-btn--glass"
      aria-label={`Share ${who}`}
      onClick={share}
    >
      <UiIcon name="share" size={19} />
    </button>
  );
}
