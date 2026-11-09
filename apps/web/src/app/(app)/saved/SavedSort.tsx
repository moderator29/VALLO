"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { useState } from "react";

export type SavedSortKey = "recent" | "name" | "price-low" | "price-high";

const SORT_OPTIONS: { key: SavedSortKey; label: string; icon: UiIconName }[] = [
  { key: "recent", label: "Most recent", icon: "clock" },
  { key: "name", label: "Name A to Z", icon: "file-text" },
  { key: "price-low", label: "Price: low to high", icon: "arrow-up" },
  { key: "price-high", label: "Price: high to low", icon: "arrow-down" },
];

export function SavedSort({ active = "recent" }: { active?: SavedSortKey }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(key: SavedSortKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "recent") {
      params.delete("sort");
    } else {
      params.set("sort", key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  const current = SORT_OPTIONS.find((o) => o.key === active) ?? SORT_OPTIONS[0]!;

  return (
    <>
      <button
        type="button"
        className="nf-chip nf-chip--quiet inline-flex items-center gap-1"
        onClick={() => setOpen(true)}
        aria-label={`Sort by ${current.label}`}
        data-testid="saved-sort"
      >
        <UiIcon name="sort" size={14} />
        {current.label}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Sort by" detents={[0.35]}>
        <ul className="nf-rows">
          {SORT_OPTIONS.map((opt) => (
            <li key={opt.key}>
              <button
                type="button"
                className="nf-row nf-row--tap w-full text-left"
                aria-pressed={opt.key === active}
                onClick={() => pick(opt.key)}
              >
                <UiIcon name={opt.icon} size={16} />
                <span className="min-w-0 flex-1 nf-body-sm font-semibold text-[var(--nf-content-primary)]">{opt.label}</span>
                {opt.key === active ? <UiIcon name="check" size={16} /> : null}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
