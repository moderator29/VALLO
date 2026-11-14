"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { toggleCompare, useCompareTray } from "@/lib/compare/tray";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { feedback } from "@/lib/ui/feedback";
import { toast } from "@/lib/ui/toast";

/* Said by the quick pill (founder, 14 November 2026). English for now, like
   the thread's "Message copied". */
export const COMPARE_PILL = { added: "Added to compare", removed: "Removed from compare" } as const;

/**
 * The compare control on a listing page (backlog row 7): a round glyph beside
 * share and the heart that sets this place in the compare tray, or takes it
 * out. `aria-pressed` says which, the glyph fills when it is in the tray, and
 * a full tray says so in words rather than doing nothing. Going in and coming
 * out are each said by the quick pill; a full tray is an error and stays on
 * the top banner.
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
        toast.quick(on ? COMPARE_PILL.removed : COMPARE_PILL.added);
      }}
    >
      <UiIcon name="scale" size={16} filled={on} />
    </button>
  );
}
