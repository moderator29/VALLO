import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import "@/app/css/docs-kit.css";

/**
 * THE RICH TABLE (DOCS_AND_PRESENCE_UPGRADE.md 4.3). Where a concept has
 * states, fees or rules it is a table, not prose, and ours carries more than
 * words: a state column draws a coloured dot and pill, a yes/no column draws a
 * mark, a row can lead with an icon.
 *
 * REAL TABLE MARKUP, KEPT REAL. From about 34rem down the rows reflow into
 * stacked cards (each cell names its column), so nothing scrolls sideways at
 * 360px. A stylesheet that turns table parts into blocks makes WebKit drop the
 * table semantics, so every part also carries its explicit ARIA role and a
 * screen reader still hears a table with headers.
 *
 * Server-safe and data-free: it draws exactly the rows it is handed.
 */

export type DocTableTone = "neutral" | "pending" | "active" | "success" | "warning" | "danger" | "info";

/** The name the offers chapters use for the same thing. */
export type DocTone = DocTableTone;

/** The name the offers and manual chapters use for a row. */
export type DocRow = DocTableRow;

export type DocTableColumn = {
  key: string;
  label: string;
  /** `state` draws a toned pill, `yesno` a mark, `text` the value as it is. */
  kind?: "text" | "state" | "yesno";
  /** Right-aligns a column of figures and gives it tabular numerals. */
  numeric?: boolean;
};

export type DocTableCell =
  | ReactNode
  | { state: string; tone: DocTableTone }
  | { yes: boolean; note?: string; word?: string };

/**
 * A row. `head` is the row's own name, drawn as a row header (`th scope="row"`)
 * rather than a cell, which is what a table of states or stages wants: the
 * state is the subject of the row, not one of its values. `id` is optional
 * because a row with a `head` already identifies itself.
 */
export type DocTableRow = { id?: string; head?: ReactNode; icon?: UiIconName; cells: Record<string, DocTableCell> };

function isState(v: DocTableCell): v is { state: string; tone: DocTableTone } {
  return typeof v === "object" && v !== null && "state" in (v as object) && "tone" in (v as object);
}
function isYesNo(v: DocTableCell): v is { yes: boolean; note?: string } {
  return typeof v === "object" && v !== null && "yes" in (v as object);
}

function Cell({ column, value }: { column: DocTableColumn; value: DocTableCell }) {
  if (column.kind === "state" && isState(value)) {
    return (
      <span className="nf-doc-state" data-tone={value.tone}>
        <span className="nf-doc-state__dot" aria-hidden="true" />
        {value.state}
      </span>
    );
  }
  if (column.kind === "yesno" && isYesNo(value)) {
    return (
      <span className="nf-doc-yesno" data-yes={value.yes ? "true" : "false"}>
        <UiIcon name={value.yes ? "circle-check" : "circle-x"} size={18} />
        <span>{value.note ?? (value.yes ? "Yes" : "No")}</span>
      </span>
    );
  }
  return <>{value as ReactNode}</>;
}

export function DocTable({
  caption,
  columns,
  rows,
  captionHidden = false,
  headLabel,
}: {
  /** The first column's label where the rows carry their own `head`. */
  headLabel?: string;
  /** What the table is about. Read first by a screen reader. */
  caption: string;
  columns: DocTableColumn[];
  rows: DocTableRow[];
  /** Keep the caption for screen readers only, when a heading above already says it. */
  captionHidden?: boolean;
}) {
  return (
    <div className="nf-doc-table-wrap">
      {/*
        A DENSE TABLE STACKS ON ITS OWN WIDTH, NOT ONLY THE WINDOW'S. The
        stacking rule was a viewport media query at 34rem, which answers the
        phone and nothing else. A four column table inside the 48rem document
        sheet is 704px wide on a 1280px window, and measured on `/cookies` that
        put a column of prose at 78px. `data-dense` is the hook the container
        query in docs-kit.css reads; the count is on the wrap for anyone
        reading the DOM.
      */}
      <table className="nf-doc-table" role="table" data-cols={columns.length} data-dense={columns.length >= 4 ? "true" : undefined}>
        <caption className={captionHidden ? "sr-only" : "nf-doc-table__caption"}>{caption}</caption>
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((c, i) => (
              <th key={c.key} scope="col" role="columnheader" data-numeric={c.numeric ? "true" : undefined}>
                {i === 0 && headLabel ? headLabel : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row, r) => {
            /* A row with its own name draws that name as a row header and
               spends its cells on the remaining columns, so a reader on a
               phone hears "Pending: what it means" rather than a bare value. */
            const lead = row.head !== undefined;
            const body = lead ? columns.slice(1) : columns;
            return (
              <tr key={row.id ?? `r${r}`} role="row">
                {lead ? (
                  <th scope="row" role="rowheader" data-label={columns[0]?.label} data-lead="true">
                    {row.icon ? (
                      <span className="nf-doc-table__lead">
                        <span className="nf-doc-table__icon" aria-hidden="true">
                          <UiIcon name={row.icon} size={16} />
                        </span>
                        {row.head}
                      </span>
                    ) : (
                      row.head
                    )}
                  </th>
                ) : null}
                {body.map((c, j) => {
                  const i = lead ? j + 1 : j;
                  return (
                    <td
                      key={c.key}
                      role="cell"
                      data-label={c.label}
                      data-numeric={c.numeric ? "true" : undefined}
                      data-lead={i === 0 ? "true" : undefined}
                    >
                      {i === 0 && row.icon ? (
                        <span className="nf-doc-table__lead">
                          <span className="nf-doc-table__icon" aria-hidden="true">
                            <UiIcon name={row.icon} size={16} />
                          </span>
                          <Cell column={c} value={row.cells[c.key]} />
                        </span>
                      ) : (
                        <Cell column={c} value={row.cells[c.key]} />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
