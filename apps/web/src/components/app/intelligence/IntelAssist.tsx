"use client";

import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Sheet } from "@/components/ui/Sheet";
import type { IntelligenceResult, SearchResponse } from "@/lib/intelligence/contract";
import { assistRows, type IntelligenceCopy, type UnderstoodChip } from "./model";

/**
 * THE "INTELLIGENCE" PANEL: SMALL, DISMISSIBLE, NOT A CHAT. A short sheet of
 * ways to refine what is on screen. It adds no model path of its own: each
 * row opens the member assistant (`/assistant`, which seeds its composer from
 * `?q=` and never sends by itself) with the current search written into the
 * question, and the engine's own alternatives run here as searches.
 */
export function IntelAssist({
  open,
  onOpenChange,
  copy,
  q,
  chips,
  results,
  place,
  alternatives,
  runQuery,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: IntelligenceCopy;
  q: string;
  chips: readonly UnderstoodChip[];
  results: readonly IntelligenceResult[];
  place: string | undefined;
  alternatives: SearchResponse["alternatives"];
  runQuery: (q: string) => void;
}) {
  const a = copy.assist;
  const rows = assistRows({ q, chips, results, place, copy });
  const tries = (alternatives ?? []).filter((alt) => alt.query).slice(0, 4);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={a.title} description={q ? a.lede : a.ledeEmpty} detents={[0.66]} closeLabel={copy.close} testId="intel-assist">
      <div className="nf-intel-assist">
        <ul className="nf-intel-assist__card" role="list" data-testid="intel-assist-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={row.href} className="nf-create-sheet__option nf-intel-assist__row" onClick={() => onOpenChange(false)} data-testid={`intel-assist-${row.id}`}>
                <span className="nf-create-sheet__icon" aria-hidden="true">
                  <UiIcon name={row.icon} size={20} />
                </span>
                <span className="nf-create-sheet__text">
                  <span className="nf-create-sheet__title">{row.title}</span>
                  <span className="nf-create-sheet__sub">{row.sub}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {tries.length > 0 ? (
          <div className="nf-intel-assist__tries">
            <p className="nf-intel-overline">{a.tryInstead}</p>
            <ul className="nf-intel-chiprow" role="list">
              {tries.map((alt) => (
                <li key={alt.query}>
                  <button
                    type="button"
                    className="nf-chip nf-intel-chip"
                    onClick={() => {
                      onOpenChange(false);
                      runQuery(alt.query!);
                    }}
                  >
                    {alt.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="nf-intel-hintline">{a.note}</p>
      </div>
    </Sheet>
  );
}
