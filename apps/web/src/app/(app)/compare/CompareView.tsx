"use client";

import { COMPARE_MIN, type CompareTable } from "@/lib/saved/compare";
import { CompareBody, useCompareChoice, type SavedCompareCopy } from "@/components/app/compare/CompareBody";

/** The compare page's table: the shared body, open on the page rather than in a sheet. */
export function CompareView({ table, copy, initial }: { table: CompareTable; copy: SavedCompareCopy; initial: string[] }) {
  const choice = useCompareChoice(table, initial);
  if (table.columns.length < COMPARE_MIN) return null;
  return (
    <section aria-label={copy.title} data-testid="compare-view">
      <CompareBody table={table} copy={copy} choice={choice} />
    </section>
  );
}
