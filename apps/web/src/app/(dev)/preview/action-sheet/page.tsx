"use client";

import { useState } from "react";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { Button } from "@/components/ui/Button";

/**
 * The shared action sheet (handoff 6.3 part 2), with fixture rows only: the
 * head card, the round quick actions, the rows card and the Done bar, plus a
 * destructive row behind its confirm. Never real data.
 */
export default function ActionSheetDeck() {
  const [open, setOpen] = useState<"chat" | "listing" | null>(null);
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-lg p-gutter">
      <h1 className="nf-h2">Action sheet</h1>
      <div className="flex flex-wrap gap-sm">
        <Button variant="secondary" onClick={() => setOpen("chat")} data-testid="open-chat">
          A conversation
        </Button>
        <Button variant="secondary" onClick={() => setOpen("listing")} data-testid="open-listing">
          A listing card
        </Button>
      </div>

      <ActionSheet
        open={open === "chat"}
        onOpenChange={(next) => setOpen(next ? "chat" : null)}
        title="Actions for this chat"
        testId="deck-chat"
        head={{ name: "Adaeze O.", line: "Two bedroom flat, Lekki Phase 1", icon: "user", href: "#thread" }}
        quick={[
          { key: "open", label: "Open", icon: "chat-bubble", href: "#thread" },
          { key: "read", label: "Mark read", icon: "check" },
          { key: "pin", label: "Pin", icon: "bookmark" },
          { key: "mute", label: "Mute", icon: "mute", on: true },
        ]}
        rows={[
          { key: "archive", label: "Archive", sub: "It leaves your inbox. The other person still sees it.", icon: "archive" },
          {
            key: "delete",
            label: "Delete this chat",
            icon: "trash",
            danger: true,
            confirm: {
              title: "Delete this chat?",
              line: "It is removed for you only. Nothing you sent is unsent.",
              confirmLabel: "Delete",
              cancelLabel: "Keep it",
            },
          },
        ]}
        doneLabel="Done"
      />

      <ActionSheet
        open={open === "listing"}
        onOpenChange={(next) => setOpen(next ? "listing" : null)}
        title="Listing options"
        testId="deck-listing"
        head={{ name: "Serviced two bedroom with a generator", line: "N 2,400,000 a year", icon: "house", href: "#listing" }}
        quick={[
          { key: "save", label: "Save", icon: "heart", on: true },
          { key: "share", label: "Share", icon: "share" },
          { key: "compare", label: "Compare", icon: "scale" },
          { key: "message", label: "Message", icon: "chat-bubble", href: "#message" },
        ]}
        rows={[
          { key: "copy", label: "Copy link", icon: "link" },
          { key: "similar", label: "See similar nearby", icon: "search", chevron: true, href: "#similar" },
          { key: "hide", label: "Hide from my results", sub: "Hidden on this phone", icon: "eye-off" },
        ]}
        doneLabel="Done"
      />
    </main>
  );
}
