"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON } from "@/components/app/Screen";
import { hintsFromGaps, readDismissed, writeDismissed, type GapKey, type HintKey } from "@/lib/messages/hints";

/**
 * CHAT HINTS, above a renter's composer in a listing thread.
 *
 * One small dismissible card ("You may want to ask" and one line) and up to
 * three quick reply chips, both worked out by `lib/messages/hints.ts` from what
 * the listing itself leaves out. The page decides WHETHER to draw this at all
 * (renter side, listing thread only) and hands over the gaps; this file draws
 * them and keeps the dismissal.
 *
 * A QUESTION CHIP ONLY FILLS THE COMPOSER. It calls `onFill` with a polite
 * sentence in the reader's language and puts the cursor in the field, so the
 * person can edit it. Nothing is sent here, and nothing is sent until they
 * press send. The visit chip is a link to the visit flow.
 *
 * The card sits below any warning in the thread and collapses while the
 * keyboard is open (the visual viewport shrinks, or the composer has focus),
 * so it never crowds the field on a small phone. The chip row scrolls sideways.
 */

export type ChatHintsData = {
  /** The listing's gaps, in priority order (`listingGaps`). */
  gaps: GapKey[];
  /** An inspection is open on this thread, so no visit is offered. */
  visitOpen: boolean;
  /** Where the visit chip goes: `/listing/[id]/visit`. */
  visitHref: string;
};

type Copy = Dictionary["chatHints"];

const COMPOSER_ID = "thread-input";

/** True while the keyboard is probably open: the viewport shrank, or the composer has focus. */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const check = () => {
      const shrunk = viewport ? window.innerHeight - viewport.height > 120 : false;
      const active = document.activeElement;
      setOpen(shrunk || (active instanceof HTMLElement && active.id === COMPOSER_ID));
    };
    /* `focusout` fires before the active element changes. */
    const afterBlur = () => window.setTimeout(check, 0);
    check();
    viewport?.addEventListener("resize", check);
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", afterBlur);
    return () => {
      viewport?.removeEventListener("resize", check);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", afterBlur);
    };
  }, []);
  return open;
}

function lineOf(copy: Copy, key: HintKey): { label: string; line: string } {
  if (key === "visit") return { label: copy.visit.label, line: copy.visit.line };
  return { label: copy.label, line: copy.gaps[key].line };
}

export function ChatHints({
  conversationId,
  data,
  copy,
  onFill,
}: {
  conversationId: string;
  data: ChatHintsData;
  copy: Copy;
  /** Puts a sentence in the composer. Never sends. */
  onFill: (text: string) => void;
}) {
  /* Null until the browser's storage has been read, so a hint the reader
     already dismissed is never drawn for a frame and taken back. */
  const [dismissed, setDismissed] = useState<ReadonlySet<string> | null>(null);
  /* Closing the card holds for this visit even where storage is unavailable.
     The next undismissed hint waits for the next visit rather than replacing
     the one just closed. */
  const [closed, setClosed] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  useEffect(() => {
    setDismissed(readDismissed(conversationId));
    setClosed(false);
  }, [conversationId]);

  const { hint, chips } = hintsFromGaps(data.gaps, data.visitOpen, dismissed ?? new Set());
  const showCard = hint !== null && dismissed !== null && !closed && !keyboardOpen;

  /* No manual memo: `hint` is a fresh object from `hintsFromGaps` on every
     render, so a useCallback keyed on it could never hold, and the React
     Compiler memoises this function itself. */
  const dismiss = () => {
    if (hint === null) return;
    setDismissed(writeDismissed(conversationId, hint));
    setClosed(true);
  };

  const fill = useCallback(
    (key: GapKey) => {
      onFill(copy.gaps[key].text);
      /* Put the cursor where the sentence is, so it can be edited. */
      try {
        document.getElementById(COMPOSER_ID)?.focus();
      } catch {
        /* A field that cannot take focus is still filled. */
      }
    },
    [copy, onFill],
  );

  if (!showCard && chips.length === 0) return null;

  const words = hint !== null ? lineOf(copy, hint) : null;

  return (
    <section aria-label={copy.region} className="px-md pb-xs" data-testid="chat-hints">
      {showCard && words ? (
        <div className="nf-chat-hint" role="note" data-testid="chat-hint" data-hint={hint}>
          <span className="nf-chat-hint__icon" aria-hidden="true">
            <UiIcon name="info" size={ICON.inline} />
          </span>
          <p className="nf-chat-hint__body">
            <span className="nf-chat-hint__label">{words.label}</span>
            <span className="nf-chat-hint__line">{words.line}</span>
          </p>
          <Button
            variant="icon"
            leadingIcon="close"
            aria-label={copy.dismiss}
            onClick={dismiss}
            className="shrink-0"
            data-testid="chat-hint-dismiss"
          />
        </div>
      ) : null}
      {chips.length > 0 ? (
        <div className={showCard ? "mt-xs" : undefined}>
          <ChipRow bleed={false}>
            {chips.map((key) =>
              key === "visit" ? (
                <Chip
                  key={key}
                  behaviour="link"
                  href={data.visitHref}
                  icon="calendar-clock"
                  data-testid="chat-chip-visit"
                >
                  {copy.visit.chip}
                </Chip>
              ) : (
                <Chip key={key} onSelectedChange={() => fill(key)} data-testid={`chat-chip-${key}`}>
                  {copy.gaps[key].chip}
                </Chip>
              ),
            )}
          </ChipRow>
        </div>
      ) : null}
    </section>
  );
}
