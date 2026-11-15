import Link from "next/link";
import { getDictionary, type Locale } from "@vallo/i18n";
import { adminUi } from "../_components/ui";
import { PageHead, Panel, PanelEmpty, TabRow } from "../_components/panels";
import type { EscalationListData, EscalationRead } from "@/lib/admin/escalations/read";
import { CATEGORY_LABEL, isClosed, type EscalationRow, type EscalationView } from "@/lib/admin/escalations/types";
import { clockOf, raisedByWords, waitedWords } from "@/lib/admin/escalations/words";
import { deskName } from "./desk-name";
import { ClockWords, ReadState, SeverityBadge, StatusBadge } from "./parts";

/**
 * THE ESCALATIONS DESK: what waits on me, what I raised, and (the COO and the
 * super admin) everything. Each row in plain words: the title, who raised it
 * and from which desk, how urgent, how long it has waited, "due in 2 hours"
 * or "overdue by 3 hours", and where it stands. Overdue rows first.
 *
 * It draws what `listEscalations` answered and nothing else, so the page, the
 * tests and the preview all feed it the same shape.
 */
const COPY = {
  title: "Escalations",
  lede: "What a colleague cannot or may not decide, sent to the people who can. One owner, a response time, and an answer back to the person who raised it.",
  raise: "Raise an escalation",
  tabs: "Which escalations",
  forMe: "Waiting on me",
  mine: "Raised by me",
  all: "All",
  panel: { for_me: "Waiting on you", mine: "Raised by you", all: "Every escalation" },
  empty: {
    for_me: { title: "Nothing is waiting on you", body: "When a colleague escalates something to you or your team, or asks you a question about one you raised, it shows here." },
    mine: { title: "You have not raised anything", body: "Use Escalate at the top of any admin page when you meet something you cannot or may not decide." },
    all: { title: "No escalations yet", body: "Nothing has been raised from any desk." },
  },
  overdueCount: "overdue",
} as const satisfies Record<string, unknown>;

/** Overdue first, then the soonest due; closed ones last, newest first. */
export function sortForDesk(rows: readonly EscalationRow[], nowMs: number): EscalationRow[] {
  const rank = (row: EscalationRow) => (isClosed(row.status) ? 2 : clockOf(row, nowMs).overdue ? 0 : 1);
  return [...rows].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return isClosed(a.status) ? b.updatedAt.localeCompare(a.updatedAt) : a.dueAt.localeCompare(b.dueAt);
  });
}

export function EscalationsDesk({
  read,
  view,
  canSeeAll,
  waiting,
  now,
  locale,
}: {
  read: EscalationRead<EscalationListData>;
  view: EscalationView;
  /** Whether the "All" view is offered (the COO and the super admin). */
  canSeeAll: boolean;
  /** How many wait on the viewer, for the first tab's count; null when unknown. */
  waiting: number | null;
  now: number;
  locale: Locale;
}) {
  const ui = adminUi(getDictionary(locale), locale);
  const rows = read.state === "ok" ? sortForDesk(read.data.rows, now) : [];
  const overdue = rows.filter((row) => clockOf(row, now).overdue).length;
  const showAll = canSeeAll || (read.state === "ok" && read.data.canSeeAll);
  return (
    <div className="nf-console nf-admin-stack" data-testid="escalations-desk" data-view={view}>
      <PageHead
        title={COPY.title}
        lede={COPY.lede}
        action={
          <Link href="/admin/escalations/new" className="nf-btn nf-btn--primary nf-btn--sm" data-testid="escalations-raise">
            {COPY.raise}
          </Link>
        }
      />
      <TabRow
        label={COPY.tabs}
        items={[
          { key: "for_me", href: "/admin/escalations", label: COPY.forMe, active: view === "for_me", ...(waiting !== null ? { count: waiting } : {}) },
          { key: "mine", href: "/admin/escalations?view=mine", label: COPY.mine, active: view === "mine" },
          ...(showAll ? [{ key: "all", href: "/admin/escalations?view=all", label: COPY.all, active: view === "all" }] : []),
        ]}
      />
      <Panel
        title={COPY.panel[view]}
        id="escalations-list"
        flush={rows.length > 0}
        action={overdue > 0 ? <ClockWords words={`${overdue} ${COPY.overdueCount}`} overdue testId="escalations-overdue-count" /> : undefined}
      >
        {read.state !== "ok" ? (
          <ReadState state={read.state} what={COPY.title} locale={locale} />
        ) : rows.length === 0 ? (
          <PanelEmpty title={COPY.empty[view].title} body={COPY.empty[view].body} />
        ) : (
          <ul className="nf-rows nf-group" aria-label={COPY.panel[view]}>
            {rows.map((row) => (
              <EscalationListRow key={row.id} row={row} now={now} when={ui.when} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function EscalationListRow({ row, now, when }: { row: EscalationRow; now: number; when: (iso: string | null) => string }) {
  const clock = clockOf(row, now);
  const waited = waitedWords(row, now);
  return (
    <li
      className="nf-row flex-col items-stretch gap-xs sm:flex-row sm:items-start sm:gap-sm"
      data-testid="escalation-row"
      data-status={row.status}
      data-overdue={clock.overdue ? "true" : "false"}
    >
      <span className="min-w-0 flex-1">
        <Link href={`/admin/escalations/${row.id}`} className="nf-body block min-w-0 break-words font-semibold text-content hover:underline" data-testid="escalation-open">
          {row.title}
        </Link>
        <span className="nf-caption block min-w-0 break-words">{raisedByWords(row, deskName(row.sourceDesk))}</span>
        <span className="nf-caption block min-w-0 break-words">
          <span className="font-mono">{row.reference}</span>
          {` · ${CATEGORY_LABEL[row.category].name}`}
          {waited ? ` · ${waited}` : ""}
          {" · "}
          <time dateTime={row.createdAt}>{when(row.createdAt)}</time>
        </span>
      </span>
      <span className="flex min-w-0 shrink-0 flex-col items-start gap-2xs sm:items-end">
        <span className="flex flex-wrap items-center gap-2xs">
          <SeverityBadge severity={row.severity} />
          <StatusBadge status={row.status} />
        </span>
        {/* A closed one has no clock: its badge already says how it ended. */}
        {isClosed(row.status) ? null : (
          <ClockWords words={clock.words} overdue={clock.overdue} testId="escalation-clock" />
        )}
      </span>
    </li>
  );
}
