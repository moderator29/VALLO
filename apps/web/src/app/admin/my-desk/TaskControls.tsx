"use client";

import Link from "next/link";
import { useState } from "react";

import { FieldProblem } from "@/components/ui/FieldProblem";
import { addTaskComment, createTask, reassignTask, setTaskStatus, type TaskInput } from "@/lib/admin/my-desk/actions";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskComment,
} from "@/lib/admin/my-desk/model";

import { Badge, type BadgeTone } from "../_components/Badge";
import { useDesk } from "./useDesk";

/**
 * MY DESK'S TASK CONTROLS. English throughout, a banner for every outcome,
 * nothing optimistic. Every call goes to `lib/admin/my-desk/actions`, which
 * checks the caller again; hiding a control here is a courtesy, not the lock.
 */

export type Person = { id: string; name: string };
export type DeskOption = { value: string; label: string };

const EMPTY: TaskInput = { title: "", detail: "", assignedTo: "", dueDate: "", priority: "normal", relatedDesk: "", relatedLink: "" };

export function NewTaskForm({ canAssign, people, desks }: { canAssign: boolean; people: Person[]; desks: DeskOption[] }) {
  const { pending, run } = useDesk();
  const [input, setInput] = useState<TaskInput>(EMPTY);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setInput((v) => ({ ...v, [key]: value }));
  const mark = (key: string) => (problems[key] ? { "aria-invalid": true as const, "aria-describedby": `task-${key}-problem` } : {});

  return (
    <form
      className="grid gap-sm"
      data-testid="my-desk-new-task"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => createTask(input), "Task created", () => { setInput(EMPTY); setProblems({}); }, setProblems);
      }}
    >
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Title</span>
        <input className="nf-field" value={input.title} maxLength={200} onChange={(e) => set("title", e.target.value)} {...mark("title")} />
        <FieldProblem id="task-title-problem" message={problems.title} />
      </label>
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Detail (optional)</span>
        <textarea className="nf-field" rows={3} maxLength={4000} value={input.detail} onChange={(e) => set("detail", e.target.value)} {...mark("detail")} />
        <FieldProblem id="task-detail-problem" message={problems.detail} />
      </label>
      <div className="grid gap-sm sm:grid-cols-2">
        {canAssign ? (
          <label className="grid gap-3xs">
            <span className="nf-caption text-[var(--nf-content-secondary)]">Assign to</span>
            <select className="nf-field" value={input.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} {...mark("assignedTo")}>
              <option value="">Me</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <FieldProblem id="task-assignedTo-problem" message={problems.assignedTo} />
          </label>
        ) : null}
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Due date (optional)</span>
          <input type="date" className="nf-field" value={input.dueDate} onChange={(e) => set("dueDate", e.target.value)} {...mark("dueDate")} />
          <FieldProblem id="task-dueDate-problem" message={problems.dueDate} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Priority</span>
          <select className="nf-field" value={input.priority} onChange={(e) => set("priority", e.target.value)} {...mark("priority")}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <FieldProblem id="task-priority-problem" message={problems.priority} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Related desk (optional)</span>
          <select className="nf-field" value={input.relatedDesk} onChange={(e) => set("relatedDesk", e.target.value)} {...mark("relatedDesk")}>
            <option value="">None</option>
            {desks.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <FieldProblem id="task-relatedDesk-problem" message={problems.relatedDesk} />
        </label>
      </div>
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Console link (optional, starts with /admin)</span>
        <input className="nf-field" placeholder="/admin/support" value={input.relatedLink} onChange={(e) => set("relatedLink", e.target.value)} {...mark("relatedLink")} />
        <FieldProblem id="task-relatedLink-problem" message={problems.relatedLink} />
      </label>
      <div>
        <button type="submit" className="nf-btn nf-btn--primary nf-btn--sm" disabled={pending}>
          Create task
        </button>
      </div>
    </form>
  );
}

const STATUS_TONE: Record<Task["status"], BadgeTone> = {
  todo: "info",
  in_progress: "pending",
  blocked: "error",
  done: "success",
};

export function TaskCard({
  task,
  comments,
  viewerId,
  names,
  overdue,
  canAssign,
  people,
  canComment,
}: {
  task: Task;
  comments: TaskComment[];
  viewerId: string;
  names: Record<string, string>;
  overdue: boolean;
  canAssign: boolean;
  people: Person[];
  canComment: boolean;
}) {
  const { pending, run } = useDesk();
  const [comment, setComment] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const isAssignee = task.assignedTo === viewerId;
  const nameOf = (id: string | null) => (id ? (id === viewerId ? "You" : (names[id] ?? "A member of staff")) : "A removed account");

  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md" data-testid="my-desk-task" data-overdue={overdue ? "true" : undefined}>
      <div className="flex flex-wrap items-center gap-xs">
        <span className="font-semibold text-[var(--nf-content-primary)] [overflow-wrap:anywhere]">{task.title}</span>
        <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
        {overdue ? <Badge tone="error">Overdue</Badge> : null}
        {task.priority === "urgent" || task.priority === "high" ? <Badge tone="pending">{PRIORITY_LABEL[task.priority]}</Badge> : null}
      </div>
      {task.detail ? <p className="nf-body-sm mt-xs whitespace-pre-wrap">{task.detail}</p> : null}
      <p className="nf-caption mt-xs text-[var(--nf-content-secondary)]">
        Assigned to {nameOf(task.assignedTo)}. Created by {nameOf(task.createdBy)}.
        {task.dueDate ? ` Due ${task.dueDate}.` : " No due date."}
        {task.relatedLink ? (
          <>
            {" "}
            <Link href={task.relatedLink} className="underline">
              Open the related page
            </Link>
          </>
        ) : null}
      </p>

      <div className="mt-sm flex flex-wrap items-end gap-sm">
        {isAssignee ? (
          <label className="grid gap-3xs">
            <span className="nf-caption text-[var(--nf-content-secondary)]">Status</span>
            <select
              className="nf-field"
              value={task.status}
              disabled={pending}
              onChange={(e) => {
                const from = task.status;
                const to = e.target.value;
                /* Undo moves it back; the server refuses if someone moved it since. */
                run(() => setTaskStatus(task.id, to), {
                  message: `Status changed to ${STATUS_LABEL[to as Task["status"]] ?? to}`,
                  undo: () => setTaskStatus(task.id, from),
                  undone: `Status is back to ${STATUS_LABEL[from]}`,
                });
              }}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {canAssign && task.status !== "done" ? (
          <label className="grid gap-3xs">
            <span className="nf-caption text-[var(--nf-content-secondary)]">Reassign</span>
            <select
              className="nf-field"
              value=""
              disabled={pending}
              onChange={(e) => {
                const to = e.target.value;
                if (!to) return;
                const before = task.assignedTo;
                const toName = people.find((p) => p.id === to)?.name ?? "that person";
                /* Undo hands it back; with nobody to hand it back to, it only confirms. */
                run(
                  () => reassignTask(task.id, to),
                  before
                    ? {
                        message: `Task reassigned to ${toName}`,
                        undo: () => reassignTask(task.id, before),
                        undone: before === viewerId ? "Task is back with you" : `Task is back with ${nameOf(before)}`,
                      }
                    : `Task reassigned to ${toName}`,
                );
              }}
            >
              <option value="">Choose a person</option>
              {people
                .filter((p) => p.id !== task.assignedTo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="mt-sm grid gap-xs">
        <p className="nf-caption font-semibold">Comments: {comments.length}</p>
        {comments.length > 0 ? (
          <ul className="grid gap-3xs">
            {comments.map((c) => (
              <li key={c.id} className="nf-body-sm">
                <span className="font-semibold">{nameOf(c.authorId)}</span>: <span className="whitespace-pre-wrap">{c.body}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {canComment ? (
          <form
            className="grid gap-xs"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => addTaskComment(task.id, comment), "Comment added", () => { setComment(""); setProblem(undefined); }, (f) => setProblem(f.body));
            }}
          >
            <label className="grid gap-3xs">
              <span className="sr-only">Add a comment</span>
              <textarea
                className="nf-field"
                rows={2}
                maxLength={2000}
                placeholder="Add a comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `comment-${task.id}-problem` : undefined}
              />
              <FieldProblem id={`comment-${task.id}-problem`} message={problem} />
            </label>
            <div>
              <button type="submit" className="nf-btn nf-btn--glass nf-btn--sm" disabled={pending}>
                Comment
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </li>
  );
}
