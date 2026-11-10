import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "./docs-kit.css";

/**
 * THE RICH TABLE.
 *
 * Real `<table>` markup with a tinted, sticky header, so a screen reader reads
 * a table. Three cell kinds go beyond text:
 *
 *   state   a dot AND a word in a pill (Pending, Clearing, Available, Paid), so
 *           colour never carries the meaning on its own;
 *   yesno   a mark AND the word Yes or No;
 *   lead    the first cell may carry a line glyph.
 *
 * Below 34rem of the table's own width (a phone) every row reflows into a
 * stacked card with its column name above each value. The table roles are
 * stated on the elements so the reflow does not strip them for assistive
 * technology, and nothing ever scrolls sideways.
 */
export type DocTone = "neutral" | "success" | "warning" | "danger" | "info";

export type DocCell =
  | string
  | ReactNode
  | { state: string; tone?: DocTone }
  | { yes: boolean; word?: string };

export type DocColumn = { key: string; label: string };

export type DocRow = {
  /** The row's own name, rendered as a row header (`th scope="row"`). */
  head: ReactNode;
  icon?: UiIconName;
  cells: Record<string, DocCell>;
};

function isState(cell: unknown): cell is { state: string; tone?: DocTone } {
  return typeof cell === "object" && cell !== null && "state" in cell && typeof (cell as { state: unknown }).state === "string";
}
function isYes(cell: unknown): cell is { yes: boolean; word?: string } {
  return typeof cell === "object" && cell !== null && "yes" in cell && typeof (cell as { yes: unknown }).yes === "boolean";
}

function Cell({ cell }: { cell: DocCell }) {
  if (isState(cell)) {
    return (
      <span className="nf-dk-state" data-tone={cell.tone && cell.tone !== "neutral" ? cell.tone : undefined}>
        {cell.state}
      </span>
    );
  }
  if (isYes(cell)) {
    return (
      <span className="nf-dk-mark" data-yes={String(cell.yes)}>
        <UiIcon name={cell.yes ? "circle-check" : "circle-x"} size={16} />
        {cell.word ?? (cell.yes ? "Yes" : "No")}
      </span>
    );
  }
  return <>{cell as ReactNode}</>;
}

export function DocTable({
  caption,
  headLabel,
  columns,
  rows,
}: {
  /** Describes the table to a screen reader and sits above it. */
  caption: string;
  /** The name of the first column (the row headers). */
  headLabel: string;
  columns: readonly DocColumn[];
  rows: readonly DocRow[];
}) {
  return (
    <div className="nf-dk-tablewrap">
      <table className="nf-dk-table" role="table">
        <caption>{caption}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              {headLabel}
            </th>
            {columns.map((column) => (
              <th key={column.key} scope="col" role="columnheader">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row, index) => (
            <tr key={index} role="row">
              <th scope="row" role="rowheader">
                <span className="nf-dk-table__lead">
                  {row.icon ? <UiIcon name={row.icon} size={16} /> : null}
                  <span>{row.head}</span>
                </span>
              </th>
              {columns.map((column) => (
                <td key={column.key} role="cell" data-label={column.label}>
                  <Cell cell={row.cells[column.key] ?? ""} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
