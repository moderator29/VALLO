"use client";

import { useState } from "react";
import { PasteChip } from "@/components/app/messages/PasteChip";
import { PASTE_WORDS } from "@/lib/paste/words";
import { overBy } from "@/lib/paste/parse";

const WALL = Array.from({ length: 20 }, (_, i) => `Line ${i + 1} of a long message somebody pasted in.`).join("\n");

/** Every chip the composers can hold, side by side. */
export function PasteDeck() {
  const [gone, setGone] = useState<string[]>([]);
  const show = (key: string) => !gone.includes(key);
  const drop = (key: string) => setGone((all) => [...all, key]);

  return (
    <div className="mt-md grid gap-sm">
      {show("text") && (
        <PasteChip
          kind="text"
          text={WALL}
          overBy={overBy(WALL, 2000)}
          onOpen={() => undefined}
          onRemove={() => drop("text")}
          words={PASTE_WORDS}
        />
      )}
      {show("over") && (
        <PasteChip
          kind="text"
          text={WALL.repeat(3)}
          overBy={overBy(WALL.repeat(3), 2000)}
          onOpen={() => undefined}
          onRemove={() => drop("over")}
          words={PASTE_WORDS}
        />
      )}
      {show("link") && (
        <PasteChip
          kind="link"
          host="example.com"
          path="/homes/a-flat-in-yaba"
          onRemove={() => drop("link")}
          words={{ ...PASTE_WORDS, remove: PASTE_WORDS.removeLink }}
        />
      )}
      {show("vallo") && (
        <PasteChip
          kind="link"
          host="vallospaces.com"
          path="/listing/abc-123"
          vallo="listing"
          onRemove={() => drop("vallo")}
          words={{ ...PASTE_WORDS, remove: PASTE_WORDS.removeLink }}
        />
      )}
    </div>
  );
}
