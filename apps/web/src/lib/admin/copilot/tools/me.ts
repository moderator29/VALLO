import { z } from "zod";
import { STAFF_SCOPES, STAFF_SCOPE_LABEL } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { requireDeskUser } from "@/lib/admin/my-desk/access";
import { readAnnouncements, readMyTasks } from "@/lib/admin/my-desk/queries";
import { canAssignTasks, canPostAnnouncements, sortTasks, totalsFor } from "@/lib/admin/my-desk/model";
import { adminLink, capList, clampLimit, clip, refused, unreadable } from "./common";
import { defineTool } from "./types";

/** Who the viewer is, and their own tasks and announcements (My Desk). Open to every console user. */

export const getMyProfile = defineTool({
  name: "get_my_profile",
  description:
    "The viewer's own position, access areas, responsibilities and where they escalate. Use it for 'what is my role', 'what am I responsible for', 'what can I do' or before suggesting who to hand something to.",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Reading your role",
  input: z.object({}),
  handler: async (_input, ctx) => {
    const v = ctx.viewer;
    const job = v.position ? JOB_DESCRIPTIONS[v.position] : null;
    return {
      ok: true,
      data: {
        firstName: v.firstName,
        role: v.isSuperAdmin ? "super admin" : v.isAdmin ? "admin" : "staff",
        position: job ? { title: job.title, summary: job.summary, reportsTo: job.reportsTo } : null,
        accessAreas: v.scopes.map((s) => STAFF_SCOPE_LABEL[s]),
        responsibilities: job?.responsibilities ?? [],
        escalateTo: job?.escalate ?? [],
        canAssignTasksToColleagues: canAssignTasks({ ...v, scopes: v.scopes }),
        canPostAnnouncements: canPostAnnouncements(v),
        links: { myDesk: "/admin/my-desk", manual: "/admin/manual", handbook: "/admin/handbook" },
      },
    };
  },
});

export const getMyTasks = defineTool({
  name: "get_my_tasks",
  description:
    "The viewer's own My Desk tasks (assigned to them or made by them): open, overdue and done counts and the most urgent open ones with ids and links.",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Reading your tasks",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const door = await requireDeskUser();
    if (door.state !== "ok" || door.who.userId !== ctx.viewer.userId) return refused();
    const read = await readMyTasks(door.db, door.who.userId);
    if (read.state === "not-open") return { ok: false, error: "My Desk tasks are not set up on this server yet. Say so; do not guess." };
    if (read.state !== "ok") return unreadable("Your tasks");
    const today = new Date(ctx.now).toISOString().slice(0, 10);
    const sorted = sortTasks(read.data, today).filter((t) => t.status !== "done");
    const rows = sorted.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      overdue: t.dueDate !== null && t.dueDate < today,
      relatedDesk: t.relatedDesk,
      link: adminLink(t.relatedLink ?? "/admin/my-desk/tasks"),
    }));
    return { ok: true, data: { totals: totalsFor(read.data, today), open: capList(rows, clampLimit(input.limit)), page: "/admin/my-desk/tasks" } };
  },
});

export const getAnnouncements = defineTool({
  name: "get_announcements",
  description: "Staff announcements addressed to the viewer, pinned and unread first, with a short excerpt of each.",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Reading announcements",
  input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  handler: async (input, ctx) => {
    const door = await requireDeskUser();
    if (door.state !== "ok" || door.who.userId !== ctx.viewer.userId) return refused();
    const read = await readAnnouncements(door.db, door.who);
    if (read.state === "not-open") return { ok: false, error: "Announcements are not set up on this server yet. Say so; do not guess." };
    if (read.state !== "ok") return unreadable("Announcements");
    const ordered = [...read.data].sort((a, b) => Number(a.read) - Number(b.read) || Number(b.pinned) - Number(a.pinned));
    const rows = ordered.map((a) => ({ id: a.id, title: a.title, excerpt: clip(a.body, 280), pinned: a.pinned, unread: !a.read, postedAt: a.createdAt }));
    return { ok: true, data: { unread: read.data.filter((a) => !a.read).length, announcements: capList(rows, clampLimit(input.limit, 5)), page: "/admin/my-desk/announcements" } };
  },
});

export const MY_TOOLS = [getMyProfile, getMyTasks, getAnnouncements];
