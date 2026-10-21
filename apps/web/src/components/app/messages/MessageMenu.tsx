"use client";

/**
 * The message menu: opened by a long press on a bubble (or a right click on
 * the web). It holds the actions a person can take on ONE message, and only
 * the ones that apply to it:
 *
 *   Reply                 always, on a message that has been sent
 *   Forward               a sent message with words; never a photo (the
 *                         database refuses one). It opens the chooser of
 *                         conversations (`ForwardSheet`)
 *   Copy                  when the message has words
 *   Delete for me         always, on your side only
 *   Delete for everyone   only on your own messages; the window is decided by
 *                         the database, and a refused delete says why
 *
 * A swipe on the bubble is the other way to Reply (`BubbleGestures`).
 */

import { useEffect } from "react";
import type { Dictionary } from "@vallo/i18n/core";

export type MessageMenuProps = {
  /** The menu's words (`experienceInbox.thread.menu`). */
  words: Dictionary["experienceInbox"]["thread"]["menu"];
  canCopy: boolean;
  canDeleteEveryone: boolean;
  /** Draws Forward. False for a photo, a deleted message or one still sending. */
  canForward?: boolean;
  onReply: () => void;
  onForward?: () => void;
  onCopy: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onClose: () => void;
};

export function MessageMenu({
  words,
  canCopy,
  canDeleteEveryone,
  canForward = false,
  onReply,
  onForward,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}: MessageMenuProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className="nf-msg-menu__scrim" aria-label={words.close} onClick={onClose} />
      <div role="menu" aria-label={words.label} className="nf-msg-menu" data-testid="message-menu">
        <button type="button" role="menuitem" className="nf-msg-menu__item" onClick={onReply}>
          {words.reply}
        </button>
        {canForward && onForward ? (
          <button type="button" role="menuitem" className="nf-msg-menu__item" onClick={onForward}>
            {words.forward}
          </button>
        ) : null}
        {canCopy ? (
          <button type="button" role="menuitem" className="nf-msg-menu__item" onClick={onCopy}>
            {words.copy}
          </button>
        ) : null}
        <button type="button" role="menuitem" className="nf-msg-menu__item" onClick={onDeleteForMe}>
          {words.deleteForMe}
        </button>
        {canDeleteEveryone ? (
          <button
            type="button"
            role="menuitem"
            className="nf-msg-menu__item nf-msg-menu__item--danger"
            onClick={onDeleteForEveryone}
          >
            {words.deleteForEveryone}
          </button>
        ) : null}
      </div>
    </>
  );
}
