import type { ReactNode } from "react";
import Link from "next/link";
import { DEFAULT_LOCALE, getDictionary, type Dictionary } from "@vallo/i18n";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { toneForStatus, type StatusTone } from "@/components/ui/StatusPill";
import { ConsoleStatus } from "./chip-state";
import { ScrollRow } from "./ScrollRow";

/**
 * The console's dense row table, built once (278CC66A at 390px, CDA4B82B at
 * desktop) so every desk inherits it.
 *
 * A row is: the reference, the type glyph on its tile, the title and the
 * person or place under it, a detail column on desktop, the status pill,
 * the submitted stamp, then View and the kebab. View opens the row's own
 * detail beneath it, which is the desk's existing review card with every
 * decision control it already had. The table therefore adds a way to scan
 * a queue without taking a single write path away from it.
 *
 * WHY A LIST OF DISCLOSURES AND NOT A `<table>`. A row needs to carry its
 * detail under it and a 390px screen cannot hold seven columns; a native
 * `<details>` gives the open and close, the keyboard and the state for
 * free, and the grid draws the columns the width allows. The header row is
 * drawn on desktop where the columns line up and hidden on the phone, where
 * every cell names itself instead: the type word sits under its glyph, the
 * pill carries its own status word, and the reference and the stamp read as
 * what they are.
 *
 * WHAT IS DELIBERATELY NOT HERE. Bulk actions and an export button: no desk
 * has a bulk write and no export exists on the platform, and a control that
 * cannot act is the picture of a feature (rule 19). The kebab opens the same
 * detail as View, so it is never a menu of nothing.
 *
 * Server-safe: no hooks, so a desk keeps rendering its rows on the server.
 * The tab strip's scroll placement is the one client piece (`ScrollRow`).
 */

export type QueueRowData = {
  id: string;
  /** The short reference an operator reads out: "#VL-1024", "LST-8F2". */
  reference: string;
  /** The kind, in a word, and its stroked glyph. */
  type: string;
  icon: UiIconName;
  title: string;
  /**
   * The PLACE under the title, drawn with the pin.
   *
   * Separate from `sub` because the pin is a claim: a row that draws it is
   * saying the words beside it are somewhere on a map. The audit and alert
   * desks have no place on their rows at all, and with one field they either
   * went without the line or printed an actor's name under a map pin.
   */
  place?: string;
  /** Anything else under the title: a person, an email, a wallet. No pin. */
  sub?: string;
  /** A second line on desktop only: the figure, the dates, the wallet. */
  detail?: string;
  detailSub?: string;
  /** The machine status; the pill derives its tone from it unless given. */
  status: string;
  statusLabel: string;
  tone?: StatusTone;
  /** Pre-formatted through `adminUi.when`. */
  submitted: string;
  /** Where View goes when the row has its own page rather than a fold. */
  href?: string;
  /** The row's detail, opened by View. The desk's existing card. */
  children?: ReactNode;
  /** Opened on arrival, for the row that was just decided. */
  open?: boolean;
  /** V-89: a control before the type, the queue desk's select box. */
  lead?: ReactNode;
  /** V-89: a line under the title: the clock, the owner and the weight. */
  extra?: ReactNode;
};

/* The English default comes OUT OF THE DICTIONARY, not out of a literal here.
   A literal fallback is how these seven got written in the first place. */
const DEFAULT_WORDS = getDictionary(DEFAULT_LOCALE).uiCommon.console.table;
const DETAILS_FALLBACK = "Details";

export function QueueTable({
  rows,
  label,
  columns = { detail: DETAILS_FALLBACK },
  heads = DEFAULT_WORDS,
}: {
  rows: QueueRowData[];
  /** The accessible name of the table. */
  label: string;
  columns?: { detail?: string };
  /** `t.uiCommon.console.table`. Optional so an un-threaded caller still
      compiles and still renders correct English. */
  heads?: Dictionary["uiCommon"]["console"]["table"];
}) {
  const words = heads;
  return (
    <div className="nf-panel nf-panel--flush nf-admin-table" role="region" aria-label={label}>
      {/*
        THE SEVEN COLUMN HEADS OF EVERY CONSOLE TABLE WERE ENGLISH LITERALS,
        in a four locale product, above rows whose contents are translated.
        `QueueFilters.tsx:141` already states why that is worse than not
        translating at all: "the half that is translated is the half that
        tells the reader the rest is a bug."

        `heads` is optional and defaults to the DICTIONARY's English rather
        than to a literal, so an un-threaded caller renders exactly what it
        rendered before and a caller holding a `t` passes
        `t.uiCommon.console.table` and gets the reader's language. Six of the
        six product callers hold one.
      */}
      <div className="nf-admin-table__head" aria-hidden="true">
        <span>{words.id}</span>
        <span>{words.type}</span>
        <span>{words.titleOrUser}</span>
        <span>{columns.detail ?? DETAILS_FALLBACK}</span>
        <span>{words.status}</span>
        <span>{words.submitted}</span>
        <span className="text-right">{words.action}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((row) => (
          <li key={row.id}>
            {row.children ? (
              <details className="nf-admin-row" open={row.open}>
                <summary>
                  <RowGrid row={row} view={words.view} />
                </summary>
                <div className="nf-admin-row__body">{row.children}</div>
              </details>
            ) : (
              <div className="nf-admin-row">
                <RowGrid row={row} view={words.view} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RowGrid({ row, view: viewWord = DEFAULT_WORDS.view }: { row: QueueRowData; view?: string }) {
  /* On a phone the word is read out but drawn as a chevron, and a View link
     stretches over its whole card, so the card is the tap target (the
     `--card` rules in admin.css). A fold's summary is already the card. */
  const viewFace = (
    <>
      <span className="nf-admin-row__view-word">{viewWord}</span>
      <UiIcon name="chevron-right" size={20} className="nf-admin-row__view-chev" />
    </>
  );
  const view = row.href ? (
    <Link href={row.href} className="nf-admin-row__view nf-admin-row__view--link">
      {viewFace}
    </Link>
  ) : (
    <span className="nf-admin-row__view" aria-hidden="true">
      {viewFace}
    </span>
  );
  return (
    <div className={`nf-admin-row__grid${row.lead ? " nf-admin-row__grid--lead" : ""}`}>
      <span className="nf-admin-row__type">
        {row.lead && <span className="nf-admin-row__lead">{row.lead}</span>}
        <span className="nf-admin-row__tile" aria-hidden="true">
          <UiIcon name={row.icon} size={20} />
        </span>
        {/* Printed, not hidden. See the note on `.nf-admin-row__type-word`. */}
        <span className="nf-admin-row__type-word">{row.type}</span>
      </span>
      <span className="nf-admin-row__title">
        <span className="nf-admin-row__name">{row.title}</span>
        {row.place && (
          <span className="nf-admin-row__sub">
            <UiIcon name="location" size={12} className="shrink-0" />
            <span className="min-w-0 truncate">{row.place}</span>
          </span>
        )}
        {row.sub && (
          <span className="nf-admin-row__sub">
            <span className="min-w-0 truncate">{row.sub}</span>
          </span>
        )}
        {row.extra}
      </span>
      <span className="nf-admin-row__detail">
        {row.detail && <span className="block truncate font-semibold text-[var(--nf-content-primary)]">{row.detail}</span>}
        {row.detailSub && <span className="block truncate">{row.detailSub}</span>}
      </span>
      {/* The reference, the pill and the stamp: one meta line under the
          title on a phone, three of the render's columns on desktop (the
          wrapper is `display: contents` there). */}
      <span className="nf-admin-row__meta">
        {/* The kind in a word, on the phone's meta line (the word under the
            tile is the desktop's). One of the two is ever drawn. */}
        <span className="nf-admin-row__ref">
          <span className="nf-admin-row__kind">{row.type}</span>
          <span className="nf-admin-row__id nf-numeric">{row.reference}</span>
        </span>
        <span className="nf-admin-row__status">
          <ConsoleStatus tone={row.tone ?? toneForStatus(row.status)} size="xs">
            {row.statusLabel}
          </ConsoleStatus>
        </span>
        <span className="nf-admin-row__when">{row.submitted}</span>
      </span>
      <span className="nf-admin-row__actions">
        {view}
        <span className="nf-admin-row__kebab" aria-hidden="true">
          <UiIcon name="more" size={20} />
        </span>
      </span>
    </div>
  );
}

/**
 * The count tabs above a queue: "All 42", "Listings 18" (the count on its
 * own small plate), each a link
 * into the desk that clears it, with the live count beside it. A count is
 * only printed when the read gave one; nothing here invents a number.
 */
export type QueueTab = {
  key: string;
  label: string;
  href: string;
  count?: number;
  on?: boolean;
};

export function QueueTabs({ tabs, label }: { tabs: QueueTab[]; label: string }) {
  /* One sideways row on a phone, with the live tab placed in view and a fade
     at whichever end still has more (`ScrollRow`). */
  return (
    <ScrollRow label={label} className="nf-admin-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.on ? "page" : undefined}
          className={`nf-admin-tab${tab.on ? " nf-admin-tab--on" : ""}`}
        >
          {tab.label}
          {typeof tab.count === "number" && (
            <span className="nf-admin-tab__count nf-numeric">{tab.count}</span>
          )}
        </Link>
      ))}
    </ScrollRow>
  );
}

/*
 * `QueueHeadline` STOOD HERE AND IT WAS THE SECOND OF TWO.
 *
 * `ui.QueueHeader` (`app/admin/_components/ui.tsx`) renders the same
 * `<header className="nf-admin-head">` with the same title and the same
 * sub-line, and additionally takes a `count` and draws it as a brand badge
 * beside the title. Eighteen desks used that one; the OVERVIEW used this one,
 * which is why the overview was the single console screen whose heading could
 * not show a count. Two implementations of one header, and the one with the
 * missing feature was on the busiest page.
 *
 * Deleted rather than kept beside the survivor, because a second way to do
 * the same job is how the first one drifts.
 */

/**
 * The Operations Console footer: the version is the package's, the line is
 * the audit promise the console already makes.
 */
export function ConsoleFooter({ note }: { note: string }) {
  return (
    <footer className="nf-admin-foot">
      <span>{getDictionary(DEFAULT_LOCALE).uiCommon.console.consoleName}</span>
      <span>{note}</span>
    </footer>
  );
}

/** A short reference an operator can read out, from the row's own id. */
export function shortRef(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
