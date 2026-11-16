"use client";

import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useRotatingHint } from "./use-intel";
import "./intelligence.css";

/**
 * THE DOOR TO VALLO INTELLIGENCE FROM A SCREEN THAT IS NOT IT (Home, under
 * the greeting). It looks like the field it opens, with the same rotating
 * example, but it is a LINK: a tap on Home should not raise a keyboard over
 * the hero. It opens `/intelligence?focus=1`, which puts the caret in the
 * real field on arrival.
 */
export function IntelLauncher({
  label,
  hint,
  examples,
  className,
}: {
  /** The start of the link's accessible name ("Open VALLO Intelligence"), read before the visible example. */
  label: string;
  /** The quiet word on the right: "Search everything VALLO". */
  hint: string;
  examples: readonly string[];
  className?: string;
}) {
  const index = useRotatingHint(examples.length, false);
  /* LABEL IN NAME (WCAG 2.5.3; axe `label-content-name-mismatch`, a11y-desks
     on the Home harness, 16 November 2026). The link used to be named by an
     `aria-label` alone while it SHOWED the rotating example, so the words a
     sighted or voice-control user reads ("2-bedroom apartment in Lekki...")
     were not part of its name and "click 2-bedroom apartment" found nothing.
     The name is now the label, said first and unseen, followed by the very
     text on screen; the drawing is unchanged. */
  return (
    <Link href="/intelligence?focus=1" className={`nf-intel-launch ${className ?? ""}`} data-testid="intel-launcher" prefetch={false}>
      <UiIcon name="search" size={20} className="nf-intel-launch__glyph" />
      <span className="sr-only">{`${label}: `}</span>
      <span className="nf-intel-launch__hint" key={index}>
        {examples[index] ?? hint}
      </span>
      <span className="nf-intel-launch__mark" aria-hidden="true">
        <UiIcon name="spark" size={16} />
      </span>
    </Link>
  );
}
