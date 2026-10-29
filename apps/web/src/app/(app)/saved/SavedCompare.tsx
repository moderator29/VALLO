"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { COMPARE_MIN, type CompareTable } from "@/lib/saved/compare";
import { CompareBody, useCompareChoice, type SavedCompareCopy } from "@/components/app/compare/CompareBody";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

export type { SavedCompareCopy };

/**
 * COMPARE WHAT YOU SAVED (recommendation B3, 30 September 2026).
 *
 * A quiet "Compare" control over the Saved grid, shown at two saved
 * properties or more. It opens one page (a full sheet on a phone, the same
 * sheet across a wide screen) with the reader's shortlist as a row of picks
 * on top, two or three at a time, and under it the table: a column per place
 * (photo, title, place, its Example or Verified mark, and a door to it) and a
 * row per fact from `lib/saved/compare.ts`.
 *
 * ON A PHONE the columns swipe: the fact names stay pinned on the left and
 * the places scroll sideways a column at a time (scroll snap). ON A WIDE
 * SCREEN every chosen column is in view as a grid.
 *
 * The lower figure of a money row carries a dot and the word "Lower",
 * never colour alone; a fact the lister did not state says "Not stated".
 * It opens on the two most recently saved.
 *
 * SESSION 3 (W2): THE HEAD-TO-HEAD OF NORTH STAR 15.3. Two columns, never
 * three: a comparison table earns its place as two figures read across one
 * labelled row, and a third column on a phone is a column you cannot see. A
 * third pick replaces the first, so the reader is never refused. Each row
 * carries a small line glyph so the eye finds the row before it reads it, and
 * the leading value of a money row is weighted (and named "Lower", by word,
 * never by colour alone). Both columns are the reader's own saved spaces:
 * this never compares against another member, and there is no leaderboard.
 * D24: no Example mark on a column; Verified only where it was earned.
 */
export function SavedCompare({ table, copy }: { table: CompareTable; copy: SavedCompareCopy }) {
  const [open, setOpen] = useState(false);
  const choice = useCompareChoice(table);

  if (table.columns.length < COMPARE_MIN) return null;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={copy.openLabel}
        data-testid="saved-compare-open"
        className="nf-compare-open"
      >
        <UiIcon name="scale" size={16} />
        {copy.open}
      </Button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={copy.title}
        fullPage
        closeLabel={copy.close}
        testId="saved-compare"
        className="nf-compare-sheet"
      >
        <CompareBody table={table} copy={copy} choice={choice} />
      </Sheet>
    </>
  );
}
