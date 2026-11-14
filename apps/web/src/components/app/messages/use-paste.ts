"use client";

import { useCallback, useMemo, useState, type ClipboardEvent } from "react";

import { banner } from "@/lib/ui/toast";
import {
  composeBody,
  isImage,
  overBy,
  readPastedText,
  sortPastedFiles,
  type PasteChip,
  type ValloLink,
} from "@/lib/paste/paste";
import { PASTE_WORDS } from "./paste-words";

/** The Vallo things a thread already draws as a card when their path is the whole message (`share.ts`). */
export type CardRef = { kind: "listing" | "stay" | "roommate"; id: string };

export function cardRefOf(link: ValloLink | null): CardRef | null {
  if (!link) return null;
  return link.kind === "listing" || link.kind === "stay" || link.kind === "roommate" ? { kind: link.kind, id: link.id } : null;
}

const MAX_CHIPS = 4;

/**
 * PASTE IN A COMPOSER, the same way in every one (founder, 14 November 2026).
 *
 * `onPaste` goes on the field. A pasted photo is handed to `onImages`, which
 * is the composer's own door for a PICKED photo, so it meets the same checks
 * and the same limits. A long text or a lone web address is held as a chip
 * (`PasteTray` draws them). Anything else is left alone and lands in the field
 * as it always did.
 *
 * Nothing is sent here. `split` gives the composer the one string to send
 * (typed words and held pastes together) through its own send, so the length
 * limit, the contact rules and the scam shield read it as typed text.
 */
export function usePaste(options: {
  /** The message's own length limit. */
  limit: number;
  /** The composer's door for a picked photo. Absent: this box takes words only. */
  onImages?: (files: File[]) => void;
  /** How many more photos the composer can hold right now. */
  imageRoom?: number;
  /** True where a Vallo listing, stay or room is sent as its own card message. */
  cards?: boolean;
}) {
  const { limit, onImages, imageRoom, cards = false } = options;
  const [chips, setChips] = useState<PasteChip[]>([]);

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const data = event.clipboardData;
      if (!data) return;
      const text = data.getData("text/plain");
      const files = Array.from(data.files ?? []);

      /* Words win over a picture of the same words (a spreadsheet or a
         document puts both on the clipboard). */
      if (text.trim().length === 0 && files.length > 0) {
        event.preventDefault();
        if (!onImages) {
          banner.warning(PASTE_WORDS.wordsOnly);
          return;
        }
        const sorted = sortPastedFiles(files, { takes: isImage, ...(imageRoom === undefined ? {} : { room: imageRoom }) });
        if (sorted.taken.length > 0) onImages(sorted.taken);
        if (sorted.refused.length > 0) banner.warning(PASTE_WORDS.photosOnly);
        else if (sorted.overflow > 0) banner.warning(PASTE_WORDS.photosFull);
        return;
      }

      const read = readPastedText(text, typeof window === "undefined" ? [] : [window.location.host]);
      if (read.kind === "plain") return;
      /* Past the tray's room a long paste lands in the field, which is where
         it always went: nothing is dropped. */
      if (chips.length >= MAX_CHIPS) return;
      event.preventDefault();
      const id = `paste-${Date.now().toString(36)}-${chips.length}`;
      setChips((prev) => [
        ...prev,
        read.kind === "long" ? { id, kind: "text", text: read.text } : { id, kind: "link", href: read.href, vallo: read.vallo },
      ]);
    },
    [chips.length, onImages, imageRoom],
  );

  const remove = useCallback((id: string) => setChips((prev) => prev.filter((chip) => chip.id !== id)), []);
  const edit = useCallback(
    (id: string, text: string) =>
      setChips((prev) =>
        text.trim().length === 0
          ? prev.filter((chip) => chip.id !== id)
          : prev.map((chip) => (chip.id === id && chip.kind === "text" ? { ...chip, text } : chip)),
      ),
    [],
  );
  const clear = useCallback(() => setChips([]), []);

  /** What a send carries: the text message, and the Vallo things that go as their own card. */
  const split = useCallback(
    (draft: string): { body: string; cards: CardRef[]; over: number } => {
      const asCards = cards ? chips.filter((chip) => chip.kind === "link" && cardRefOf(chip.vallo)) : [];
      const body = composeBody(draft, chips.filter((chip) => !asCards.includes(chip)));
      return {
        body,
        cards: asCards.map((chip) => cardRefOf((chip as Extract<PasteChip, { kind: "link" }>).vallo)!),
        over: overBy(body, limit),
      };
    },
    [chips, cards, limit],
  );

  return useMemo(
    () => ({ chips, onPaste, remove, edit, clear, split, limit, cards, held: chips.length > 0 }),
    [chips, onPaste, remove, edit, clear, split, limit, cards],
  );
}

export type PasteState = ReturnType<typeof usePaste>;
