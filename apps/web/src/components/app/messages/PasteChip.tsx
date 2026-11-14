"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { firstLines } from "@/lib/paste/parse";

/**
 * WHAT A PASTE BECOMES ABOVE THE FIELD (founder, 14 November 2026, from the
 * Claude composer's chips: a type tag, the first lines of the text, and a
 * round close button, while the field itself stays empty and usable).
 *
 * Vallo's own look, not that app's: the chip is a CONTROL (it has a close
 * button and opens when tapped), so it keeps the control radius rather than
 * the confirmation pill's capsule. One chip language for both kinds:
 *
 *   TEXT  a wall of words held out of the field, with its length, and, when
 *         it is over the message's own limit, by how much.
 *   LINK  one address, as its host and path. NO PREVIEW IS EVER FETCHED
 *         (`components/app/messages/linkify.ts` says why: reading a
 *         stranger's address from Vallo's servers is a door this platform
 *         does not open). A Vallo address is drawn as that thing's own card
 *         by the composer instead, from Vallo's own data.
 */
export function PasteChip({
  kind,
  text,
  host,
  path,
  vallo,
  overBy,
  onOpen,
  onRemove,
  words,
}: {
  kind: "text" | "link";
  /** The whole pasted text, for the TEXT chip's face and its length. */
  text?: string;
  host?: string;
  path?: string;
  /**
   * The Vallo thing this address names, when it is one of ours. It is read
   * from the ADDRESS ALONE (`valloLinkOf`), never fetched: a chip that says
   * "Listing on Vallo" tells the person Vallo recognised it without any
   * request going out, and the message itself carries the link, which the
   * thread draws from Vallo's own data once sent.
   */
  vallo?: "listing" | "stay" | "restaurant" | "profile" | "post" | null;
  /** Characters over the message's own limit, 0 when it fits. */
  overBy?: number;
  /** Open it to read and edit. A link chip has nothing to open. */
  onOpen?: () => void;
  onRemove: () => void;
  words: {
    textTag: string;
    linkTag: string;
    characters: string;
    over: string;
    open: string;
    remove: string;
  };
}) {
  const face = kind === "text" ? firstLines(text ?? "") : `${host ?? ""}${path ?? ""}`;
  const VALLO_WORD: Record<string, string> = {
    listing: "Listing on Vallo",
    stay: "Stay on Vallo",
    restaurant: "Restaurant on Vallo",
    profile: "Profile on Vallo",
    post: "Post on Vallo",
  };
  const count = (text ?? "").length;
  const over = overBy ?? 0;
  const detail =
    kind === "text"
      ? over > 0
        ? words.over.replace("{n}", String(over))
        : words.characters.replace("{n}", count.toLocaleString("en"))
      : vallo
        ? (VALLO_WORD[vallo] ?? (host ?? ""))
        : (host ?? "");

  return (
    <div
      className="nf-paste"
      data-kind={kind}
      data-vallo={vallo ?? undefined}
      data-over={over > 0 ? "" : undefined}
      data-testid="paste-chip"
    >
      {onOpen ? (
        <button type="button" className="nf-paste__face" onClick={onOpen} aria-label={words.open}>
          <ChipFace kind={kind} tag={kind === "text" ? words.textTag : words.linkTag} face={face} detail={detail} />
        </button>
      ) : (
        <span className="nf-paste__face nf-paste__face--still">
          <ChipFace kind={kind} tag={kind === "text" ? words.textTag : words.linkTag} face={face} detail={detail} />
        </span>
      )}
      <button type="button" className="nf-paste__drop" onClick={onRemove} aria-label={words.remove}>
        <UiIcon name="close" size={14} />
      </button>
    </div>
  );
}

function ChipFace({ kind, tag, face, detail }: { kind: "text" | "link"; tag: string; face: string; detail: string }) {
  return (
    <>
      <span className="nf-paste__tag" aria-hidden="true">
        {kind === "link" ? <UiIcon name="link" size={12} /> : null}
        {tag}
      </span>
      <span className="nf-paste__text">
        <span className="nf-paste__lines">{face}</span>
        <span className="nf-paste__detail">{detail}</span>
      </span>
    </>
  );
}
