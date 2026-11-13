import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import type { AdminCommon } from "./copy";
import { QueueSlidePager } from "./QueueSlidePager";
import { queueHref, type QueueQuery } from "./queue-href";

export { queueHref, type QueueQuery };
import { QueueFilterSheet } from "./QueueFilterSheet";
import "./admin-material.css";
import { Button } from "@/components/ui/Button";

/**
 * The console's one queue frame: find a row, narrow to it, page through.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE CONSOLE HAD BEFORE THIS.
 *
 * Nineteen destinations. ONE search input across all of them, on
 * `/admin/bookings`. Zero status filters. Zero date ranges. Zero pagination.
 * No page read a filter parameter, applied a `.range()`, or offered a page
 * control, and `components/ui/Table.tsx` was used by the console exactly zero
 * times.
 *
 * At zero rows nobody notices, and every queue is at zero rows today. At a
 * thousand rows the console stops working, and `audit_log` already holds 482.
 * The console's whole job is to find one row among many and act on it, and it
 * could do that on one screen out of nineteen.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS A `<form method="get">` AND NOT A CLIENT COMPONENT.
 *
 * Because the answer belongs in the address bar. A filtered queue is then a
 * link an operator can send to the person who has to act on it, the back button
 * walks the narrowing backwards, a reload lands on the same rows, and the page
 * stays a server component that reads its own parameters. That is the same
 * contract discovery already runs on, and it is why the search on
 * `/admin/bookings` was right about the one thing it did.
 *
 * It also means this file has no hooks and no client boundary, so a queue page
 * keeps rendering its list on the server.
 *
 * ---------------------------------------------------------------------------
 * THE STATUS CHIPS COME FROM THE REAL ENUM, EVERY TIME.
 *
 * `statuses` is passed in by the page, from the same union the query filters
 * on. Nothing here invents a status vocabulary, and nothing here can offer a
 * chip the database would refuse: four admin surfaces were already printing
 * raw column values as chip labels, and a filter that offered a value the enum
 * does not hold would be the same defect pointed the other way.
 *
 * ---------------------------------------------------------------------------
 * PAGINATION IS A CURSOR AND IT IS HONEST ABOUT WHAT IT KNOWS.
 *
 * There is no total and no page count, because a queue read that has fetched
 * one page does not know how many there are and printing "Page 1 of 40" would
 * require a second count query on every load. Next and Previous move an
 * offset, and Next is only offered when the page came back full, which is the
 * one thing the read actually knows.
 */

export type QueueStatusOption = {
  /** The enum value, exactly as the column spells it. */
  value: string;
  /** What it is called on screen. */
  label: string;
};

/** Read the queue's own parameters out of a Next `searchParams` bag. */
export function readQueueQuery(
  params: Record<string, string | string[] | undefined>,
): QueueQuery {
  const one = (key: string): string | undefined => {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value && value.length > 0 ? value : undefined;
  };
  const offset = Number.parseInt(one("offset") ?? "", 10);
  return {
    ...(one("q") ? { q: one("q") } : {}),
    ...(one("status") ? { status: one("status") } : {}),
    ...(one("from") ? { from: one("from") } : {}),
    ...(one("to") ? { to: one("to") } : {}),
    /* A negative or unparseable offset is a hand-edited URL, not a page. */
    ...(Number.isFinite(offset) && offset > 0 ? { offset } : {}),
  };
}

/** A base split into the path a GET form posts to and the fields it must keep. */
export function formTarget(base: string): { action: string; keep: [string, string][] } {
  const at = base.indexOf("?");
  if (at === -1) return { action: base, keep: [] };
  return { action: base.slice(0, at), keep: [...new URLSearchParams(base.slice(at + 1)).entries()] };
}

/** True when anything at all is narrowing this queue. */
export function queueNarrowed(query: QueueQuery): boolean {
  return Boolean(query.q || query.status || query.from || query.to);
}

/**
 * What an empty queue says when it is empty BECAUSE of the filter.
 *
 * "No reports yet" under a status chip is a false statement: there may be
 * hundreds, none of them dismissed. A narrowed empty queue is a result and has
 * to read as one.
 *
 * It was an English constant in this file for one sprint, because the shared
 * console furniture had no keys and eighteen queues each inventing their own
 * pair was the worse of the two wrongs. The keys exist now, so the pair comes
 * from the dictionary and a Hausa operator reads a Hausa result.
 */
export function queueNoMatch(common: AdminCommon): { title: string; body: string } {
  return { title: common.noMatchTitle, body: common.noMatchBody };
}

export async function QueueFilters({
  base,
  query,
  statuses,
  common,
  searchable = true,
  dateable = true,
  searchLabel,
  searchPlaceholder,
}: {
  /** The queue's own path, e.g. "/admin/bookings". */
  base: string;
  query: QueueQuery;
  /** The real enum for THIS queue. Omit where the queue has no status. */
  statuses?: readonly QueueStatusOption[];
  /**
   * The console's shared words.
   *
   * REQUIRED, AND IT USED TO BE FOUR ENGLISH LITERALS IN THIS FILE. "From",
   * "To", "Apply" and "Clear" were written here, and the search label and the
   * no-match pair were English defaults, so the one queue that had its own keys
   * read correctly in four languages and the frame around it did not. A control
   * that is half translated is worse than one that is not, because the half
   * that is translated is the half that tells the reader the rest is a bug.
   */
  common: AdminCommon;
  /**
   * False where the queue genuinely cannot be searched.
   *
   * Not a convenience. `/admin/kyc` is the case: the field a reviewer
   * recognises a row by is the subject's NAME, which is not on the document
   * row and is resolved afterwards through two different paths. A box that
   * searched one of those paths would quietly miss the rows filed under the
   * other, and a search an operator cannot tell is incomplete is worse than a
   * screen that does not offer one. The date range and the status chips still
   * work, so the frame is not all-or-nothing.
   */
  searchable?: boolean;
  /**
   * False where a date range could not narrow this queue truthfully.
   *
   * The same rule as `searchable`, for the same reason. `/admin/stops` is the
   * case: the desk lists AGENTS, and the only date on the screen belongs to a
   * stop, which is a row on another table that most of the listed agents do not
   * have. A From and a To drawn there would either do nothing or quietly empty
   * the half of the list that has never been stopped, and an operator has no
   * way to tell which. A control that cannot narrow is not a neutral extra: it
   * is the console claiming an ability it does not have, on the screen where
   * somebody is deciding whether to take a person's livelihood down.
   */
  dateable?: boolean;
  /** Only where the queue's own noun genuinely beats "Search this queue". */
  searchLabel?: string;
  searchPlaceholder?: string;
}) {
  const narrowed = queueNarrowed(query);
  const f = common.filters;
  /* The phone's filter sheet (W8): the same dates and the same statuses, in a
     bottom sheet. Its words are Session 3's, the shared ones are the console's. */
  const x = getDictionary(await getLocale()).experienceAdmin.shell;
  const narrowedCount = [query.status, query.from, query.to].filter(Boolean).length;
  const showSheet = dateable || Boolean(statuses && statuses.length > 0);

  return (
    <div className="nf-admin-filters">
      {/*
        THE GLASS SEARCH WITH THE FILTER CONTROL (278CC66A). The search is
        the field; the sliders control opens the date range beneath it, as
        a native disclosure so the form stays a GET and the page a server
        component. Apply and Clear live inside the disclosure with the
        dates, because they are what the dates need.
      */}
      <form method="get" action={formTarget(base).action}>
        {formTarget(base).keep.map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {/*
          C16: the field is NOT inside the <summary> any more. An input inside
          a summary is two interactive controls nested in one (axe
          nested-interactive, serious), and a screen reader announced the
          search as a disclosure button. The summary is now the sliders
          control alone, placed at the end of the search row by CSS
          (`.nf-admin-search--split`, admin.css); the dates open beneath.
        */}
        <div className={`nf-admin-search${dateable ? " nf-admin-search--split" : ""}`}>
          {searchable && (
            <label className="nf-admin-search__field">
              <span className="sr-only">{searchLabel ?? common.searchLabel}</span>
              <UiIcon name="search" size={20} className="nf-admin-search__glyph" />
              <input
                type="search"
                enterKeyHint="search"
                name="q"
                defaultValue={query.q ?? ""}
                placeholder={searchPlaceholder ?? common.searchPlaceholder}
              />
            </label>
          )}
          {!dateable && (
            <Button type="submit" variant="icon" aria-label={f.apply}>
              <UiIcon name="arrow-right" size={20} />
            </Button>
          )}
          {dateable && (
            <details className="nf-admin-more" open={Boolean(query.from || query.to)}>
              <summary className="nf-icon-btn" aria-label={`${f.from} / ${f.to}`}>
                <UiIcon name="sliders" size={20} />
              </summary>
          {/* A DATE RANGE, because half of what an operator is asked is "what
              happened on Tuesday". Two native date inputs rather than a
              picker: keyboard-reachable, localised by the browser, and the
              one control a console does not need to invent. */}
          {dateable && (
            <div className="nf-admin-more__body">
              <label className="min-w-0 flex-1">
                <span className="nf-label">{f.from}</span>
                <input type="date" name="from" defaultValue={query.from ?? ""} className="nf-field mt-inline-tight w-full" />
              </label>
              <label className="min-w-0 flex-1">
                <span className="nf-label">{f.to}</span>
                <input type="date" name="to" defaultValue={query.to ?? ""} className="nf-field mt-inline-tight w-full" />
              </label>
              <Button variant="primary" className="shrink-0" type="submit">
                {f.apply}
              </Button>
              {narrowed && (
                <Link href={base} className="nf-btn nf-btn--ghost nf-btn--md shrink-0">
                  {f.clear}
                </Link>
              )}
            </div>
          )}
            </details>
          )}
          {showSheet && (
            <QueueFilterSheet
              base={formTarget(base).action}
              keep={formTarget(base).keep}
              {...(query.q ? { q: query.q } : {})}
              {...(query.status ? { status: query.status } : {})}
              {...(query.from ? { from: query.from } : {})}
              {...(query.to ? { to: query.to } : {})}
              statuses={(statuses ?? []).map((option) => ({
                value: option.value,
                label: option.label,
                tone: chipTone(option.value),
                on: query.status === option.value,
                href: queueHref(base, query, { status: query.status === option.value ? undefined : option.value, offset: undefined }),
              }))}
              statusLinks={{ all: queueHref(base, query, { status: undefined, offset: undefined }), allOn: !query.status }}
              dateable={dateable}
              narrowedCount={narrowedCount}
              words={{
                open: x.filtersOpen,
                title: x.filtersTitle,
                from: f.from,
                to: f.to,
                status: f.status,
                all: x.filtersAll,
                close: x.filtersClose,
                apply: x.filtersApply,
                reset: x.filtersReset,
                on: x.filtersCount,
                off: x.filtersNone,
              }}
            />
          )}
        </div>
        {/* The status travels with the search so a submit does not silently
            drop the chip the operator already chose. */}
        {query.status && <input type="hidden" name="status" value={query.status} />}
      </form>

      {statuses && statuses.length > 0 && (
        /* Links rather than a control, for the same reason the search is a GET:
           a narrowed queue has to be a URL. `aria-current` is what tells a
           screen reader which one is on. "All" is the chip with no status;
           tapping the active chip clears it. Each chip carries its state's
           ink so the row reads as the render's, and colour is never alone:
           the word is on every chip. */
        <nav aria-label="Filter by status" className="nf-admin-status">
          <span className="nf-admin-status__label">{f.status}</span>
          <Link
            href={queueHref(base, query, { status: undefined, offset: undefined })}
            aria-current={query.status ? undefined : "true"}
            className={`nf-admin-chip nf-admin-chip--all${query.status ? "" : " nf-admin-chip--on"}`}
          >
            All
          </Link>
          {statuses.map((option) => {
            const on = query.status === option.value;
            return (
              <Link
                key={option.value}
                href={queueHref(base, query, {
                  status: on ? undefined : option.value,
                  offset: undefined,
                })}
                aria-current={on ? "true" : undefined}
                className={`nf-admin-chip ${chipTone(option.value)}${on ? " nf-admin-chip--on" : ""}`}
              >
                {option.label}
              </Link>
            );
          })}
        </nav>
      )}
      {narrowed && !dateable && (
        <Link href={base} className="nf-btn nf-btn--ghost nf-btn--sm self-start">
          {f.clear}
        </Link>
      )}
    </div>
  );
}

/**
 * Which of the four on-palette inks a status chip wears, from the machine
 * value alone, so every desk's enum lands on the same four colours: cyan for
 * waiting, blue for in review, emerald for approved, rose for refused.
 */
export function chipTone(value: string): string {
  const v = value.trim().toUpperCase();
  if (["PENDING", "OPEN", "SUBMITTED", "REQUESTED", "DRAFT", "PROPOSED"].includes(v)) return "nf-admin-chip--pending";
  if (["UNDER_REVIEW", "REVIEWING", "MORE_INFO_REQUIRED", "PROVISIONAL"].includes(v)) return "nf-admin-chip--review";
  if (["APPROVED", "PUBLISHED", "RESOLVED", "CONFIRMED", "COMPLETED", "CLEARED", "REVIEWED", "CLOSED", "ACTIVE"].includes(v)) return "nf-admin-chip--approved";
  if (["REJECTED", "DISMISSED", "SUSPENDED", "CANCELLED", "FAILED", "REVERSED", "NO_SHOW", "BLOCKED"].includes(v)) return "nf-admin-chip--rejected";
  return "";
}

/**
 * Next and Previous, and nothing it cannot stand behind.
 *
 * `full` is whether the page came back with as many rows as it asked for. That
 * is the only evidence a cursor read has that there is more, so it is the only
 * thing Next is offered on. No total, no page count, no "1 of 40": those need a
 * second count query per load and a console that is wrong about how much work
 * is waiting is worse than one that does not say.
 */
export async function QueuePager({
  base,
  query,
  pageSize,
  full,
  count,
}: {
  base: string;
  query: QueueQuery;
  pageSize: number;
  full: boolean;
  /** Rows on this page, so the operator knows what they are looking at. */
  count: number;
}) {
  const offset = query.offset ?? 0;
  if (offset === 0 && !full) return null;
  const page = Math.floor(offset / pageSize) + 1;
  /* Desktop gets the sliding indicator (W8, COMPONENT_LIBRARY "Slide
     pagination"); the phone keeps the two links below, where the numbered row
     would not fit. The words are the shared ones in `experienceUi`. */
  const ui = getDictionary(await getLocale()).experienceUi;

  return (
    <div className="nf-admin-pager-wrap">
      <div className="nf-admin-pager nf-admin-pager--wide">
        <QueueSlidePager
          base={base}
          query={query}
          pageSize={pageSize}
          page={page}
          full={full}
          words={{ label: "Queue pages", previous: ui.previousPage, next: ui.nextPage, page: ui.page }}
        />
        <p className="nf-admin-pager__count">
          Showing {count === 0 ? 0 : offset + 1} to {offset + count}
        </p>
      </div>
    <nav aria-label="Queue pages" className="nf-admin-pager nf-admin-pager--phone">
      <div className="nf-admin-pager__pages">
        {offset > 0 ? (
          <Link
            href={queueHref(base, query, { offset: Math.max(0, offset - pageSize) })}
            className="nf-admin-pager__page"
            aria-label="Previous page"
          >
            <UiIcon name="chevron-right" size={16} className="rotate-180" />
          </Link>
        ) : (
          <span className="nf-admin-pager__page" aria-disabled="true" aria-hidden="true">
            <UiIcon name="chevron-right" size={16} className="rotate-180" />
          </span>
        )}
        {/* The page that is on. No page count, because a cursor read does not
            know how many there are and printing one would be a guess. */}
        {page > 1 && (
          <Link href={queueHref(base, query, { offset: undefined })} className="nf-admin-pager__page">
            1
          </Link>
        )}
        {page > 2 && <span className="nf-admin-pager__count">...</span>}
        <span className="nf-admin-pager__page nf-admin-pager__page--on" aria-current="page">
          {page}
        </span>
        {full ? (
          <Link
            href={queueHref(base, query, { offset: offset + pageSize })}
            className="nf-admin-pager__page"
            aria-label="Next page"
          >
            <UiIcon name="chevron-right" size={16} />
          </Link>
        ) : (
          <span className="nf-admin-pager__page" aria-disabled="true" aria-hidden="true">
            <UiIcon name="chevron-right" size={16} />
          </span>
        )}
      </div>
      <p className="nf-admin-pager__count">
        Showing {count === 0 ? 0 : offset + 1} to {offset + count}
      </p>
    </nav>
    </div>
  );
}
