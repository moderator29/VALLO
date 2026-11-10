import type { Metadata } from "next";

import { STAFF_SCOPE_LABEL } from "@/lib/admin/guard";
import { requireDeskUser } from "@/lib/admin/my-desk/access";
import { DESK_SCOPES, isOverdue, sortTasks, totalsFor, type TaskComment } from "@/lib/admin/my-desk/model";
import { readMyTasks, readNames, readStaffDirectory, readTaskComments } from "@/lib/admin/my-desk/queries";

import { CalmNote, NotWired, PageHead, Panel } from "../../_components/panels";
import { DeskTabs } from "../DeskTabs";
import { DeskRefusal } from "../refusal";
import { NewTaskForm, TaskCard } from "../TaskControls";

export const metadata: Metadata = { title: "My tasks", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * MY TASKS. Tasks assigned to me, overdue first, and tasks I handed to
 * somebody else. Assigning to a colleague is offered only to the COO, the
 * operations access area and admins; the server action checks it again.
 */
export default async function MyTasksPage() {
  const door = await requireDeskUser();
  if (door.state !== "ok") return <DeskRefusal state={door.state} title="My tasks" />;
  const { who, db } = door;

  const read = await readMyTasks(db, who.userId);
  const tasks = read.state === "ok" ? read.data : [];
  const commentsRead = await readTaskComments(db, tasks.map((t) => t.id));
  const comments: TaskComment[] = commentsRead.state === "ok" ? commentsRead.data : [];
  const people = door.canAssign ? await readStaffDirectory() : [];
  const names = await readNames([
    ...tasks.flatMap((t) => [t.assignedTo, t.createdBy]),
    ...comments.map((c) => c.authorId),
  ].filter((v): v is string => typeof v === "string"));
  const nameRecord: Record<string, string> = Object.fromEntries(names);

  const mine = sortTasks(tasks.filter((t) => t.assignedTo === who.userId));
  const handed = sortTasks(tasks.filter((t) => t.createdBy === who.userId && t.assignedTo !== who.userId));
  const totals = totalsFor(mine);
  const desks = DESK_SCOPES.map((value) => ({ value, label: STAFF_SCOPE_LABEL[value] }));
  const byTask = (id: string) => comments.filter((c) => c.taskId === id);

  const card = (t: (typeof tasks)[number]) => (
    <TaskCard
      key={t.id}
      task={t}
      comments={byTask(t.id)}
      viewerId={who.userId}
      names={nameRecord}
      overdue={isOverdue(t)}
      canAssign={door.canAssign}
      people={people}
      canComment
    />
  );

  return (
    <div className="nf-console nf-admin-stack" data-testid="my-desk-tasks">
      <PageHead title="My tasks" lede="What is assigned to you, overdue first, and what you have handed to others." />
      <DeskTabs active="tasks" />
      {read.state === "not-open" ? (
        <Panel>
          <NotWired
            what="The tasks table is not on this database yet."
            request="Ask the lead to apply supabase/migrations/pending/staff_tasks_announcements_2026-11-10.sql."
          />
        </Panel>
      ) : null}
      {read.state === "error" ? (
        <Panel>
          <p className="nf-body text-[var(--nf-content-secondary)]">Your tasks could not be read just now. Reload in a moment.</p>
        </Panel>
      ) : null}
      <Panel title="New task">
        <NewTaskForm canAssign={door.canAssign} people={people} desks={desks} />
        {!door.canAssign ? (
          <p className="nf-caption mt-sm text-[var(--nf-content-secondary)]">
            You can create tasks for yourself. Assigning to a colleague is for the COO, the operations team and admins.
          </p>
        ) : null}
      </Panel>
      <Panel title="Assigned to me">
        <p className="nf-caption mb-sm text-[var(--nf-content-secondary)]" data-testid="my-desk-task-totals">
          Open: {totals.open}. Overdue: {totals.overdue}. Completed this week: {totals.completedThisWeek}.
        </p>
        {mine.length === 0 ? (
          <CalmNote title="No tasks assigned to you" fills="Tasks assigned to you appear here." creates="Create one above." />
        ) : (
          <ul className="grid gap-sm">{mine.map(card)}</ul>
        )}
      </Panel>
      <Panel title="Handed to others">
        {handed.length === 0 ? (
          <CalmNote title="Nothing handed to others" fills="Tasks you assign to a colleague appear here." />
        ) : (
          <ul className="grid gap-sm">{handed.map(card)}</ul>
        )}
      </Panel>
    </div>
  );
}
