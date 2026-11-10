import type { StaffScope } from "@/lib/admin/guard";
import type { StaffPosition } from "@/lib/admin/staff-positions";

/**
 * MY DESK: THE SHARED SHAPES AND RULES (founder, 10 November 2026). Client
 * safe: data and pure functions only, so the page, the controls and the
 * actions all read one set of words and one set of rules.
 *
 * WHO MAY DO WHAT, decided here once.
 *   - Any signed-in staff member or admin creates a task for themselves,
 *     comments on a task they are involved in, and moves the status of a
 *     task assigned to them.
 *   - ASSIGNING A TASK TO SOMEBODY ELSE needs the COO position, the
 *     `operations` scope, or an admin or super admin role.
 *   - POSTING AN ANNOUNCEMENT needs the COO position or an admin or super
 *     admin role. The operations scope alone does not post: an announcement
 *     speaks for the company, a task only asks one colleague for work.
 */

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}
export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && (TASK_PRIORITIES as readonly string[]).includes(value);
}

/** Mirrors `STAFF_SCOPES` in `lib/admin/guard.ts` (server-only); a test holds the two together. */
export const DESK_SCOPES: readonly StaffScope[] = [
  "listing_approval",
  "kyc_review",
  "moderation",
  "support",
  "agreements",
  "guarantee",
  "finance",
  "compliance",
  "operations",
  "trust_safety",
  "roommates",
  "circle",
  "analyst",
  "business_development",
  "social_media",
];
export function isDeskScope(value: unknown): value is StaffScope {
  return typeof value === "string" && (DESK_SCOPES as readonly string[]).includes(value);
}

/** A message that is a valid audience: everyone, or one access area. */
export function isAudience(value: unknown): value is "all" | StaffScope {
  return value === "all" || isDeskScope(value);
}

export const TITLE_MAX = 200;
export const DETAIL_MAX = 4000;
export const COMMENT_MAX = 2000;
export const ANNOUNCE_TITLE_MAX = 140;
export const ANNOUNCE_BODY_MAX = 4000;

export type Task = {
  id: string;
  title: string;
  detail: string;
  assignedTo: string | null;
  createdBy: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  relatedDesk: string | null;
  relatedLink: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type TaskComment = {
  id: string;
  taskId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  pinned: boolean;
  createdBy: string | null;
  createdAt: string;
  read: boolean;
};

/** What the signed-in person is, as far as these tools care. */
export type DeskIdentity = {
  userId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  position: StaffPosition | null;
  scopes: readonly StaffScope[];
};

/** The rule for assigning a task to somebody else. */
export function canAssignTasks(who: Pick<DeskIdentity, "isAdmin" | "isSuperAdmin" | "position" | "scopes">): boolean {
  return who.isAdmin || who.isSuperAdmin || who.position === "coo" || who.scopes.includes("operations");
}

/** The rule for posting an announcement. */
export function canPostAnnouncements(who: Pick<DeskIdentity, "isAdmin" | "isSuperAdmin" | "position">): boolean {
  return who.isAdmin || who.isSuperAdmin || who.position === "coo";
}

/** Does this person see an announcement? Admins see every one, to audit what staff were told. */
export function canSeeAnnouncement(
  audience: string,
  who: Pick<DeskIdentity, "isAdmin" | "isSuperAdmin" | "scopes">,
): boolean {
  if (audience === "all") return true;
  if (who.isAdmin || who.isSuperAdmin) return true;
  return (who.scopes as readonly string[]).includes(audience);
}

/**
 * An internal console path only. Starts with `/admin`, then nothing but path,
 * query and fragment characters: no scheme, no host, no `//`, no `..`, and no
 * backslash. Anything else is refused, so a task link can never leave the
 * console.
 */
export function isInternalAdminLink(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length > 300) return false;
  if (value.includes("..") || value.includes("//")) return false;
  return /^\/admin([/?#][A-Za-z0-9_./?=&#%-]*)?$/.test(value);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isOverdue(task: Pick<Task, "dueDate" | "status">, today = todayIso()): boolean {
  return task.status !== "done" && task.dueDate !== null && task.dueDate < today;
}

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/**
 * Overdue first (oldest due date first), then the rest by priority, then by
 * due date with undated last, and finished tasks at the very end.
 */
export function sortTasks(tasks: readonly Task[], today = todayIso()): Task[] {
  const bucket = (t: Task) => (t.status === "done" ? 2 : isOverdue(t, today) ? 0 : 1);
  return [...tasks].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    if (ba === 2) return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
    if (ba === 1 && PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    const da = a.dueDate ?? "9999-12-31";
    const db = b.dueDate ?? "9999-12-31";
    if (da !== db) return da.localeCompare(db);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Start of the current week (Monday, UTC) as an ISO timestamp, for "completed this week". */
export function weekStartIso(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString();
}

export type TaskTotals = { open: number; overdue: number; completedThisWeek: number };

export function totalsFor(tasks: readonly Task[], today = todayIso(), weekStart = weekStartIso()): TaskTotals {
  let open = 0;
  let overdue = 0;
  let completedThisWeek = 0;
  for (const t of tasks) {
    if (t.status === "done") {
      if (t.completedAt && t.completedAt >= weekStart) completedThisWeek += 1;
      continue;
    }
    open += 1;
    if (isOverdue(t, today)) overdue += 1;
  }
  return { open, overdue, completedThisWeek };
}

/**
 * The department each access area belongs to, in the words the sidebar uses
 * for its Departments group. A position's department is the department of
 * its first access area.
 */
export const DEPARTMENT_OF_SCOPE: Record<StaffScope, string> = {
  listing_approval: "Listing verification",
  kyc_review: "Listing verification",
  moderation: "Trust and Safety",
  support: "Support",
  agreements: "Operations",
  guarantee: "Finance",
  finance: "Finance",
  compliance: "Compliance",
  operations: "Operations",
  trust_safety: "Trust and Safety",
  roommates: "Trust and Safety",
  circle: "Trust and Safety",
  analyst: "Intelligence",
  business_development: "Business Development",
  social_media: "Social Media",
};

export function departmentFor(who: Pick<DeskIdentity, "isAdmin" | "isSuperAdmin" | "scopes">): string {
  const first = who.scopes[0];
  if (first) return DEPARTMENT_OF_SCOPE[first];
  return who.isAdmin || who.isSuperAdmin ? "Administration" : "Not assigned yet";
}

/**
 * The queue counts (`getQueueCounts` keys) each access area's front desk
 * waits on. A scope not listed has no cheap, honest count, so its row is a
 * link only, never a made-up figure.
 */
export const SCOPE_COUNT_KEYS: Partial<Record<StaffScope, readonly string[]>> = {
  listing_approval: ["listings"],
  kyc_review: ["verification", "applications"],
  moderation: ["reports", "flags", "moderation"],
  support: ["tickets"],
  agreements: ["agreements"],
  guarantee: ["claims"],
  finance: ["referrals", "payouts"],
  operations: ["alerts"],
};

export type AttentionRow = { scope: StaffScope; count: number | null; href: string };

/** One row per access area the person holds. `counts` null means the counts could not be read. */
export function attentionRows(
  scopes: readonly StaffScope[],
  counts: Record<string, number> | null,
  deskOf: Record<StaffScope, string>,
): AttentionRow[] {
  return scopes.map((scope) => {
    const keys = SCOPE_COUNT_KEYS[scope];
    const count = keys && counts ? keys.reduce((total, key) => total + (counts[key] ?? 0), 0) : null;
    return { scope, count, href: deskOf[scope] };
  });
}
