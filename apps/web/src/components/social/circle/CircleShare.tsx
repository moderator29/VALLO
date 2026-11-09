"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { ShareButton, type ShareCopy } from "@/components/share/ShareSheet";
import type { ShareSubject } from "@/components/share/ShareComposer";

/**
 * Share a Circle discussion or question as a Vallo card
 * (SHARE_AND_CONTROLS.md section 1): the post's title, its community and the
 * short `/circle/p/<id>` link. Public fields only.
 */
export function CircleShareButton({ subject, copy, label }: { subject: ShareSubject; copy: ShareCopy; label: string }) {
  return (
    <ShareButton subject={subject} copy={copy}>
      {(open) => (
        <button type="button" className="nf-social-round nf-btn--glass" aria-label={label} onClick={open} data-testid="circle-share">
          <UiIcon name="share" size={19} />
        </button>
      )}
    </ShareButton>
  );
}
