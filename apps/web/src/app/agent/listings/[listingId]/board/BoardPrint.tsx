"use client";

import type { Dictionary } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { BoardLines } from "@/lib/listings/board";
import "./board.css";

/**
 * The board on screen, and the two ways to take it away (V-08).
 *
 * The on-screen board is drawn in HTML from the same `BoardLines` the images
 * are drawn from, so what the agent approves is what is printed. "Print the A3
 * board" prints the A3 PNG alone, full page, through a print stylesheet; every
 * browser offers "Save as PDF" on that screen, which is the PDF.
 */
export function BoardPrint({
  listingId,
  lines,
  copy,
}: {
  listingId: string;
  lines: BoardLines;
  copy: Dictionary["frontDoor"]["board"];
}) {
  const base = `/agent/listings/${listingId}/board/image`;
  return (
    /* The title and its line are the page frame's (`page.tsx`); this is the
       column under them. */
    <div className="nf-board-page max-w-md">
      <div className="nf-board" data-testid="board-preview" aria-label={`${lines.banner}. ${lines.shape}. ${lines.onVallo}. ${lines.code}`}>
        <span className="nf-board__banner">{lines.banner}</span>
        <span className="nf-board__shape">{lines.shape}</span>
        <span className="nf-board__on">{lines.onVallo}</span>
        <span className="nf-board__code nf-numeric" data-testid="board-code">
          {lines.code}
        </span>
        <span className="nf-board__hint">{copy.typeCode}</span>
      </div>

      <p className="mt-group nf-body-sm text-[var(--nf-content-secondary)]">{copy.noPhone}</p>

      <div className="mt-group flex flex-col gap-row">
        <ButtonLink href={`${base}?format=square`} variant="primary" full download data-testid="board-square">
          {copy.square}
        </ButtonLink>
        <p className="nf-caption text-[var(--nf-content-muted)]">{copy.squareNote}</p>
        <Button variant="ghost" full onClick={() => window.print()} data-testid="board-print">
          {copy.print}
        </Button>
        <p className="nf-caption text-[var(--nf-content-muted)]">{copy.printNote}</p>
      </div>

      {/* Printed, never shown: the A3 image alone, a full page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="nf-board-print" src={`${base}?format=a3`} alt="" loading="lazy" />
    </div>
  );
}
