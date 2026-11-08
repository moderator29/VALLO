"use client";

import { useEffect, useState } from "react";
import "@/app/css/calls.css";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { fill } from "@/lib/calls/screen";
import type { CallKind } from "@/lib/calls/types";
import { registerContext } from "./call-store";
import { placeCall } from "./place-call";
import type { CallsCopy } from "./views";
import { banner } from "@/lib/ui/toast";

/**
 * THE THREAD HEADER'S TWO CALL BUTTONS: voice and video, bare solid glyphs in
 * brand blue (D78: action icons are bare), 44px targets.
 *
 * Drawn only when the page found `video_calls` on and the reader is signed
 * in; the database refuses every call while it is off whatever a screen
 * draws. A tap mints its own `tapKey` (`placeCall`), so a double tap is one
 * call. What can come back, and what the reader sees:
 *
 *   ringing             the outgoing screen opens (the call surface)
 *   glare               they were already ringing you: THEIR call opens
 *   busy                "{name} is on another call", under the header
 *   not engaged         "Calls open once they have replied", with the reason
 *   blocked, barred,
 *   rate limited,
 *   switched off        the server's own sentence, under the header
 *
 * It also tells the call store what this thread is about, so the outgoing
 * screen, and an incoming call that arrives while this thread is open, can
 * carry the listing or business line under the name.
 */
export function CallButtons({
  conversationId,
  name,
  contextLine,
  copy,
}: {
  conversationId: string;
  name: string;
  contextLine?: string | null;
  copy: CallsCopy;
}) {
  const [pending, setPending] = useState<CallKind | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => registerContext(conversationId, { line: contextLine ?? null }), [conversationId, contextLine]);

  const tap = async (kind: CallKind) => {
    if (pending) return;
    setPending(kind);
    const result = await placeCall({ conversationId, kind, context: { line: contextLine ?? null } });
    setPending(null);
    /* A call that could not start is said by the one banner at the top of
       the screen (founder, 7 November 2026); it was a note beside the buttons. */
    if (!result.ok) {
      if (result.refusal === "not_engaged") {
        banner.info(`${copy.refusal.notEngagedTitle}. ${copy.refusal.notEngagedBody}`, { "data-testid": "thread-call-note" });
      } else {
        banner.error(result.error, { retry: () => void tap(kind), "data-testid": "thread-call-note" });
      }
      return;
    }
    if (result.outcome === "busy") banner.info(fill(copy.outgoing.busy, { name }), { "data-testid": "thread-call-note" });
  };

  return (
    <span className="nf-call-buttons">
      <button
        type="button"
        className="nf-thread__call"
        aria-label={fill(copy.buttons.voice, { name })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={pending !== null}
        onClick={() => setMenuOpen((open) => !open)}
        data-testid="thread-call"
      >
        <UiIcon name="phone" size={22} />
      </button>
      {menuOpen ? (
        <>
          <button type="button" className="nf-call-menu__scrim" aria-label="Close" onClick={() => setMenuOpen(false)} />
          <span role="menu" className="nf-call-menu" data-testid="thread-call-menu">
            <button
              type="button"
              role="menuitem"
              className="nf-call-menu__item"
              aria-busy={pending === "AUDIO" || undefined}
              onClick={() => {
                setMenuOpen(false);
                void tap("AUDIO");
              }}
              data-testid="thread-call-voice"
            >
              <UiIcon name="phone" size={18} />
              <span>{copy.buttons.voice}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="nf-call-menu__item"
              aria-busy={pending === "VIDEO" || undefined}
              onClick={() => {
                setMenuOpen(false);
                void tap("VIDEO");
              }}
              data-testid="thread-call-video"
            >
              <UiIcon name="video" size={18} />
              <span>{copy.buttons.video}</span>
            </button>
          </span>
        </>
      ) : null}
    </span>
  );
}
