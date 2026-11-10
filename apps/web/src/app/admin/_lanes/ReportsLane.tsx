import { countOf, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getReports, type ReportView } from "@/lib/admin/queries";
import Link from "next/link";
import { getReportsByCategory, REPORT_CATEGORIES, type ReportCategory } from "@/lib/admin/reads/moderation";
import { countOverdueReports, REPORT_RESPONSE_HOURS } from "@/lib/admin/overdue-reports";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import {
  queueNoMatch,
  QueueFilters,
  QueuePager,
  queueNarrowed,
  readQueueQuery,
  type QueueStatusOption,
} from "../_components/QueueFilters";
import { Constants } from "@/lib/supabase/database.types";
import { ReportDecision } from "../_components/AdminActions";
import { fill, type AdminCommon, type AdminCopy } from "../_components/copy";
import { adminUi, type AdminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { QueueTable, shortRef, type QueueRowData } from "../_components/QueueTable";
import { gradeForReportCategory } from "@/lib/trust/standards";
import { dueChip } from "../_components/due";
import { getOpenContestsByReport, type ContestView } from "@/lib/admin/reads/review-contests";
import { ContestDecision } from "./ContestDecision";

/* V-88: this was the /admin/reports desk; it is the Reports lane of the
   unified queue now (`/admin/queue?tab=reports`), and the old address
   redirects there. */
const BASE = "/admin/queue?tab=reports";

/* V-88 review: the reason chips moved here from the Held lane, as
   `?reason=` filters on the reports themselves. Short words; the rows use
   the full wording. */
const REASON_WORD: Record<(typeof REPORT_CATEGORIES)[number], string> = {
  off_platform_payment: "Payment outside",
  scam: "Scam",
  unsafe: "Unsafe",
  not_as_described: "Not as described",
  unavailable: "Unavailable",
  offensive: "Offensive",
  duplicate: "Duplicate",
  other: "Other",
};

/**
 * Abuse and content reports raised by members.
 *
 * A report names what was reported and why, in the reporter's own words. The
 * three transitions are honest about effort: in review says somebody has it,
 * resolved says action was taken, dismissed says there was nothing to act on.
 *
 * The clock on an open row is the same commitment /standards publishes, derived
 * from the category the reporter chose: off-platform payment, a suspected scam
 * and anything unsafe carry four hours, the rest carry a day. A closed row says
 * who closed it.
 */
function ReportCard({
  report,
  copy,
  common,
  ui,
  contest,
}: {
  report: ReportView;
  copy: AdminCopy["reports"];
  common: AdminCommon;
  ui: AdminUi;
  /** A lister's "Ask Vallo to look at this review" behind this report (host C4). */
  contest?: ContestView;
}) {
  const closed = report.status === "resolved" || report.status === "dismissed" || (report.status as string) === "withdrawn";

  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
      <div className="flex flex-wrap items-center gap-xs">
        <ui.StatusChip status={report.status} />
        {/* NOT `label={report.targetType}`. That printed the column: "listing",
            "post", "user", in whatever case the database spells them, to an
            operator reading a console that is part of Vallo. `columnLabel`
            takes the dictionary's word for it where there is one and falls back
            to the value made readable, never to the value raw. */}
        <ui.StatusChip label={ui.columnLabel("reportTarget", report.targetType)} tone="neutral" />
        {/* The category is what a reviewer triages on, so it sits with the
            status rather than being buried in the body. Rows filed before
            categories existed simply do not carry one. */}
        {report.category && (
          <ui.StatusChip
            label={ui.columnLabel("reportCategory", report.category)}
            tone="neutral"
          />
        )}
        {!closed && (
          <ui.StatusChip
            {...dueChip(report.createdAt, gradeForReportCategory(report.category), common)}
          />
        )}
        <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {ui.when(report.createdAt)}
        </span>
      </div>

      <p className="mt-xs whitespace-pre-wrap break-words text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-primary)]">
        {report.reason}
      </p>

      <p className="mt-xs break-words text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
        {fill(copy.reportedBy, {
          reporter: report.reporterName,
          type: report.targetType,
          id: report.targetId,
        })}
      </p>

      {closed ? (
        <p className="mt-sm text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {fill(copy.closedWhen, { when: ui.when(report.resolvedAt) })}{" "}
          {fill(common.resolvedBy, { who: report.resolvedByName ?? common.someone })}.{" "}
          {common.inAuditLog}
        </p>
      ) : contest ? (
        /* The contest is decided with its own two outcomes (keep, or hide
           behind a public note); they close this report too. */
        <ContestDecision contest={contest} />
      ) : (
        <ReportDecision
          reportId={report.id}
          status={report.status}
          copy={copy}
          common={common}
          reporterNoteLabel={getDictionary("en").platform.queueDesk.reporterNoteLabel}
        />
      )}
    </li>
  );
}

/**
 * The status chips, from the real enum.
 *
 * `report_status` is `open, reviewing, resolved, dismissed`, read from the
 * generated `Constants` rather than written out here, so a value added to the
 * column cannot go missing from the filter. The words come from
 * `t.admin.common.status`, which already holds all four.
 */
function statusFilters(ui: AdminUi): readonly QueueStatusOption[] {
  return Constants.public.Enums.report_status.map((value) => ({
    value,
    label: ui.statusLabel(value),
  }));
}

export async function ReportsLane({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.admin.reports;
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  /* THE SHARED QUEUE FRAME, ON A QUEUE THAT HAD NONE OF IT. This page read the
     newest fifty reports and printed all of them: no search, no status filter,
     no date range, no pagination. The narrowing lives in the query, so the page
     cap applies to the rows that matched rather than to the rows that happened
     to be newest. */
  const query = readQueueQuery(params);
  const rawReason = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  const reason = (REPORT_CATEGORIES as readonly string[]).includes(rawReason ?? "")
    ? (rawReason as ReportCategory)
    : null;
  /* The chosen reason travels in the base, so the search form, the status
     chips and the pager all keep it. */
  const base = reason ? `${BASE}&reason=${reason}` : BASE;
  /*
   * THE PROMISE, MEASURED. `lib/legal/eula.tsx` says "We act on every report
   * within 24 hours" in a document people accept at sign up. This is the
   * instrument for it. It is counted across the WHOLE table rather than across
   * the page's own filter, because a filtered view is the moderator's question
   * and the promise is not.
   */
  const narrowing = {
    ...(query.q ? { q: query.q } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.offset ? { offset: query.offset } : {}),
  };
  const [reports, overdue] = await Promise.all([
    reason ? getReportsByCategory(reason, narrowing) : getReports({
      ...(query.q ? { q: query.q } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.offset ? { offset: query.offset } : {}),
    }),
    countOverdueReports(),
  ]);

  if (reports.state !== "ok") {
    return (
      <div className="nf-console">
        <PageHead title={copy.title} lede={copy.lede} />
        <ui.QueueUnavailable />
      </div>
    );
  }

  const rows = reports.data.rows;
  const open = rows.filter(
    (report) => report.status === "open" || report.status === "reviewing",
  );
  const closed = rows.filter(
    /* V-89: a report its reporter withdrew is closed too. */
    (report) => report.status === "resolved" || report.status === "dismissed" || (report.status as string) === "withdrawn",
  );
  /* A page past the first counts as narrowed for the empty copy. Landing on
     page three of a queue that has run out is a RESULT; "nothing has ever
     arrived here" would be a flat lie told to somebody looking at rows they
     have just paged past. `queueNarrowed` itself deliberately ignores the
     offset, because the Clear control is about the filters. */
  const narrowed = queueNarrowed(query) || (query.offset ?? 0) > 0;
  const contests = await getOpenContestsByReport(
    open.filter((report) => report.targetType === "review").map((report) => report.id),
  );
  const noMatch = queueNoMatch(common);

  return (
    <div className="nf-console">
      <PageHead title={copy.title} lede={copy.lede} trail={<ui.WaitingBadge count={open.length} />} />

      {/*
        A ZERO IS PRINTED AS A ZERO, and null is not printed at all. "Nothing
        is overdue" and "we could not count" are opposite facts, and showing
        one for the other on the instrument that measures a promise made to
        every person who signed up would be the invented number rule 15
        forbids. In words rather than a badge, because a moderator should read
        this rather than glance at a colour.
      */}
      {overdue !== null && (
        <p
          role="status"
          data-testid="reports-overdue"
          className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]"
        >
          {overdue === 0
            ? `Nothing has been waiting longer than ${REPORT_RESPONSE_HOURS} hours. That is the commitment in the Community rules and it is being kept.`
            : `${countOf(overdue, "reportsWaiting")} been waiting longer than ${REPORT_RESPONSE_HOURS} hours. The Community rules promise every person who signed up that we act within ${REPORT_RESPONSE_HOURS} hours.`}
        </p>
      )}

      {/* The reasons a member chose, each a filter on this lane. */}
      <nav aria-label="Reason" className="nf-scroll-x mt-sm flex gap-xs" data-testid="reports-reasons">
        <Link href={BASE} aria-current={reason === null ? "page" : undefined} className="nf-chip min-h-11 whitespace-nowrap">
          All reasons
        </Link>
        {REPORT_CATEGORIES.map((category) => (
          <Link
            key={category}
            href={`${BASE}&reason=${category}`}
            aria-current={reason === category ? "page" : undefined}
            className="nf-chip min-h-11 whitespace-nowrap"
          >
            {REASON_WORD[category]}
          </Link>
        ))}
      </nav>

      <QueueFilters
        base={base}
        query={query}
        common={common}
        statuses={statusFilters(ui)}
      />

      {rows.length === 0 ? (
        /* Neither of these is a clearance. Narrowed, it is the result of the
           operator's own filter; unnarrowed, this table has never held a row.
           The emerald tick belongs to neither. See `QueueEmpty`. */
        <ui.QueueEmpty
          title={narrowed ? noMatch.title : copy.emptyTitle}
          body={narrowed ? noMatch.body : copy.emptyBody}
          state={narrowed ? "no-match" : "never"}
        />
      ) : (
        <>
          {open.length > 0 && (
            <QueueTable
          heads={t.uiCommon.console.table}
          label="Reports"
          rows={open.map((report) => ({
            ...reportRow(report, ui),
            children: (
              <ul className="nf-queue-list">
                <ReportCard key={report.id} report={report} copy={copy} common={common} ui={ui} contest={contests.get(report.id)} />
              </ul>
            ),
          }))}
        />
          )}

          {closed.length > 0 && (
            <section className="mt-xl">
              <h2 className="nf-h3 mb-sm text-[length:var(--nf-text-body)]">{common.recentlyClosed}</h2>
              <QueueTable
          heads={t.uiCommon.console.table}
          label="Reports"
          rows={closed.map((report) => ({
            ...reportRow(report, ui),
            children: (
              <ul className="nf-queue-list">
                <ReportCard key={report.id} report={report} copy={copy} common={common} ui={ui} />
              </ul>
            ),
          }))}
        />
            </section>
          )}
        </>
      )}

      <QueuePager
        base={base}
        query={query}
        pageSize={QUEUE_PAGE_SIZE}
        full={reports.data.full}
        count={rows.length}
      />
    </div>
  );
}

/** The dense row a report takes in the console table. */
function reportRow(report: ReportView, ui: AdminUi): QueueRowData {
  return {
    id: report.id,
    reference: shortRef("RPT", report.id),
    type: "Report",
    icon: "flag",
    title: ui.columnLabel("category", report.category),
    sub: report.reporterName,
    detail: ui.columnLabel("targetType", report.targetType),
    detailSub: report.reason,
    status: report.status,
    statusLabel: ui.statusLabel(report.status),
    submitted: ui.when(report.createdAt),
  };
}
