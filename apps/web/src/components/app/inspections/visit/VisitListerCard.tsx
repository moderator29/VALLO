"use client";

import { banner } from "@/lib/ui/toast";
import Link from "next/link";
import { useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { VerifiedAvatar } from "@/components/messages/VerifiedAvatar";
import { placeCall } from "@/components/calls/place-call";
import type { VisitLister } from "@/lib/inspections/visit";
import type { Dictionary } from "@vallo/i18n/core";

/**
 * WHO THE VISIT IS WITH: photo, name, the published badge, the role word, and
 * two round monochrome controls, message and call.
 *
 * MESSAGE is the listing's own thread (`/messages/new?listing=`, which finds
 * the thread before it makes one, or the visit's thread once there is one).
 * A listing enquiry is the door every listing opens; `contact_policy` governs
 * direct chats between members and is not touched here, so this never links
 * to a member's direct message screen.
 *
 * CALL is one of two things and never invents a third:
 *   tel   the lister's number, handed over only to a party of the visit by
 *         `callableNumbersFor` (a block either way, or any failure, is none)
 *   app   a voice call on Vallo into the existing thread, when `video_calls`
 *         is on; the database refuses a call to somebody who has not replied
 *         yet, and that refusal is said under the card
 * With neither, no call control is drawn.
 */
export type ListerCall = { kind: "tel"; number: string } | { kind: "app"; conversationId: string } | null;

export function VisitListerCard({
  lister,
  roleLabel,
  messageHref,
  call,
  copy,
}: {
  lister: VisitLister;
  roleLabel: string | null;
  messageHref: string | null;
  call: ListerCall;
  copy: Dictionary["visit"]["lister"];
}) {
  const [calling, setCalling] = useState(false);
  const name = lister.name ?? copy.fallbackName;

  async function callInApp(conversationId: string) {
    if (calling) return;
    setCalling(true);
    try {
      /* A call that could not be placed is said by the one banner (Grade 1). */
      const placed = await placeCall({ conversationId, kind: "AUDIO", context: { line: null } });
      if (!placed.ok) banner.error(placed.error, { retry: () => void callInApp(conversationId) });
    } finally {
      setCalling(false);
    }
  }

  return (
    <section className="nf-panel nf-panel--card" aria-label={copy.heading} data-testid="visit-lister">
      <div className="nf-visit-lister">
        <VerifiedAvatar name={name} tier={lister.tier} size="lg" {...(lister.photoUrl ? { photoUrl: lister.photoUrl } : {})} />
        <div className="nf-visit-lister__text">
          <p className="nf-visit-lister__name">
            <span>{name}</span>
          </p>
          {roleLabel ? <p className="nf-visit-lister__role">{roleLabel}</p> : null}
        </div>
        <div className="nf-visit-lister__actions">
          {messageHref ? (
            <Link
              href={messageHref}
              className="nf-visit-round nf-tap"
              aria-label={copy.message.replace("{name}", name)}
              title={copy.message.replace("{name}", name)}
              data-testid="visit-lister-message"
            >
              <UiIcon name="chat-bubble" size={20} />
            </Link>
          ) : null}
          {call?.kind === "tel" ? (
            <a
              href={`tel:${call.number}`}
              className="nf-visit-round nf-tap"
              aria-label={copy.call.replace("{name}", name)}
              title={copy.call.replace("{name}", name)}
              data-testid="visit-lister-call"
            >
              <UiIcon name="phone" size={20} />
            </a>
          ) : call?.kind === "app" ? (
            <button
              type="button"
              className="nf-visit-round nf-tap"
              aria-label={copy.callInApp.replace("{name}", name)}
              title={copy.callInApp.replace("{name}", name)}
              aria-busy={calling || undefined}
              disabled={calling}
              onClick={() => void callInApp(call.conversationId)}
              data-testid="visit-lister-call"
            >
              <UiIcon name="phone" size={20} />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
