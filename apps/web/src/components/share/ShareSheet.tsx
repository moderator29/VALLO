"use client";

import { useState, type ReactNode } from "react";

import { Sheet } from "@/components/ui/Sheet";

import { ShareComposer, type ShareBackground, type ShareSubject } from "./ShareComposer";

export type ShareCopy = { title: string; share: string; background: string; stats: string; name: string; copied: string; yours?: string; presets?: string; darken?: string };

/**
 * THE SHARE COMPOSER IN A BOTTOM SHEET (9 November 2026, SHARE_AND_CONTROLS.md
 * section 1). A real Share control opens this rather than the bare OS sheet:
 * the member builds the card (background, what shows, which lead), then Share
 * hands the short link to the system sheet or the clipboard. `ShareButton`
 * owns the trigger and the open state; `ShareSheet` is the controlled sheet
 * for a caller that already has its own trigger.
 */
export function ShareSheet({
  open,
  onOpenChange,
  subject,
  backgrounds,
  copy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: ShareSubject;
  backgrounds?: ShareBackground[];
  copy: ShareCopy;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={copy.title} detents={[0.92]} testId="share-sheet">
      <ShareComposer subject={subject} backgrounds={backgrounds} copy={copy} />
    </Sheet>
  );
}

/** The trigger and the sheet together: a caller renders `trigger` and we own the rest. */
export function ShareButton({
  subject,
  backgrounds,
  copy,
  children,
}: {
  subject: ShareSubject;
  backgrounds?: ShareBackground[];
  copy: ShareCopy;
  /** The visible control; it is wrapped so a tap opens the sheet. */
  children: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(() => setOpen(true))}
      <ShareSheet open={open} onOpenChange={setOpen} subject={subject} backgrounds={backgrounds} copy={copy} />
    </>
  );
}
