"use client";

import { Button } from "@/components/ui/Button";
import { copyAndSay } from "@/lib/ui/copy-and-say";

/** Copy summary and the CSV-like copy. Both go through the one copy-and-say banner. */
export function CopyActions({ summary, csv, disabled }: { summary: string; csv: string; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-xs" data-testid="deletion-copy-actions">
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => void copyAndSay(summary, "text", "Summary copied")} data-testid="deletion-copy-summary">
        Copy summary
      </Button>
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => void copyAndSay(csv, "text", "Table copied as CSV")} data-testid="deletion-copy-csv">
        Copy as CSV
      </Button>
    </div>
  );
}
