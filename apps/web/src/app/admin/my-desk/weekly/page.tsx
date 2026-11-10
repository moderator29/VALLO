import type { Metadata } from "next";
import Link from "next/link";

import { doorWords, requireDeskUser } from "@/lib/admin/my-desk/access";
import { FORM_HELP, STATUS_LABEL, canEdit, weeklyState, type WeeklyReport, type WeeklyState } from "@/lib/admin/weekly-reports/model";
import { readDeskRows, readHistory, readReport, signProofs } from "@/lib/admin/weekly-reports/queries";
import { ReportView, withHrefs } from "@/lib/admin/weekly-reports/ReportView";
import { addDays, dateLabel, formIsOpen, isWeekStart, weekInfo, weekLabel, weekWindow } from "@/lib/admin/weekly-reports/week";
import { dateTimeLabel } from "@/lib/format/when";

import { Badge, CalmNote, NotWired, PageHead, Panel } from "../../_components/panels";
import { WeeklyReportForm } from "./WeeklyReportForm";

export const metadata: Metadata = { title: "Weekly report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

const STATE_WORDS: Record<WeeklyState, string> = {
  "opens-saturday": "Not open yet",
  open: "Open",
  overdue: "Overdue",
  submitted: "Submitted",
  reviewed: "Reviewed",
};

function Preview() {
  return (
    <ul className="grid gap-sm" data-testid="weekly-preview">
      {(["accomplishments", "numbers", "blockers", "nextWeek", "proofs"] as const).map((k) => (
        <li key={k}>
          <p className="nf-body font-semibold">{FORM_HELP[k].title}</p>
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">{FORM_HELP[k].help}</p>
        </li>
      ))}
    </ul>
  );
}

function History({ reports, current }: { reports: WeeklyReport[]; current: string }) {
  return (
    <Panel title="Your past reports">
      {reports.length === 0 ? (
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">Nothing filed yet. Your reports are listed here, newest week first.</p>
      ) : (
        <ul className="nf-admin-queue" data-testid="weekly-history">
          {reports.map((r) => (
            <li key={r.id} className="nf-admin-queue-row">
              <p className="font-semibold">
                <Link href={`/admin/my-desk/weekly?week=${r.weekStart}`} className="text-[var(--nf-content-link)] hover:underline" aria-current={r.weekStart === current ? "page" : undefined}>
                  {weekLabel(r.weekStart)}
                </Link>{" "}
                <Badge tone={r.status === "reviewed" ? "success" : r.status === "submitted" ? "info" : "pending"}>{STATUS_LABEL[r.status]}</Badge>
                {r.isLate ? (
                  <>
                    {" "}
                    <Badge tone="pending">Late</Badge>
                  </>
                ) : null}
              </p>
              {r.submittedAt ? <p className="nf-caption text-[var(--nf-content-secondary)]">Submitted {dateTimeLabel(r.submittedAt)}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * THE WEEKLY REPORT, the person's side. One report per person per week (Monday
 * to Sunday, Lagos time). The form opens Saturday 00:00 and is due Monday
 * 12:00; before it opens the page shows when, and what will be asked.
 */
export default async function WeeklyReportPage({ searchParams }: { searchParams: Promise<Params> }) {
  const door = await requireDeskUser();
  if (door.state !== "ok") {
    return (
      <div className="nf-console nf-admin-stack">
        <PageHead title="Weekly report" />
        <Panel>
          <p className="nf-body text-[var(--nf-content-secondary)]">{doorWords(door.state)}</p>
        </Panel>
      </div>
    );
  }
  const { db, who } = door;
  const params = await searchParams;
  const now = new Date();
  const window = weekWindow(now);
  const asked = one(params.week);
  const explicit = asked !== null && isWeekStart(asked) && formIsOpen(asked, now) ? asked : null;
  const week = explicit ?? window.weekStart;
  const info = weekInfo(week);

  const [reportRead, historyRead] = await Promise.all([readReport(db, who.userId, week), readHistory(db, who.userId)]);
  const head = <PageHead title="Weekly report" lede="Write up your week and add your proof. One report each week, Monday to Sunday, Lagos time. It opens on Saturday and is due Monday at 12:00." />;
  if (reportRead.state === "not-open") {
    return (
      <div className="nf-console nf-admin-stack" data-testid="weekly-report">
        {head}
        <Panel>
          <NotWired what="Weekly reports are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_weekly_reports_2026-11-10.sql." />
        </Panel>
      </div>
    );
  }
  if (reportRead.state === "error") {
    return (
      <div className="nf-console nf-admin-stack" data-testid="weekly-report">
        {head}
        <Panel>
          <CalmNote kind="error" title="Your weekly report could not be read just now" fills="This is on our side. Refresh to try again." />
        </Panel>
      </div>
    );
  }

  const report = reportRead.data;
  const history = historyRead.state === "ok" ? historyRead.data : [];
  const state = weeklyState(info, report?.status ?? null, now, explicit === null);
  const saturday = dateLabel(addDays(window.nextWeekStart, 5));
  const editable = state !== "opens-saturday" && state !== "reviewed" && canEdit(report?.status ?? null);

  const deskRows = editable ? await readDeskRows(db, who.userId, who.position, week) : [];
  const signed = report ? await signProofs(db, report.proofs) : new Map<string, string>();
  const proofs = report ? withHrefs(report.proofs, signed) : [];

  return (
    <div className="nf-console nf-admin-stack" data-testid="weekly-report" data-state={state}>
      {head}
      {state === "opens-saturday" ? (
        <Panel title={`Opens Saturday ${saturday}`}>
          <p className="nf-body mb-sm" data-testid="weekly-opens">
            Your next weekly report opens on Saturday, {saturday}, at midnight Lagos time. Here is what it will ask.
          </p>
          <Preview />
        </Panel>
      ) : (
        <Panel title={weekLabel(week)}>
          <p className="nf-body mb-sm" data-testid="weekly-status">
            <Badge tone={state === "overdue" ? "error" : state === "open" ? "pending" : "success"}>{STATE_WORDS[state]}</Badge>{" "}
            {state === "overdue"
              ? `This report was due ${dateTimeLabel(info.dueAt)}. You can still file it; it will be marked late.`
              : state === "open"
                ? `Due ${dateTimeLabel(info.dueAt)}.`
                : state === "submitted"
                  ? "Submitted. You can still change it until a reviewer has looked at it."
                  : "A reviewer has looked at this report. It is read-only."}
            {report?.isLate ? " Filed late." : ""}
          </p>
          {report?.reviewNote && (report.status === "reviewed" || report.status === "reopened") ? (
            <p className="nf-body-sm mb-sm" role="note" data-testid="weekly-review-note">
              Reviewer note: {report.reviewNote}
            </p>
          ) : null}
          {editable ? (
            <WeeklyReportForm
              key={`${week}-${report?.status ?? "none"}`}
              week={week}
              status={report?.status ?? null}
              accomplishments={report?.accomplishments ?? ""}
              blockers={report?.blockers ?? ""}
              nextWeek={report?.nextWeek ?? ""}
              numbers={report && report.numbers.length > 0 ? report.numbers : deskRows}
              deskRows={deskRows}
              proofs={proofs}
              isLate={report?.isLate ?? false}
              reviewNote={report?.reviewNote ?? null}
            />
          ) : report ? (
            <ReportView report={report} proofs={proofs} />
          ) : null}
        </Panel>
      )}
      <History reports={history} current={week} />
    </div>
  );
}
