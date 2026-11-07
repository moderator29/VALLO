"use client";

import Link from "next/link";
import { useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { passcodeOfferCookieString } from "./passcode-offer";

/**
 * The alert itself: a slim, full-width card with a lock tile, one line of
 * why, "Set up", and an X. The X writes the 60-day cookie and the card leaves
 * at once (with a short fade where motion is allowed, `nf-pc-offer--leaving`).
 */
export function PasscodeOfferCard({
  title,
  body,
  action,
  dismiss,
}: {
  title: string;
  body: string;
  action: string;
  dismiss: string;
}) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <aside className="nf-pc-offer" data-testid="passcode-offer" aria-label={title}>
      <span className="nf-pc-offer__tile" aria-hidden="true">
        <UiIcon name="shield-lock" size={20} />
      </span>
      <div className="nf-pc-offer__text">
        <p className="nf-pc-offer__title">{title}</p>
        <p className="nf-pc-offer__body">{body}</p>
        <Link href="/settings/passcode" className="nf-pc-offer__action" data-testid="passcode-offer-setup">
          {action}
        </Link>
      </div>
      <button
        type="button"
        className="nf-pc-offer__close"
        aria-label={dismiss}
        data-testid="passcode-offer-close"
        onClick={() => {
          try {
            document.cookie = passcodeOfferCookieString(window.location.protocol === "https:");
          } catch {
            /* A refused cookie only means it may be offered again. */
          }
          setGone(true);
        }}
      >
        <UiIcon name="close" size={16} />
      </button>
    </aside>
  );
}
