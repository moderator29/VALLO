import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * MY DESK'S WRITES: the gate, validation before any write, the status guards
 * and who may assign or post. These check the SQL each action issues, never
 * a real database.
 */

const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireConsole: vi.fn() }));
const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => true) }));
const staffIds = vi.hoisted(() => ({ ids: new Set<string>(), fail: false }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: guard.requireAdmin, requireConsole: guard.requireConsole }));
vi.mock("@/lib/admin/audit", () => ({ writeAudit: audit.writeAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("./queries", () => ({ readStaffIds: vi.fn(async () => (staffIds.fail ? null : staffIds.ids)) }));

const {
  createTask,
  reassignTask,
  setTaskStatus,
  addTaskComment,
  postAnnouncement,
  setAnnouncementPinned,
  markAnnouncementRead,
} = await import("./actions");

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TASK = "11111111-1111-4111-8111-111111111111";

type Who = { isAdmin?: boolean; isSuperAdmin?: boolean; position?: string | null; scopes?: string[] };

function signIn(fake: ReturnType<typeof fakeSupabase>, who: Who = {}) {
  const staff = {
    isAdmin: who.isAdmin ?? false,
    isSuperAdmin: who.isSuperAdmin ?? false,
    scopes: who.scopes ?? ["support"],
    position: who.position ?? null,
    handbookAcknowledged: true,
    consoleVerified: true,
  };
  guard.requireConsole.mockResolvedValue({ state: "console", user: { id: ME }, supabase: fake.client, staff });
  guard.requireAdmin.mockResolvedValue({
    state: "admin",
    user: { id: ME },
    supabase: fake.client,
    userClient: fake.client,
    isAdmin: true,
    isSuperAdmin: staff.isSuperAdmin,
    isStaff: !staff.isAdmin,
  });
}

const INPUT = { title: "Chase the vendor", detail: "", assignedTo: "", dueDate: "2026-11-20", priority: "normal", relatedDesk: "", relatedLink: "" };

beforeEach(() => {
  guard.requireAdmin.mockReset();
  guard.requireConsole.mockReset();
  audit.writeAudit.mockClear();
  staffIds.ids = new Set([ME, OTHER]);
  staffIds.fail = false;
});

describe("the gate", () => {
  it("refuses a signed-out caller on every action without writing", async () => {
    guard.requireConsole.mockResolvedValue({ state: "signed-out" });
    expect((await createTask(INPUT)).ok).toBe(false);
    expect((await setTaskStatus(TASK, "done")).ok).toBe(false);
    expect((await addTaskComment(TASK, "hi")).ok).toBe(false);
    expect((await postAnnouncement({ title: "a", body: "b", audience: "all", pinned: false })).ok).toBe(false);
    expect((await markAnnouncementRead(TASK)).ok).toBe(false);
    expect(audit.writeAudit).not.toHaveBeenCalled();
  });

  it("refuses a caller with no staff access", async () => {
    guard.requireConsole.mockResolvedValue({ state: "not-admin" });
    expect((await createTask(INPUT)).ok).toBe(false);
  });

  it("refuses a staff member who has not acknowledged the handbook", async () => {
    const fake = fakeSupabase();
    signIn(fake);
    guard.requireConsole.mockResolvedValue({
      state: "console",
      user: { id: ME },
      supabase: fake.client,
      staff: { isAdmin: false, isSuperAdmin: false, scopes: ["support"], position: null, handbookAcknowledged: false, consoleVerified: true },
    });
    const result = await createTask(INPUT);
    expect(result.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });
});

describe("createTask", () => {
  it("rejects an empty title before writing", async () => {
    const fake = fakeSupabase();
    signIn(fake);
    const result = await createTask({ ...INPUT, title: "   " });
    expect(result.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("rejects a bad date, priority, desk and an external link before writing", async () => {
    const fake = fakeSupabase();
    signIn(fake);
    for (const bad of [
      { dueDate: "2026-13-45" },
      { priority: "whenever" },
      { relatedDesk: "kitchen" },
      { relatedLink: "https://evil.example/admin" },
      { relatedLink: "//evil.example" },
      { relatedLink: "/admin/../etc" },
      { relatedLink: "/member/home" },
    ]) {
      const result = await createTask({ ...INPUT, ...bad });
      expect(result.ok, JSON.stringify(bad)).toBe(false);
    }
    expect(fake.wrote()).toBe(false);
  });

  it("creates a task for the caller and audits it", async () => {
    const fake = fakeSupabase({ staff_tasks: { insert: { data: { id: TASK }, error: null } } });
    signIn(fake);
    const result = await createTask({ ...INPUT, relatedLink: "/admin/support" });
    expect(result.ok).toBe(true);
    const row = fake.of("staff_tasks", "insert")[0]?.values as { assigned_to: string; created_by: string; status: string; related_link: string };
    expect(row.assigned_to).toBe(ME);
    expect(row.created_by).toBe(ME);
    expect(row.status).toBe("todo");
    expect(row.related_link).toBe("/admin/support");
    expect(audit.writeAudit).toHaveBeenCalledTimes(1);
  });

  it("refuses to assign a colleague when the caller is not the COO, operations or an admin", async () => {
    const fake = fakeSupabase();
    signIn(fake, { scopes: ["support"], position: "support_agent" });
    const result = await createTask({ ...INPUT, assignedTo: OTHER });
    expect(result.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it.each([
    ["the COO", { position: "coo", scopes: ["finance"] }],
    ["the operations scope", { scopes: ["operations"] }],
    ["an admin", { isAdmin: true, scopes: [] }],
    ["a super admin", { isAdmin: true, isSuperAdmin: true, scopes: [] }],
  ])("lets %s assign a colleague", async (_name, who) => {
    const fake = fakeSupabase({ staff_tasks: { insert: { data: { id: TASK }, error: null } } });
    signIn(fake, who);
    const result = await createTask({ ...INPUT, assignedTo: OTHER });
    expect(result.ok).toBe(true);
    expect((fake.of("staff_tasks", "insert")[0]?.values as { assigned_to: string }).assigned_to).toBe(OTHER);
  });

  it("refuses an assignee who is not staff", async () => {
    const fake = fakeSupabase();
    signIn(fake, { isAdmin: true, scopes: [] });
    staffIds.ids = new Set([ME]);
    const result = await createTask({ ...INPUT, assignedTo: OTHER });
    expect(result.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("says the tables are not set up when the database has not got them", async () => {
    const fake = fakeSupabase({ staff_tasks: { insert: { data: null, error: { code: "42P01" } } } });
    signIn(fake);
    const result = await createTask(INPUT);
    expect(result.ok).toBe(false);
    expect(audit.writeAudit).not.toHaveBeenCalled();
  });

  it("still succeeds, with a note, when the audit line cannot be written", async () => {
    const fake = fakeSupabase({ staff_tasks: { insert: { data: { id: TASK }, error: null } } });
    signIn(fake);
    audit.writeAudit.mockResolvedValueOnce(false);
    const result = await createTask(INPUT);
    expect(result.ok && result.data.note).toMatch(/audit line/);
  });
});

describe("reassignTask", () => {
  it("is refused for someone who may not assign", async () => {
    const fake = fakeSupabase();
    signIn(fake);
    expect((await reassignTask(TASK, OTHER)).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("will not reassign a finished task", async () => {
    const fake = fakeSupabase({ staff_tasks: { update: { data: [], error: null } } });
    signIn(fake, { isAdmin: true, scopes: [] });
    expect((await reassignTask(TASK, OTHER)).ok).toBe(false);
  });
});

describe("setTaskStatus", () => {
  it("rejects an unknown status before reading or writing", async () => {
    const fake = fakeSupabase();
    signIn(fake);
    expect((await setTaskStatus(TASK, "archived")).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("refuses when the caller is not the assignee", async () => {
    const fake = fakeSupabase({ staff_tasks: { select: { data: { id: TASK, assigned_to: OTHER, status: "todo" }, error: null } } });
    signIn(fake);
    const result = await setTaskStatus(TASK, "done");
    expect(result.ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("refuses a move to the status it already has", async () => {
    const fake = fakeSupabase({ staff_tasks: { select: { data: { id: TASK, assigned_to: ME, status: "todo" }, error: null } } });
    signIn(fake);
    expect((await setTaskStatus(TASK, "todo")).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("refuses a task that no longer exists", async () => {
    const fake = fakeSupabase({ staff_tasks: { select: { data: null, error: null } } });
    signIn(fake);
    expect((await setTaskStatus(TASK, "done")).ok).toBe(false);
  });

  it("marks done with a finish time, guarded on the status it read", async () => {
    const fake = fakeSupabase({
      staff_tasks: {
        select: { data: { id: TASK, assigned_to: ME, status: "in_progress" }, error: null },
        update: { data: [{ id: TASK }], error: null },
      },
    });
    signIn(fake);
    const result = await setTaskStatus(TASK, "done");
    expect(result.ok).toBe(true);
    const update = fake.of("staff_tasks", "update")[0];
    expect((update?.values as { status: string; completed_at: string | null }).status).toBe("done");
    expect((update?.values as { completed_at: string | null }).completed_at).toBeTruthy();
    expect(update?.filters).toContainEqual(["eq", "status", "in_progress"]);
    expect(audit.writeAudit).toHaveBeenCalledTimes(1);
  });

  it("clears the finish time when a task is reopened", async () => {
    const fake = fakeSupabase({
      staff_tasks: {
        select: { data: { id: TASK, assigned_to: ME, status: "done" }, error: null },
        update: { data: [{ id: TASK }], error: null },
      },
    });
    signIn(fake);
    await setTaskStatus(TASK, "in_progress");
    expect((fake.of("staff_tasks", "update")[0]?.values as { completed_at: string | null }).completed_at).toBeNull();
  });

  it("reports a lost race when nothing matched the guarded update", async () => {
    const fake = fakeSupabase({
      staff_tasks: {
        select: { data: { id: TASK, assigned_to: ME, status: "todo" }, error: null },
        update: { data: [], error: null },
      },
    });
    signIn(fake);
    expect((await setTaskStatus(TASK, "blocked")).ok).toBe(false);
    expect(audit.writeAudit).not.toHaveBeenCalled();
  });
});

describe("addTaskComment", () => {
  it("rejects an empty or oversized comment before reading the task", async () => {
    const fake = fakeSupabase();
    signIn(fake);
    expect((await addTaskComment(TASK, "  ")).ok).toBe(false);
    expect((await addTaskComment(TASK, "x".repeat(2001))).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("refuses someone not involved in the task", async () => {
    const fake = fakeSupabase({ staff_tasks: { select: { data: { id: TASK, assigned_to: OTHER, created_by: OTHER }, error: null } } });
    signIn(fake);
    expect((await addTaskComment(TASK, "hello")).ok).toBe(false);
    expect(fake.of("staff_task_comments", "insert")).toHaveLength(0);
  });

  it("lets the assignee comment and audits it", async () => {
    const fake = fakeSupabase({
      staff_tasks: { select: { data: { id: TASK, assigned_to: ME, created_by: OTHER }, error: null } },
      staff_task_comments: { insert: { data: { id: "c1" }, error: null } },
    });
    signIn(fake);
    expect((await addTaskComment(TASK, "On it")).ok).toBe(true);
    expect((fake.of("staff_task_comments", "insert")[0]?.values as { author_id: string }).author_id).toBe(ME);
    expect(audit.writeAudit).toHaveBeenCalledTimes(1);
  });
});

describe("announcements", () => {
  const POST = { title: "Holiday", body: "Office closed Friday", audience: "all", pinned: false };

  it("refuses someone who may not post, before writing", async () => {
    const fake = fakeSupabase();
    signIn(fake, { scopes: ["operations"] });
    expect((await postAnnouncement(POST)).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("validates before writing for the COO", async () => {
    const fake = fakeSupabase();
    signIn(fake, { position: "coo", scopes: ["operations"] });
    expect((await postAnnouncement({ ...POST, title: "" })).ok).toBe(false);
    expect((await postAnnouncement({ ...POST, body: "" })).ok).toBe(false);
    expect((await postAnnouncement({ ...POST, audience: "everyone" })).ok).toBe(false);
    expect((await postAnnouncement({ ...POST, title: "x".repeat(141) })).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("posts for the COO to a scope and audits it", async () => {
    const fake = fakeSupabase({ staff_announcements: { insert: { data: { id: TASK }, error: null } } });
    signIn(fake, { position: "coo", scopes: ["operations"] });
    const result = await postAnnouncement({ ...POST, audience: "support", pinned: true });
    expect(result.ok).toBe(true);
    const row = fake.of("staff_announcements", "insert")[0]?.values as { audience: string; pinned: boolean; created_by: string };
    expect(row).toMatchObject({ audience: "support", pinned: true, created_by: ME });
    expect(audit.writeAudit).toHaveBeenCalledTimes(1);
  });

  it("lets an admin post", async () => {
    const fake = fakeSupabase({ staff_announcements: { insert: { data: { id: TASK }, error: null } } });
    signIn(fake, { isAdmin: true, scopes: [] });
    expect((await postAnnouncement(POST)).ok).toBe(true);
  });

  it("refuses a pin from someone who may not post", async () => {
    const fake = fakeSupabase();
    signIn(fake);
    expect((await setAnnouncementPinned(TASK, true)).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  it("will not mark read an announcement addressed to another area", async () => {
    const fake = fakeSupabase({ staff_announcements: { select: { data: { id: TASK, audience: "finance" }, error: null } } });
    signIn(fake, { scopes: ["support"] });
    expect((await markAnnouncementRead(TASK)).ok).toBe(false);
    expect(fake.of("staff_announcement_reads", "upsert")).toHaveLength(0);
  });

  it("marks read one addressed to the caller's area, with the caller's id", async () => {
    const fake = fakeSupabase({ staff_announcements: { select: { data: { id: TASK, audience: "support" }, error: null } } });
    signIn(fake, { scopes: ["support"] });
    expect((await markAnnouncementRead(TASK)).ok).toBe(true);
    expect((fake.of("staff_announcement_reads", "upsert")[0]?.values as { user_id: string }).user_id).toBe(ME);
  });
});
