"use client";

import { useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { TextArea } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { chipPreview, linkParts, type PasteChip } from "@/lib/paste/paste";
import { PASTE_WORDS, count, fillCount } from "./paste-words";
import { cardRefOf, type PasteState } from "./use-paste";
import "./paste-tray.css";

/**
 * WHAT WAS PASTED, HELD ABOVE THE FIELD (founder, 14 November 2026).
 *
 * A long pasted text is a chip, not a wall: a TEXT tag, its first two lines,
 * its length and a way out, and a tap opens it to read and edit. A pasted web
 * address is a LINK chip showing where it goes, in the address's own words.
 * NOTHING IS FETCHED for it (`linkify.ts` says why: reading a stranger's
 * address from Vallo's servers is a door this platform does not open). One of
 * Vallo's own pages says what it is, and in a thread it is sent as that
 * thing's own card, which the thread reads from Vallo's own data.
 *
 * The tray never says where a paste came from. No app is told that.
 */
export function PasteTray({ paste, over = 0 }: { paste: PasteState; /** How far the whole message is over its limit. */ over?: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (paste.chips.length === 0) return null;
  const open = paste.chips.find((chip) => chip.id === openId && chip.kind === "text") as Extract<PasteChip, { kind: "text" }> | undefined;

  return (
    <>
      <ul className="nf-paste" aria-label={PASTE_WORDS.trayLabel} data-testid="paste-tray">
        {paste.chips.map((chip) =>
          chip.kind === "text" ? (
            <li key={chip.id} className="nf-paste__chip" data-kind="text" data-over={over > 0 ? "" : undefined} data-testid="paste-chip-text">
              <button
                type="button"
                className="nf-paste__body"
                aria-label={fillCount(PASTE_WORDS.openText, chip.text.length)}
                onClick={() => {
                  setDraft(chip.text);
                  setOpenId(chip.id);
                }}
              >
                <span className="nf-paste__tag">{PASTE_WORDS.textTag}</span>
                <span className="nf-paste__lines">{chipPreview(chip.text)}</span>
                <span className="nf-paste__meta nf-numeric">
                  {over > 0 ? fillCount(PASTE_WORDS.over, over) : fillCount(PASTE_WORDS.characters, chip.text.length)}
                </span>
              </button>
              <CloseButton label={PASTE_WORDS.removeText} onClick={() => paste.remove(chip.id)} />
            </li>
          ) : (
            <LinkChip key={chip.id} chip={chip} cards={paste.cards} onRemove={() => paste.remove(chip.id)} />
          ),
        )}
      </ul>
      <Sheet
        open={Boolean(open)}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        title={PASTE_WORDS.sheetTitle}
        description={PASTE_WORDS.sheetHint}
        apply={{
          label: PASTE_WORDS.done,
          onClick: () => {
            if (openId) paste.edit(openId, draft);
            setOpenId(null);
          },
        }}
        testId="paste-sheet"
      >
        <TextArea
          label={PASTE_WORDS.sheetLabel}
          hideLabel
          rows={12}
          value={draft}
          maxLength={paste.limit}
          onChange={(event) => setDraft(event.target.value)}
          enterKeyHint="enter"
          autoCapitalize="sentences"
          data-testid="paste-sheet-field"
        />
      </Sheet>
    </>
  );
}

function LinkChip({ chip, cards, onRemove }: { chip: Extract<PasteChip, { kind: "link" }>; cards: boolean; onRemove(): void }) {
  const { host, path } = linkParts(chip.href);
  const asCard = cards && cardRefOf(chip.vallo) !== null;
  return (
    <li className="nf-paste__chip" data-kind={chip.vallo ? "vallo" : "link"} data-testid="paste-chip-link">
      <span className="nf-paste__body">
        <span className="nf-paste__tag">{chip.vallo ? PASTE_WORDS.valloTag : PASTE_WORDS.linkTag}</span>
        <span className="nf-paste__lines nf-paste__lines--strong">{chip.vallo ? PASTE_WORDS.vallo[chip.vallo.kind] : host}</span>
        <span className="nf-paste__meta">{asCard ? PASTE_WORDS.sendsAsCard : chip.vallo ? chip.vallo.path : path || host}</span>
      </span>
      <CloseButton label={PASTE_WORDS.removeLink} onClick={onRemove} />
    </li>
  );
}

function CloseButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className="nf-paste__close" aria-label={label} onClick={onClick} data-testid="paste-chip-remove">
      <span className="nf-paste__close-disc" aria-hidden="true">
        <UiIcon name="close" size={14} />
      </span>
    </button>
  );
}

/** Several photos waiting to be sent, each with its own way out. */
export function PastedPhotos({ photos, onRemove }: { photos: { url: string }[]; onRemove(index: number): void }) {
  if (photos.length === 0) return null;
  return (
    <ul className="nf-paste__photos" data-testid="pending-photos" aria-label={`${count(photos.length)} photos ready to send`}>
      {photos.map((photo, index) => (
        <li key={photo.url} className="nf-paste__photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={`Photo ${index + 1} of ${photos.length}, ready to send`} />
          <CloseButton label={PASTE_WORDS.removePhoto} onClick={() => onRemove(index)} />
        </li>
      ))}
    </ul>
  );
}
