"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { COMPARE_MIN, forSelection, type CompareTable } from "@/lib/saved/compare";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

/** 15.3: a head-to-head is two columns. */
const TWO = 2;

/** The small glyph per row (15.3), by the row's key; a fee line takes the receipt. */
const ROW_GLYPH: Record<string, UiIconName> = {
  moveIn: "wallet",
  rent: "key",
  beds: "bed",
  baths: "bath",
  size: "grid",
  parking: "parking",
  type: "house",
  power: "bolt",
  available: "calendar-check",
};

export type SavedCompareCopy = {
  open: string;
  openLabel: string;
  title: string;
  pick: string;
  pickLimit: string;
  tooFew: string;
  notStated: string;
  view: string;
  close: string;
  verified: string;
  /** "Lower": the leading figure of two, by word. */
  lower: string;
};

/**
 * THE COMPARE BODY, shared by the Saved page's sheet and the `/compare` page
 * (backlog row 7): the reader's picks on top, two at a time, and under them
 * the table, a column per place and a row per fact from
 * `lib/saved/compare.ts`. The choice lives in `useCompareChoice`, so the
 * caller decides how long it is remembered (the Saved sheet keeps it across
 * open and close).
 *
 * The lower figure of a money row carries a dot and the word "Lower", never
 * colour alone; a fact the lister did not state says "Not stated". A third
 * pick replaces the first, so the reader is never refused.
 */
export function useCompareChoice(table: CompareTable, initial?: readonly string[]) {
  const [chosen, setChosen] = useState<string[]>(() =>
    (initial && initial.length > 0 ? [...initial] : table.columns.map((c) => c.id)).slice(0, COMPARE_MIN),
  );
  const [note, setNote] = useState<string | null>(null);

  /* A place removed from the list leaves the compare too. */
  const valid = chosen.filter((id) => table.columns.some((c) => c.id === id));
  const shown = useMemo(() => forSelection(table, valid), [table, valid]);

  const toggle = (id: string, limitNote: string) => {
    if (valid.includes(id)) {
      setChosen(valid.filter((x) => x !== id));
      setNote(null);
      return;
    }
    /* A third pick replaces the first chosen: two at a time, never refused. */
    setChosen(valid.length >= TWO ? [...valid.slice(1), id] : [...valid, id]);
    setNote(valid.length >= TWO ? limitNote : null);
  };

  return { valid, shown, note, toggle };
}

export type CompareChoice = ReturnType<typeof useCompareChoice>;

export function CompareBody({
  table,
  copy,
  choice,
}: {
  table: CompareTable;
  copy: SavedCompareCopy;
  choice: CompareChoice;
}) {
  const { valid, shown, note, toggle } = choice;
  return (
    <>
        <p className="nf-caption text-[var(--nf-content-secondary)]">{copy.pick}</p>
        <ul className="nf-compare-picks nf-scroll-x" aria-label={copy.pick}>
          {table.columns.map((column) => {
            const on = valid.includes(column.id);
            return (
              <li key={column.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(column.id, copy.pickLimit)}
                  className="nf-compare-pick"
                  data-on={on || undefined}
                >
                  <span className="nf-compare-pick__photo" aria-hidden="true">
                    {column.photo ? (
                      <RemoteImage src={column.photo} alt="" width={40} height={40} sizes="40px" />
                    ) : null}
                  </span>
                  <span className="nf-compare-pick__title">{column.title}</span>
                  <span className="nf-compare-pick__tick" aria-hidden="true">
                    {on ? <UiIcon name="check" size={16} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="nf-caption mt-inline-tight min-h-5 text-[var(--nf-content-muted)]" role="status">
          {note ?? (valid.length < COMPARE_MIN ? copy.tooFew : "")}
        </p>

        {shown.columns.length >= COMPARE_MIN ? (
          <div
            className="nf-compare"
            role="region"
            aria-label={copy.title}
            tabIndex={0}
            style={{ "--nf-compare-cols": shown.columns.length } as React.CSSProperties}
          >
            <table className="nf-compare__table">
              <thead>
                <tr>
                  <td className="nf-compare__corner" />
                  {shown.columns.map((column) => (
                    <th key={column.id} scope="col" className="nf-compare__head">
                      <span className="nf-compare__photo">
                        {column.photo ? (
                          <RemoteImage src={column.photo} alt="" width={160} height={120} sizes="(max-width: 640px) 40vw, 240px" />
                        ) : null}
                        {column.mark === "verified" ? (
                          <span className="nf-badge nf-badge--verified">{copy.verified}</span>
                        ) : null}
                      </span>
                      <span className="nf-compare__title">{column.title}</span>
                      <span className="nf-compare__place">{column.place}</span>
                      <Link href={`/listing/${column.id}`} className="nf-compare__view">
                        {copy.view}
                        <UiIcon name="arrow-right" size={16} />
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="nf-compare__label">
                      <span className="nf-compare__glyph" aria-hidden="true">
                        <UiIcon name={ROW_GLYPH[row.key] ?? (row.kind === "money" ? "receipt" : "info")} size={16} />
                      </span>
                      {row.label}
                    </th>
                    {row.cells.map((cell, i) => (
                      <td
                        key={shown.columns[i]!.id}
                        className="nf-compare__cell"
                        data-kind={row.kind}
                        data-lowest={cell.lowest || undefined}
                      >
                        {cell.text === null ? (
                          <span className="nf-compare__none">{copy.notStated}</span>
                        ) : (
                          <>
                            <span className={row.kind === "money" ? "nf-numeric" : undefined}>{cell.text}</span>
                            {cell.lowest ? (
                              <span className="nf-compare__lowest">
                                <span className="nf-compare__dot" aria-hidden="true" />
                                {copy.lower}
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
    </>
  );
}
