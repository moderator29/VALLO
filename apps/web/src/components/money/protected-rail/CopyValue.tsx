"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";

/**
 * A value the payer types into their bank app, with one tap to copy it
 * (spec screen 3: "transfer details easy to copy on small Android devices").
 * The value is in tabular figures and spaced for reading aloud; the copy
 * button is a 44px target. Confirms with the quick pill, never inline.
 */
export function CopyValue({ value, label, copied, testId }: { value: string; label: string; copied: string; testId?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      banner.quick(copied);
    } catch {
      /* A browser that refuses the clipboard leaves the value selectable. */
    }
  };
  return (
    <span className="nf-pp-copy">
      <span className="nf-pp-copy__value" data-testid={testId}>
        {value}
      </span>
      <button type="button" className="nf-pp-copy__button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
        <UiIcon name="document" size={18} weight="lean" />
      </button>
    </span>
  );
}
