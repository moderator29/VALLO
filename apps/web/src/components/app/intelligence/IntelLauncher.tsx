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
  /** The link's accessible name: "Open VALLO Intelligence". */
  label: string;
  /** The quiet word on the right: "Search everything VALLO". */
  hint: string;
  examples: readonly string[];
  className?: string;
}) {
  const index = useRotatingHint(examples.length, false);
  return (
    <Link href="/intelligence?focus=1" aria-label={label} className={`nf-intel-launch ${className ?? ""}`} data-testid="intel-launcher" prefetch={false}>
      <UiIcon name="search" size={20} className="nf-intel-launch__glyph" />
      <span className="nf-intel-launch__hint" key={index} aria-hidden="true">
        {examples[index] ?? hint}
      </span>
      <span className="nf-intel-launch__mark" aria-hidden="true">
        <UiIcon name="spark" size={16} />
      </span>
    </Link>
  );
}
