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
 *
 * GRADE 1 (P1.3): above the actions, the eight reactions in one row
 * (`lib/messages/reactions.ts`). The reader's own is marked; choosing it
 * again takes it away, choosing another replaces it. Drawn only when the
 * thread can react at all (`react`), so a database without reactions offers
 * no row that cannot work.
 */

import { useEffect } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { REACTION_EMOJI, REACTION_NAMES, type ReactionEmoji } from "@/lib/messages/reactions";

/* GRADE 1 (P1.3): English only for now; the menu's dictionary has no word for the row yet. */
const REACT_WORDS = { label: "React to this message", yours: "{name}, your reaction. Tap to remove it" };
const SAVE_PHOTO_WORDS = "Save photo";

export type MessageMenuProps = {
  /** The menu's words (`experienceInbox.thread.menu`). */
  words: Dictionary["experienceInbox"]["thread"]["menu"];
  canCopy: boolean;
  canDeleteEveryone: boolean;
  /** Draws Forward. False for a photo, a deleted message or one still sending. */
  canForward?: boolean;
  /** Saves the first photo in the message to the device. */
  onSavePhoto?: () => void;
  onReply: () => void;
  onForward?: () => void;
  onCopy: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onClose: () => void;
  /** The reaction row: the reader's current reaction and what a choice does. Absent draws no row. */
  react?: { mine?: ReactionEmoji; onPick: (emoji: ReactionEmoji) => void } | null;
};

export function MessageMenu({
  words,
  canCopy,
  canDeleteEveryone,
  canForward = false,
  onSavePhoto,
  onReply,
  onForward,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
  react = null,
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
        {react ? (
          <div role="group" aria-label={REACT_WORDS.label} className="nf-msg-menu__reactions" data-testid="reaction-row">
            {REACTION_EMOJI.map((emoji) => {
              const mine = react.mine === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={mine}
                  aria-label={mine ? REACT_WORDS.yours.replace("{name}", REACTION_NAMES[emoji]) : REACTION_NAMES[emoji]}
                  className="nf-msg-menu__emoji"
                  data-mine={mine || undefined}
                  onClick={() => react.onPick(emoji)}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              );
            })}
          </div>
        ) : null}
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
        {onSavePhoto ? (
          <button type="button" role="menuitem" className="nf-msg-menu__item" onClick={onSavePhoto}>
            {SAVE_PHOTO_WORDS}
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
