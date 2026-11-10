import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { faults, isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";

import {
  canSeeAnnouncement,
  isTaskPriority,
  isTaskStatus,
  type Announcement,
  type DeskIdentity,
  type Task,
  type TaskComment,
} from "./model";

export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "error" };

type TaskRow = {
  id: string;
  title: string;
  detail: string | null;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  related_desk: string | null;
  related_link: string | null;
  created_at: string;
  completed_at: string | null;
};

const TASK_SELECT = "id, title, detail, assigned_to, created_by, due_date, status, priority, related_desk, related_link, created_at, completed_at";

export function taskFromRow(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    detail: r.detail ?? "",
    assignedTo: r.assigned_to,
    createdBy: r.created_by,
    dueDate: r.due_date,
    status: isTaskStatus(r.status) ? r.status : "todo",
    priority: isTaskPriority(r.priority) ? r.priority : "normal",
    relatedDesk: r.related_desk,
    relatedLink: r.related_link,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

/** Every task this person is assigned or created. A user id is a uuid from auth, never free text. */
export async function readMyTasks(db: SupabaseClient, userId: string): Promise<DeskRead<Task[]>> {
  const { data, error } = await db
    .from("staff_tasks")
    .select(TASK_SELECT)
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    await reportReadFault("read.admin.my-desk.tasks", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return { state: "ok", data: ((data ?? []) as unknown as TaskRow[]).map(taskFromRow) };
}

export async function readTaskComments(db: SupabaseClient, taskIds: readonly string[]): Promise<DeskRead<TaskComment[]>> {
  if (taskIds.length === 0) return { state: "ok", data: [] };
  const { data, error } = await db
    .from("staff_task_comments")
    .select("id, task_id, author_id, body, created_at")
    .in("task_id", [...taskIds])
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) {
    await reportReadFault("read.admin.my-desk.comments", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return {
    state: "ok",
    data: ((data ?? []) as { id: string; task_id: string; author_id: string | null; body: string; created_at: string }[]).map((c) => ({
      id: c.id,
      taskId: c.task_id,
      authorId: c.author_id,
      body: c.body,
      createdAt: c.created_at,
    })),
  };
}

/** The announcements this person is addressed by, pinned first, each marked read or unread for them. */
export async function readAnnouncements(db: SupabaseClient, who: DeskIdentity): Promise<DeskRead<Announcement[]>> {
  const [rows, reads] = await Promise.all([
    db
      .from("staff_announcements")
      .select("id, title, body, audience, pinned, created_by, created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("staff_announcement_reads").select("announcement_id").eq("user_id", who.userId).limit(2000),
  ]);
  if (rows.error || reads.error) {
    if (isNotLive(rows.error) || isNotLive(reads.error)) return { state: "not-open" };
    await reportReadFault("read.admin.my-desk.announcements", ...faults(rows.error, reads.error));
    return { state: "error" };
  }
  const seen = new Set(((reads.data ?? []) as { announcement_id: string }[]).map((r) => r.announcement_id));
  const list = ((rows.data ?? []) as { id: string; title: string; body: string; audience: string; pinned: boolean; created_by: string | null; created_at: string }[])
    .filter((a) => canSeeAnnouncement(a.audience, who))
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      pinned: a.pinned === true,
      createdBy: a.created_by,
      createdAt: a.created_at,
      read: seen.has(a.id),
    }));
  return { state: "ok", data: list };
}

export type StaffPerson = { id: string; name: string };

/**
 * Names for a set of user ids, and the directory of everyone who can be given
 * a task: admins, super admins and staff with a live grant. Read with the
 * service client because a profile of another person is not the caller's own
 * RLS row; callers reach this only after the door has admitted them, and only
 * ask for the directory when the person may assign.
 */
export async function readNames(ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return out;
  try {
    const service = createAdminClient() as unknown as SupabaseClient;
    const { data, error } = await service.from("profiles").select("id, display_name, first_name").in("id", unique);
    if (error) {
      await reportReadFault("read.admin.my-desk.names", ...faults(error));
      return out;
    }
    for (const p of (data ?? []) as { id: string; display_name: string | null; first_name: string | null }[]) {
      out.set(p.id, (p.display_name ?? p.first_name ?? "").trim() || "A member of staff");
    }
  } catch {
    /* Names are a courtesy: the page still shows the work without them. */
  }
  return out;
}

export async function readStaffIds(): Promise<Set<string> | null> {
  try {
    const service = createAdminClient() as unknown as SupabaseClient;
    const [grants, roles] = await Promise.all([
      service.from("staff_grants").select("user_id").is("revoked_at", null),
      service.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
    ]);
    if (grants.error || roles.error) {
      await reportReadFault("read.admin.my-desk.staff", ...faults(grants.error, roles.error));
      return null;
    }
    return new Set([...(grants.data ?? []), ...(roles.data ?? [])].map((r) => (r as { user_id: string }).user_id));
  } catch {
    return null;
  }
}

export async function readStaffDirectory(): Promise<StaffPerson[]> {
  const ids = await readStaffIds();
  if (!ids || ids.size === 0) return [];
  const names = await readNames([...ids]);
  return [...ids]
    .map((id) => ({ id, name: names.get(id) ?? "A member of staff" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
