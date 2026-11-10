"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { useRequireAuth } from "@/components/auth/AuthGate";
import { Button } from "@/components/ui/Button";
import { IconPlate } from "@/components/ui/IconPlate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { SHARE_WORDS } from "@/lib/features/listing-share/model";
import { useLazySheet } from "@/lib/ui/lazy-sheet";

/* The sheet is its own chunk, fetched when the pointer or focus reaches the
   trigger and drawn once it has arrived, so no page carries it until a person
   reaches for it (and a public page never does). */
const loadPanel = () => import("./ShareToFeedSheet");
const ShareToFeedSheet = dynamic(() => import("./ShareToFeedSheet").then((m) => m.ShareToFeedSheet), { ssr: false });

/**
 * SHARE TO FEED (founder, 10 November 2026). A button, or a row inside a menu,
 * that opens the share sheet for one listing. Anyone signed in may share any
 * public, live listing; a guest is sent through sign-up and back.
 */
export function ShareToFeedButton({
  listingId,
  trigger = "button",
  size = "sm",
  onOpen,
}: {
  listingId: string;
  /** "button" is the labelled secondary button; "row" is a full-width menu row; "icon" a round icon. */
  trigger?: "button" | "row" | "icon";
  size?: "sm" | "md";
  /** Called when the sheet opens, so a host menu can stand aside. */
  onOpen?: () => void;
}) {
  const { requireAuth } = useRequireAuth();
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const sheet = useLazySheet(loadPanel);
  const pending = open && !sheet.ready;

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  function openSheet() {
    if (open) return;
    requireAuth("share", () => {
      onOpen?.();
      setOpen(true);
      setWanted(true);
      void sheet.warm().then((ok) => {
        if (!ok) setOpen(false);
      });
    });
  }

  return (
    <>
      {trigger === "row" ? (
        <button
          ref={opener}
          type="button"
          onClick={openSheet}
          {...sheet.warmProps}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-busy={pending || undefined}
          data-testid="share-to-feed"
          className="nf-share-row w-full text-left"
        >
          <IconPlate size="sm" className="shrink-0">
            <UiIcon name="feed" size={20} />
          </IconPlate>
          <span className="min-w-0 flex-1">
            <span className="block nf-body font-semibold text-[var(--nf-content-primary)]">{SHARE_WORDS.button}</span>
            <span className="block nf-caption text-[var(--nf-content-muted)]">{SHARE_WORDS.sheetIntro}</span>
          </span>
        </button>
      ) : (
        <Button
          ref={opener}
          type="button"
          variant={trigger === "icon" ? "icon" : "secondary"}
          size={size}
          {...(trigger === "icon" ? {} : { leadingIcon: "feed" as const })}
          onClick={openSheet}
          {...sheet.warmProps}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={trigger === "icon" ? SHARE_WORDS.buttonAria : undefined}
          loading={pending}
          data-testid="share-to-feed"
        >
          {trigger === "icon" ? <UiIcon name="feed" size={18} /> : SHARE_WORDS.button}
        </Button>
      )}
      {wanted && sheet.ready ? <ShareToFeedSheet open={open} onClose={close} listingId={listingId} /> : null}
    </>
  );
}
