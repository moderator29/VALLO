"use client";

import { banner } from "@/lib/ui/toast";
import Link from "next/link";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { NearMeChip } from "./NearMeChip";
import type { ShelfQuery } from "./shelf-query";
import type { QuickChip } from "./quick-chips";
import "./search-v2.css";

export type SheetChip = { key: string; label: string; icon: UiIconName; on: boolean; href: string };

/**
 * THE CHIP ROW UNDER THE SEARCH BAR: the reference's quick chips first ("For
 * you", "Near me", "New listed"), then the chips that read the filter state
 * back (market, beds, price, more), each of which opens the sheet. Every chip
 * is an address the shelf already reads (`quick-chips.ts`), so a quick chip
 * is a link a back button can walk; only "Near me" waits on the device.
 *
 * A client component only for "Near me"'s words, which are drawn under the
 * row rather than inside its scroller, where they would be clipped.
 */
export function ShelfChipRow({
  label,
  query,
  quick,
  quickCopy,
  chips,
}: {
  label: string;
  query: ShelfQuery;
  quick: QuickChip[];
  quickCopy: {
    forYou: string;
    nearMe: string;
    newListed: string;
    locating: string;
    denied: string;
    failed: string;
    unavailable: string;
  };
  chips: SheetChip[];
}) {
  const forYou = quick.find((chip) => chip.key === "forYou");
  const newListed = quick.find((chip) => chip.key === "newListed");

  return (
    <nav aria-label={label} className="nf-shelf-chips nf-scroll-x mt-sm">
      {forYou && (
        <Link
          href={forYou.href}
          prefetch={false}
          aria-current={forYou.on ? "true" : undefined}
          data-testid="quick-for-you"
          className={`nf-shelf-chip nf-shelf-chip--quick ${forYou.on ? "nf-shelf-chip--on" : ""}`}
        >
          <UiIcon name="heart" size={16} />
          {quickCopy.forYou}
        </Link>
      )}
      {/* Why Near me could not find you is said by the one banner (Grade 1). */}
      <NearMeChip query={query} copy={quickCopy} onMessage={(message) => message && banner.error(message, { "data-testid": "quick-note" })} />
      {newListed && (
        <Link
          href={newListed.href}
          prefetch={false}
          aria-current={newListed.on ? "true" : undefined}
          data-testid="quick-new-listed"
          className={`nf-shelf-chip nf-shelf-chip--quick ${newListed.on ? "nf-shelf-chip--on" : ""}`}
        >
          <UiIcon name="clock" size={16} />
          {quickCopy.newListed}
        </Link>
      )}
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          prefetch={false}
          data-testid={`shelf-chip-${chip.key}`}
          className={`nf-shelf-chip ${chip.on ? "nf-shelf-chip--on" : ""}`}
        >
          <UiIcon name={chip.icon} size={16} />
          {chip.label}
          <UiIcon name="chevron-down" size={16} />
        </Link>
      ))}
    </nav>
  );
}
