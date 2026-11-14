"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n";
import { MessageMenu } from "@/components/app/messages/MessageMenu";
import { REACTION_EMOJI, type ReactionEmoji } from "@/lib/messages/reactions";

/** The message menu with every row it can draw, held open. Nothing it offers does anything here. */
export function MenuFixture({ words, bare }: { words: Dictionary["experienceInbox"]["thread"]["menu"]; bare: boolean }) {
  const [mine, setMine] = useState<ReactionEmoji | undefined>(REACTION_EMOJI[1]);
  const nothing = () => undefined;
  return (
    <MessageMenu
      words={words}
      canCopy
      canForward
      canDeleteEveryone
      onReply={nothing}
      onForward={nothing}
      onCopy={nothing}
      onSavePhoto={nothing}
      onDeleteForMe={nothing}
      onDeleteForEveryone={nothing}
      onClose={nothing}
      react={bare ? null : { ...(mine ? { mine } : {}), onPick: (emoji) => setMine(emoji === mine ? undefined : emoji) }}
    />
  );
}
