"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { clearCompare, compareHref, useCompareTray } from "@/lib/compare/tray";
import { useClientCopy } from "@/lib/i18n/client-copy";
import "@/app/css/compare-tray.css";

/**
 * THE COMPARE TRAY (backlog row 7): a quiet bar over the bottom of any member
 * page once at least one place has been set aside, "2 to compare", with one
 * door to the side-by-side page and one way to empty it. It draws nothing
 * when the tray is empty and nothing at all on the compare page itself.
 *
 * It sits above the dock on a phone and bottom right on a wide screen, and a
 * single place says what is missing ("Add one more to compare") instead of
 * offering a comparison of one.
 */
export function CompareTray() {
  const words = useClientCopy().details.compareTray;
  const { ids } = useCompareTray();
  const path = usePathname();
  if (ids.length === 0 || path === "/compare") return null;
  const ready = ids.length >= 2;
  const count = ids.length === 1 ? words.countOne : words.count.replace("{count}", String(ids.length));
  return (
    <aside className="nf-compare-tray" aria-label={words.label} data-testid="compare-tray">
      <p className="nf-compare-tray__count" role="status">
        <UiIcon name="scale" size={16} />
        <span>{ready ? count : `${count}. ${words.needTwo}`}</span>
      </p>
      {ready ? (
        <Link href={compareHref(ids)} className="nf-compare-tray__open" aria-label={words.openLabel} data-testid="compare-tray-open">
          {words.open}
        </Link>
      ) : null}
      <button type="button" className="nf-compare-tray__clear" aria-label={words.clearLabel} onClick={clearCompare} data-testid="compare-tray-clear">
        {words.clear}
      </button>
    </aside>
  );
}
