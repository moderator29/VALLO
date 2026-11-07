"use client";

import { useState } from "react";
import { banner } from "@/lib/ui/toast";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { iconPlateClass } from "@/components/ui/IconPlate";
import { placeCall } from "@/components/calls/place-call";
import { fill } from "@/lib/calls/screen";

/**
 * THE "LISTED BY" CARD'S CALL BUTTON, WHEN A CALL CAN ACTUALLY BE PLACED.
 *
 * Drawn by the page only when the `video_calls` switch is on, the reader is
 * signed in and a conversation about this listing already exists between
 * them: calls in Vallo belong to a conversation (VC1), so the listing's own
 * thread is the one this rings on. Everywhere else the card draws the plain
 * link to that conversation instead, which is the existing way to reach a
 * lister.
 *
 * The tap is the calls feature's own `placeCall`, one `tapKey` per tap, voice
 * only (a video call is one tap away inside the call). The database decides
 * whether the lister can be called; what it refuses comes back as its own
 * sentence under the card, with the calm "Calls open once they have replied"
 * when they have not written back yet.
 */
export type ListerCallCopy = {
  /** "Voice call {name}" (`calls.buttons.voiceWith`). */
  label: string;
  /** `calls.refusal.notEngagedTitle` and `notEngagedBody`. */
  notEngagedTitle: string;
  notEngagedBody: string;
  /** "{name} is on another call" (`calls.outgoing.busy`). */
  busy: string;
  /** "OK" (`calls.refusal.dismiss`). */
  dismiss: string;
};

export function ListerCallButton({
  conversationId,
  name,
  contextLine,
  copy,
}: {
  conversationId: string;
  /** The lister's name as the card shows it, for the label and the busy line. */
  name: string;
  /** The listing's title, carried to the call screen under the name. */
  contextLine: string;
  copy: ListerCallCopy;
}) {
  const [pending, setPending] = useState(false);

  /* Why a call did not ring is said by the one banner at the top of the
     screen (Grade 1), in the calls feature's own words. */
  const tap = async () => {
    if (pending) return;
    setPending(true);
    const result = await placeCall({ conversationId, kind: "AUDIO", context: { line: contextLine } });
    setPending(false);
    if (!result.ok) {
      if (result.refusal === "not_engaged") {
        banner.info(`${copy.notEngagedTitle}. ${copy.notEngagedBody}`, { "data-testid": "lister-call-note" });
      } else {
        banner.error(result.error, { "data-testid": "lister-call-note" });
      }
      return;
    }
    if (result.outcome === "busy") banner.info(fill(copy.busy, { name }), { "data-testid": "lister-call-note" });
  };

  return (
    <button
      type="button"
      className={iconPlateClass({ size: "md", tone: "solid", shape: "round", className: "nf-lister-act" })}
      aria-label={fill(copy.label, { name })}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() => void tap()}
      data-testid="lister-call"
      data-call="live"
    >
      <UiIcon name="phone" size={20} />
    </button>
  );
}
