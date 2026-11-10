import type { Metadata } from "next";
import Link from "next/link";

import { AdminCopilot } from "@/components/admin/copilot/AdminCopilot";
import { STAFF_SCOPE_LABEL } from "@/lib/admin/guard";
import { requireDeskUser } from "@/lib/admin/my-desk/access";
import {
  attentionRows,
  departmentFor,
  totalsFor,
  type Task,
} from "@/lib/admin/my-desk/model";
import { readAnnouncements, readMyTasks, readNames } from "@/lib/admin/my-desk/queries";
import { getQueueCounts } from "@/lib/admin/queries";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";

import { Badge, CalmNote, NotWired, PageHead, Panel } from "../_components/panels";
import { STAFF_DESK } from "../_components/StaffFrame";
import { WeeklyReportBanner } from "@/lib/admin/weekly-reports/WeeklyReportBanner";
import { DeskTabs } from "./DeskTabs";
import { DeskRefusal } from "./refusal";

export const metadata: Metadata = { title: "My desk", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * MY DESK (founder, 10 November 2026): the personal workspace of any
 * signed-in staff member or admin. Who they are, where they sit, what they
 * are responsible for, what needs them today, and where the guidance and the
 * copilot are. Every figure is a database count or a count of the person's
 * own rows; where there is no cheap honest count the row is a link only.
 */
export default async function MyDeskPage() {
  const door = await requireDeskUser();
  if (door.state !== "ok") return <DeskRefusal state={door.state} title="My desk" />;
  const { who, db } = door;

  const [tasksRead, announcementsRead, queueCounts, names, weeklyBanner] = await Promise.all([
    readMyTasks(db, who.userId),
    readAnnouncements(db, who),
    getQueueCounts(),
    readNames([who.userId]),
    WeeklyReportBanner({ db, userId: who.userId }),
  ]);
  const tasksOpen = tasksRead.state === "ok";
  const mine: Task[] = tasksRead.state === "ok" ? tasksRead.data.filter((t) => t.assignedTo === who.userId) : [];
  const totals = totalsFor(mine);
  const unread = announcementsRead.state === "ok" ? announcementsRead.data.filter((a) => !a.read).length : null;
  const counts = queueCounts.state === "ok" ? (queueCounts.data as unknown as Record<string, number>) : null;
  const rows = attentionRows(who.scopes, counts, STAFF_DESK);

  const job = who.position ? JOB_DESCRIPTIONS[who.position] : null;
  const name = names.get(who.userId) ?? "You";
  const roleLabel = job ? job.title : who.isSuperAdmin ? "Super admin" : who.isAdmin ? "Admin" : "Staff";
  const department = departmentFor(who);
  const areas = who.scopes.length > 0 ? who.scopes.map((s) => STAFF_SCOPE_LABEL[s]).join(", ") : who.isAdmin || who.isSuperAdmin ? "Every desk, through the admin role" : "None yet";

  const context = [
    `Position: ${roleLabel}. Department: ${department}.`,
    tasksOpen ? `Tasks assigned to them: ${totals.open} open, ${totals.overdue} overdue, ${totals.completedThisWeek} completed this week.` : null,
    unread !== null ? `Unread announcements: ${unread}.` : null,
    ...rows.filter((r) => r.count !== null).map((r) => `${STAFF_SCOPE_LABEL[r.scope]} desk waiting: ${r.count}.`),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="nf-console nf-admin-stack" data-testid="my-desk">
      <PageHead title="My desk" lede="Your workspace: who you are here, what needs you, your tasks and announcements, and where to find the guidance." />
      <DeskTabs active="desk" />
      {weeklyBanner}

      <Panel title="Who you are">
        <dl className="grid gap-xs sm:grid-cols-2" data-testid="my-desk-identity">
          <div>
            <dt className="nf-caption text-[var(--nf-content-secondary)]">Name</dt>
            <dd className="nf-body font-semibold">{name}</dd>
          </div>
          <div>
            <dt className="nf-caption text-[var(--nf-content-secondary)]">Position</dt>
            <dd className="nf-body font-semibold">{roleLabel}</dd>
          </div>
          <div>
            <dt className="nf-caption text-[var(--nf-content-secondary)]">Department</dt>
            <dd className="nf-body">{department}</dd>
          </div>
          <div>
            <dt className="nf-caption text-[var(--nf-content-secondary)]">Reports to</dt>
            <dd className="nf-body">{job ? job.reportsTo : who.isSuperAdmin ? "The founder" : "Not recorded for this account"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="nf-caption text-[var(--nf-content-secondary)]">Access areas</dt>
            <dd className="nf-body">{areas}</dd>
          </div>
        </dl>
        {job ? <p className="nf-body mt-sm">{job.summary}</p> : null}
      </Panel>

      <Panel title="Needs your attention">
        <ul className="grid gap-xs" data-testid="my-desk-attention">
          <li className="flex flex-wrap items-center gap-xs">
            <Link href="/admin/my-desk/tasks" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Your tasks
            </Link>
            {tasksOpen ? (
              <>
                <span className="nf-body-sm">Open: {totals.open}</span>
                {totals.overdue > 0 ? <Badge tone="error">Overdue: {totals.overdue}</Badge> : <span className="nf-body-sm">Overdue: 0</span>}
              </>
            ) : (
              <span className="nf-body-sm text-[var(--nf-content-secondary)]">{tasksRead.state === "not-open" ? "Not set up yet" : "Could not be read"}</span>
            )}
          </li>
          <li className="flex flex-wrap items-center gap-xs">
            <Link href="/admin/my-desk/announcements" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Announcements
            </Link>
            {unread !== null ? (
              <span className="nf-body-sm">Unread: {unread}</span>
            ) : (
              <span className="nf-body-sm text-[var(--nf-content-secondary)]">{announcementsRead.state === "not-open" ? "Not set up yet" : "Could not be read"}</span>
            )}
          </li>
          {rows.map((row) => (
            <li key={row.scope} className="flex flex-wrap items-center gap-xs">
              <Link href={row.href} className="font-semibold text-[var(--nf-content-link)] hover:underline">
                {STAFF_SCOPE_LABEL[row.scope]}
              </Link>
              {row.count !== null ? (
                <span className="nf-body-sm">Waiting: {row.count}</span>
              ) : (
                <span className="nf-body-sm text-[var(--nf-content-secondary)]">Open the desk</span>
              )}
            </li>
          ))}
        </ul>
        {counts === null && rows.length > 0 ? (
          <p className="nf-caption mt-sm text-[var(--nf-content-secondary)]">The desk counts could not be read just now, so the desks are listed without a figure.</p>
        ) : null}
        {tasksRead.state === "not-open" || announcementsRead.state === "not-open" ? (
          <div className="mt-sm">
            <NotWired
              what="Tasks and announcements are not on this database yet."
              request="Ask the lead to apply supabase/migrations/pending/staff_tasks_announcements_2026-11-10.sql."
            />
          </div>
        ) : null}
      </Panel>

      <Panel title="This week">
        {tasksOpen ? (
          <p className="nf-body" data-testid="my-desk-completed">
            Completed this week: {totals.completedThisWeek}
          </p>
        ) : (
          <CalmNote title="Nothing to count yet" fills="Completed tasks appear here once tasks are set up." />
        )}
      </Panel>

      {job ? (
        <>
          <Panel title="What you are responsible for">
            <ul className="grid gap-xs" data-testid="my-desk-responsibilities">
              {job.responsibilities.map((point) => (
                <li key={point} className="nf-body">
                  {point}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="What is expected of you">
            <ul className="grid gap-xs">
              {job.expectations.map((point) => (
                <li key={point} className="nf-body">
                  {point}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : (
        <Panel title="Your responsibilities">
          <p className="nf-body">
            Your access was given by role or access area rather than a named position. Read the{" "}
            <Link href="/admin/handbook/position" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              positions page
            </Link>{" "}
            for what each position covers.
          </p>
        </Panel>
      )}

      <Panel title="Where to find guidance">
        <ul className="grid gap-xs">
          <li>
            <Link href="/admin/handbook/position" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Your position page
            </Link>
          </li>
          <li>
            <Link href="/admin/handbook" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              The staff handbook
            </Link>
          </li>
          <li>
            <Link href="/admin/manual/my-desk" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Staff manual: My desk, tasks and announcements
            </Link>
          </li>
        </ul>
        <p className="nf-body mt-sm">Stuck? Open the copilot with the button at the corner of this page and ask it in plain words.</p>
      </Panel>

      <AdminCopilot
        scope={door.copilotScope}
        position={who.position}
        deskName="My desk"
        context={context}
        greeting={job ? job.summary : "Ask me where to find something in the console."}
      />
    </div>
  );
}
