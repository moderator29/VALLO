"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { toggleCompare, useCompareTray } from "@/lib/compare/tray";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { feedback } from "@/lib/ui/feedback";
import { toast } from "@/lib/ui/toast";

/**
 * The compare control on a listing page (backlog row 7): a round glyph beside
 * share and the heart that sets this place in the compare tray, or takes it
 * out. `aria-pressed` says which, the glyph fills when it is in the tray, and
 * a full tray says so in words rather than doing nothing.
 */
export function CompareToggle({ listingId, className }: { listingId: string; className?: string }) {
  const words = useClientCopy().details.compareTray;
  const { has } = useCompareTray();
  const on = has(listingId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? words.remove : words.add}
      data-testid="listing-compare"
      data-theme="light"
      className={className}
      onClick={() => {
        const result = toggleCompare(listingId);
        if (result.full) {
          toast(words.full, { tone: "error" });
          return;
        }
        feedback("select");
        toast(result.on ? words.added : words.removed);
      }}
    >
      <UiIcon name="scale" size={16} filled={on} />
    </button>
  );
}
