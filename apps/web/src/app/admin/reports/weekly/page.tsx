import { countOf } from "@vallo/i18n/core";
import type { Metadata } from "next";
import Link from "next/link";

import { doorWords, requireDeskUser } from "@/lib/admin/my-desk/access";
import { positionTitle } from "@/lib/admin/staff-positions";
import { ROSTER_LABEL, canReview, rosterStatus, summarise, UUID_RE, type RosterStatus } from "@/lib/admin/weekly-reports/model";
import { readWeekTable, readWeeksWithReports, signProofs, type RosterPerson } from "@/lib/admin/weekly-reports/queries";
import { ReportView, withHrefs } from "@/lib/admin/weekly-reports/ReportView";
import { addDays, dateLabel, isWeekStart, weekInfo, weekLabel, weekWindow } from "@/lib/admin/weekly-reports/week";
import { dateTimeLabel } from "@/lib/format/when";

import { Badge, CalmNote, NotWired, PageHead, Panel, type BadgeTone } from "../../_components/panels";
import { ReviewControls } from "./ReviewControls";

export const metadata: Metadata = { title: "Weekly reports", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

const TONE: Record<RosterStatus, BadgeTone> = {
  "not-started": "error",
  draft: "pending",
  reopened: "pending",
  submitted: "info",
  reviewed: "success",
};

function roleLabel(person: Pick<RosterPerson, "kind" | "position">): string {
  if (person.kind === "super_admin") return "Super admin";
  if (person.kind === "admin") return "Admin";
  return positionTitle(person.position) ?? "Staff";
}

function Refusal({ text }: { text: string }) {
  return (
    <div className="nf-console nf-admin-stack">
      <PageHead title="Weekly reports" />
      <Panel>
        <p className="nf-body text-[var(--nf-content-secondary)]">{text}</p>
      </Panel>
    </div>
  );
}

/**
 * THE WEEKLY REPORTS, the reviewer's side: for an admin, a super admin or the
 * COO position. Pick a week, see every current staff member and where their
 * report stands, open any report with its proof, leave a note, mark it
 * reviewed or reopen it.
 */
export default async function WeeklyReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const door = await requireDeskUser();
  if (door.state !== "ok") return <Refusal text={doorWords(door.state)} />;
  if (!canReview(door.who)) return <Refusal text="Weekly reports are reviewed by admins, super admins and the COO. You can file your own under My desk." />;

  const params = await searchParams;
  const now = new Date();
  const latest = weekWindow(now).weekStart;
  const asked = one(params.week);
  const week = asked !== null && isWeekStart(asked) && asked <= latest ? asked : latest;
  const whoParam = one(params.who);
  const table = await readWeekTable(door.db, week);
  const info = weekInfo(week);
  const older = addDays(week, -7);
  const newer = addDays(week, 7);
  const weeksWithReports = table.state === "ok" ? await readWeeksWithReports(door.db) : [];

  const head = <PageHead title="Weekly reports" lede="Every staff member's report for one week. Pick a week, open a report, leave a note, mark it reviewed or reopen it for changes." />;
  if (table.state === "not-open") {
    return (
      <div className="nf-console nf-admin-stack" data-testid="weekly-reports">
        {head}
        <Panel>
          <NotWired what="Weekly reports are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_weekly_reports_2026-11-10.sql." />
        </Panel>
      </div>
    );
  }
  if (table.state === "error") {
    return (
      <div className="nf-console nf-admin-stack" data-testid="weekly-reports">
        {head}
        <Panel>
          <CalmNote kind="error" title="The weekly reports could not be read just now" fills="This is on our side. Refresh to try again." />
        </Panel>
      </div>
    );
  }

  const rows = table.data;
  const summary = summarise(rows);
  const selected = whoParam && UUID_RE.test(whoParam) ? rows.find((r) => r.person.userId === whoParam) : undefined;
  const signed = selected?.report ? await signProofs(door.db, selected.report.proofs) : new Map<string, string>();

  return (
    <div className="nf-console nf-admin-stack" data-testid="weekly-reports">
      {head}
      <Panel title={weekLabel(week)}>
        <nav className="flex flex-wrap items-center gap-xs" aria-label="Choose a week">
          <Link className="nf-btn nf-btn--sm nf-btn--quiet" href={`/admin/reports/weekly?week=${older}`}>
            Earlier week
          </Link>
          {week < latest ? (
            <Link className="nf-btn nf-btn--sm nf-btn--quiet" href={`/admin/reports/weekly?week=${newer}`}>
              Later week
            </Link>
          ) : null}
          {week !== latest ? (
            <Link className="nf-btn nf-btn--sm nf-btn--quiet" href="/admin/reports/weekly">
              Latest week
            </Link>
          ) : null}
          <a className="nf-btn nf-btn--sm nf-btn--secondary" href={`/admin/reports/weekly/export?week=${week}`}>
            Download as CSV
          </a>
        </nav>
        {weeksWithReports.length > 0 ? (
          <p className="nf-caption mt-xs text-[var(--nf-content-secondary)]">
            Weeks with reports:{" "}
            {weeksWithReports.slice(0, 8).map((w, i) => (
              <span key={w}>
                {i > 0 ? ", " : ""}
                <Link href={`/admin/reports/weekly?week=${w}`} className="text-[var(--nf-content-link)] hover:underline">
                  {weekLabel(w)}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
        <p className="nf-body mt-sm" data-testid="weekly-summary">
          Submitted {summary.submitted} of {summary.people}, late {summary.late}, reviewed {summary.reviewed}. {countOf(summary.people, "people", "en")} on the list. Due {dateTimeLabel(info.dueAt)}.
        </p>
      </Panel>

      <Panel title="Everyone this week" flush>
        {rows.length === 0 ? (
          <p className="nf-body p-md text-[var(--nf-content-secondary)]">Nobody holds staff access yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full nf-body-sm" data-testid="weekly-table">
              <thead>
                <tr className="text-left text-[var(--nf-content-secondary)]">
                  <th className="p-sm font-semibold">Name</th>
                  <th className="p-sm font-semibold">Position</th>
                  <th className="p-sm font-semibold">Status</th>
                  <th className="p-sm font-semibold">Submitted</th>
                  <th className="p-sm font-semibold">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ person, report }) => {
                  const status = rosterStatus(report);
                  return (
                    <tr key={person.userId} data-testid="weekly-row" data-status={status}>
                      <td className="p-sm font-semibold">{person.name}</td>
                      <td className="p-sm">{roleLabel(person)}</td>
                      <td className="p-sm">
                        <Badge tone={TONE[status]}>{ROSTER_LABEL[status]}</Badge>
                        {report?.isLate && (status === "submitted" || status === "reviewed") ? (
                          <>
                            {" "}
                            <Badge tone="pending">Late</Badge>
                          </>
                        ) : null}
                      </td>
                      <td className="p-sm">{report?.submittedAt ? dateTimeLabel(report.submittedAt) : ""}</td>
                      <td className="p-sm">
                        {report ? (
                          <Link href={`/admin/reports/weekly?week=${week}&who=${person.userId}#report`} className="font-semibold text-[var(--nf-content-link)] hover:underline">
                            Open
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected ? (
        <Panel title={`${selected.person.name}, ${roleLabel(selected.person)}`} id="report">
          {selected.report ? (
            <div className="grid gap-md">
              <p className="nf-body-sm text-[var(--nf-content-secondary)]">
                {ROSTER_LABEL[rosterStatus(selected.report)]}
                {selected.report.submittedAt ? ` · submitted ${dateTimeLabel(selected.report.submittedAt)}` : ""}
                {selected.report.isLate ? " · filed late" : ""}
              </p>
              {selected.report.reviewNote ? (
                <p className="nf-body-sm" role="note">
                  Note: {selected.report.reviewNote}
                </p>
              ) : null}
              <ReportView report={selected.report} proofs={withHrefs(selected.report.proofs, signed)} />
              <ReviewControls reportId={selected.report.id} status={selected.report.status} ownReport={selected.person.userId === door.who.userId} />
            </div>
          ) : (
            <p className="nf-body-sm text-[var(--nf-content-secondary)]">{dateLabel(info.weekStart)}: nothing has been started for this week.</p>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
