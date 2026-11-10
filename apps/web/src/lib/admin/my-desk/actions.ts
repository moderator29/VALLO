"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { writeAudit } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNotLive } from "@/lib/features/degrade";

import { doorWords, requireDeskUser } from "./access";
import {
  ANNOUNCE_BODY_MAX,
  ANNOUNCE_TITLE_MAX,
  COMMENT_MAX,
  DETAIL_MAX,
  TITLE_MAX,
  canSeeAnnouncement,
  isAudience,
  isDeskScope,
  isInternalAdminLink,
  isIsoDate,
  isTaskPriority,
  isTaskStatus,
  type DeskIdentity,
  type TaskPriority,
  type TaskStatus,
} from "./model";
import { readStaffIds } from "./queries";

/**
 * MY DESK'S WRITES: tasks, task comments and announcements.
 *
 * Every action starts at `requireDeskUser()`, which asks the database who the
 * caller is, and every input is validated BEFORE anything is written. The
 * rules (`./model.ts`):
 *   - anyone with console access creates a task for themselves;
 *   - assigning to somebody else needs the COO position, the operations
 *     scope, or an admin or super admin role, and the assignee must be a real
 *     member of staff;
 *   - only the assignee moves a task's status;
 *   - the assignee, the person who created it, and any admin comment;
 *   - only the COO, an admin or a super admin post or pin an announcement.
 * Every write is audited with `writeAudit`; a failed audit line is told to
 * the caller, never swallowed. Marking an announcement read is a personal
 * marker, not a decision, and is not audited.
 */

const NOT_OPEN = "My Desk is not set up on this server yet. Ask the lead to apply the pending migration.";
const FAILED = "That did not go through. Try again.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASKS = "/admin/my-desk/tasks";
const ANNOUNCEMENTS = "/admin/my-desk/announcements";
const HOME = "/admin/my-desk";

type Desk = { db: SupabaseClient; who: DeskIdentity; canAssign: boolean; canAnnounce: boolean };

async function desk(): Promise<Desk | { error: string }> {
  const door = await requireDeskUser();
  if (door.state !== "ok") return { error: doorWords(door.state) };
  return { db: door.db, who: door.who, canAssign: door.canAssign, canAnnounce: door.canAnnounce };
}

function words(error: unknown): string {
  if (isNotLive(error)) return NOT_OPEN;
  if ((error as { code?: string } | null)?.code === "42501") return "Your access does not allow this.";
  return FAILED;
}

async function audit(
  d: Desk,
  action: string,
  entityType: "staff_task" | "staff_announcement",
  entityId: string | null,
  detail: Record<string, string | number | boolean | null> = {},
): Promise<string | null> {
  let written = false;
  try {
    written = await writeAudit(createAdminClient(), { actorId: d.who.userId, action, entityType, entityId, detail });
  } catch {
    written = false;
  }
  return written ? null : "Done, but the audit line could not be written. Operations has been alerted.";
}

export type TaskInput = {
  title: string;
  detail: string;
  /** Empty or the caller's own id means "for me". */
  assignedTo: string;
  dueDate: string;
  priority: string;
  relatedDesk: string;
  relatedLink: string;
};

type TaskValue = {
  title: string;
  detail: string;
  due_date: string | null;
  priority: TaskPriority;
  related_desk: string | null;
  related_link: string | null;
};

function validateTask(input: TaskInput): { value: TaskValue } | { error: string; fieldErrors?: Record<string, string> } {
  const title = (input.title ?? "").trim();
  if (title.length === 0) return { error: "Give the task a title.", fieldErrors: { title: "Add a title." } };
  if (title.length > TITLE_MAX) return { error: "That title is too long.", fieldErrors: { title: "Shorten it." } };
  const detail = (input.detail ?? "").trim();
  if (detail.length > DETAIL_MAX) return { error: "That description is too long.", fieldErrors: { detail: "Shorten it." } };
  const due = (input.dueDate ?? "").trim();
  if (due !== "" && !isIsoDate(due)) return { error: "Choose a real due date.", fieldErrors: { dueDate: "Choose a date." } };
  const priority = input.priority === "" || input.priority == null ? "normal" : input.priority;
  if (!isTaskPriority(priority)) return { error: "Choose a priority.", fieldErrors: { priority: "Choose one." } };
  const relatedDesk = (input.relatedDesk ?? "").trim();
  if (relatedDesk !== "" && !isDeskScope(relatedDesk)) return { error: "Choose a desk from the list.", fieldErrors: { relatedDesk: "Choose one." } };
  const link = (input.relatedLink ?? "").trim();
  if (link !== "" && !isInternalAdminLink(link)) {
    return { error: "A link must be a console address that starts with /admin.", fieldErrors: { relatedLink: "Use a console address such as /admin/support." } };
  }
  return {
    value: {
      title,
      detail,
      due_date: due === "" ? null : due,
      priority,
      related_desk: relatedDesk === "" ? null : relatedDesk,
      related_link: link === "" ? null : link,
    },
  };
}

/** Create a task, for yourself or, with permission, for a colleague. */
export async function createTask(input: TaskInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const d = await desk();
  if ("error" in d) return fail(d.error);
  const parsed = validateTask(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const wanted = (input.assignedTo ?? "").trim();
  const assignee = wanted === "" ? d.who.userId : wanted;
  if (assignee !== d.who.userId) {
    if (!d.canAssign) {
      return fail("Assigning a task to a colleague needs the COO position, the operations access area, or an admin role.", {
        assignedTo: "You can only assign to yourself.",
      });
    }
    if (!uuid.test(assignee)) return fail("Choose a person from the list.", { assignedTo: "Choose one." });
    const staffIds = await readStaffIds();
    if (!staffIds) return fail("The staff list could not be read. Try again.");
    if (!staffIds.has(assignee)) return fail("That person is not a member of staff.", { assignedTo: "Choose a member of staff." });
  }
  const { data, error } = await d.db
    .from("staff_tasks")
    .insert({ ...parsed.value, assigned_to: assignee, created_by: d.who.userId, status: "todo" })
    .select("id")
    .single();
  if (error || !data) return fail(words(error));
  const id = (data as { id: string }).id;
  const note = await audit(d, "staff_task.create", "staff_task", id, {
    assigned_to: assignee,
    for_self: assignee === d.who.userId,
    priority: parsed.value.priority,
  });
  revalidatePath(TASKS);
  revalidatePath(HOME);
  return ok({ id, note });
}

/** Reassign a task. Same permission as assigning on create. */
export async function reassignTask(id: string, assignedTo: string): Promise<ActionResult<{ note: string | null }>> {
  const d = await desk();
  if ("error" in d) return fail(d.error);
  if (!uuid.test(id) || !uuid.test(assignedTo ?? "")) return fail(FAILED);
  if (!d.canAssign) return fail("Assigning a task to a colleague needs the COO position, the operations access area, or an admin role.");
  const staffIds = await readStaffIds();
  if (!staffIds) return fail("The staff list could not be read. Try again.");
  if (!staffIds.has(assignedTo)) return fail("That person is not a member of staff.");
  const { data, error } = await d.db.from("staff_tasks").update({ assigned_to: assignedTo }).eq("id", id).neq("status", "done").select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("That task is finished or no longer exists, so it cannot be reassigned.");
  const note = await audit(d, "staff_task.reassign", "staff_task", id, { assigned_to: assignedTo });
  revalidatePath(TASKS);
  revalidatePath(HOME);
  return ok({ note });
}

/** Move a task's status. Only the person it is assigned to may. */
export async function setTaskStatus(id: string, status: string): Promise<ActionResult<{ note: string | null }>> {
  const d = await desk();
  if ("error" in d) return fail(d.error);
  if (!uuid.test(id)) return fail(FAILED);
  if (!isTaskStatus(status)) return fail("Choose a status from the list.");
  const next: TaskStatus = status;
  const { data: current, error: readError } = await d.db.from("staff_tasks").select("id, assigned_to, status").eq("id", id).maybeSingle();
  if (readError) return fail(words(readError));
  if (!current) return fail("That task no longer exists.");
  const row = current as { id: string; assigned_to: string | null; status: string };
  if (row.assigned_to !== d.who.userId) return fail("Only the person a task is assigned to can change its status. Add a comment instead.");
  if (row.status === next) return fail("The task is already at that status.");
  const { data, error } = await d.db
    .from("staff_tasks")
    .update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("assigned_to", d.who.userId)
    .eq("status", row.status)
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Someone changed this task a moment ago. Reload and try again.");
  const note = await audit(d, "staff_task.status", "staff_task", id, { from: row.status, to: next });
  revalidatePath(TASKS);
  revalidatePath(HOME);
  return ok({ note });
}

/** Comment on a task. The assignee, the creator and any admin may. */
export async function addTaskComment(taskId: string, body: string): Promise<ActionResult<{ note: string | null }>> {
  const d = await desk();
  if ("error" in d) return fail(d.error);
  if (!uuid.test(taskId)) return fail(FAILED);
  const text = (body ?? "").trim();
  if (text.length === 0) return fail("Write a comment first.", { body: "Say something." });
  if (text.length > COMMENT_MAX) return fail("That comment is too long.", { body: "Shorten it." });
  const { data: task, error: readError } = await d.db.from("staff_tasks").select("id, assigned_to, created_by").eq("id", taskId).maybeSingle();
  if (readError) return fail(words(readError));
  if (!task) return fail("That task no longer exists.");
  const t = task as { assigned_to: string | null; created_by: string | null };
  const involved = t.assigned_to === d.who.userId || t.created_by === d.who.userId || d.who.isAdmin || d.who.isSuperAdmin;
  if (!involved) return fail("Only people involved in a task can comment on it.");
  const { data, error } = await d.db.from("staff_task_comments").insert({ task_id: taskId, author_id: d.who.userId, body: text }).select("id").single();
  if (error || !data) return fail(words(error));
  const note = await audit(d, "staff_task.comment", "staff_task", taskId, { comment_id: (data as { id: string }).id });
  revalidatePath(TASKS);
  return ok({ note });
}

export type AnnouncementInput = { title: string; body: string; audience: string; pinned: boolean };

/** Post an announcement. The COO, an admin or a super admin only. */
export async function postAnnouncement(input: AnnouncementInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const d = await desk();
  if ("error" in d) return fail(d.error);
  if (!d.canAnnounce) return fail("Only the COO or an admin can post an announcement.");
  const title = (input.title ?? "").trim();
  if (title.length === 0) return fail("Give the announcement a title.", { title: "Add a title." });
  if (title.length > ANNOUNCE_TITLE_MAX) return fail("That title is too long.", { title: "Shorten it." });
  const body = (input.body ?? "").trim();
  if (body.length === 0) return fail("Write the announcement.", { body: "Add the message." });
  if (body.length > ANNOUNCE_BODY_MAX) return fail("That message is too long.", { body: "Shorten it." });
  if (!isAudience(input.audience)) return fail("Choose who this is for.", { audience: "Choose one." });
  const pinned = input.pinned === true;
  const { data, error } = await d.db
    .from("staff_announcements")
    .insert({ title, body, audience: input.audience, pinned, created_by: d.who.userId })
    .select("id")
    .single();
  if (error || !data) return fail(words(error));
  const id = (data as { id: string }).id;
  const note = await audit(d, "staff_announcement.post", "staff_announcement", id, { audience: input.audience, pinned });
  revalidatePath(ANNOUNCEMENTS);
  revalidatePath(HOME);
  return ok({ id, note });
}

/** Pin or unpin. Same permission as posting. */
export async function setAnnouncementPinned(id: string, pinned: boolean): Promise<ActionResult<{ note: string | null }>> {
  const d = await desk();
  if ("error" in d) return fail(d.error);
  if (!d.canAnnounce) return fail("Only the COO or an admin can pin an announcement.");
  if (!uuid.test(id)) return fail(FAILED);
  const { data, error } = await d.db.from("staff_announcements").update({ pinned: pinned === true }).eq("id", id).select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("That announcement no longer exists.");
  const note = await audit(d, pinned ? "staff_announcement.pin" : "staff_announcement.unpin", "staff_announcement", id);
  revalidatePath(ANNOUNCEMENTS);
  return ok({ note });
}

/** Mark one announcement read for the caller, if it is addressed to them. */
export async function markAnnouncementRead(id: string): Promise<ActionResult<{ note: null }>> {
  const d = await desk();
  if ("error" in d) return fail(d.error);
  if (!uuid.test(id)) return fail(FAILED);
  const { data: found, error: readError } = await d.db.from("staff_announcements").select("id, audience").eq("id", id).maybeSingle();
  if (readError) return fail(words(readError));
  if (!found) return fail("That announcement no longer exists.");
  if (!canSeeAnnouncement((found as { audience: string }).audience, d.who)) return fail("That announcement is not addressed to you.");
  const { error } = await d.db
    .from("staff_announcement_reads")
    .upsert({ announcement_id: id, user_id: d.who.userId, read_at: new Date().toISOString() }, { onConflict: "announcement_id,user_id" });
  if (error) return fail(words(error));
  revalidatePath(ANNOUNCEMENTS);
  revalidatePath(HOME);
  return ok({ note: null });
}

/** Mark every announcement addressed to the caller as read. */
export async function markAllAnnouncementsRead(): Promise<ActionResult<{ note: null }>> {
  const d = await desk();
  if ("error" in d) return fail(d.error);
  const { data, error: readError } = await d.db.from("staff_announcements").select("id, audience").limit(500);
  if (readError) return fail(words(readError));
  const rows = ((data ?? []) as { id: string; audience: string }[])
    .filter((a) => canSeeAnnouncement(a.audience, d.who))
    .map((a) => ({ announcement_id: a.id, user_id: d.who.userId, read_at: new Date().toISOString() }));
  if (rows.length === 0) return ok({ note: null });
  const { error } = await d.db.from("staff_announcement_reads").upsert(rows, { onConflict: "announcement_id,user_id" });
  if (error) return fail(words(error));
  revalidatePath(ANNOUNCEMENTS);
  revalidatePath(HOME);
  return ok({ note: null });
}
