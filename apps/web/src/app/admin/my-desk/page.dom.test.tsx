import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MY DESK PER ACCESS STATE: a refused caller reads one calm sentence and
 * nothing is read for them; an admitted caller sees who they are, a
 * needs-attention panel built from real counts, and the copilot with their
 * own scope and position.
 */
const door = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/admin/my-desk/access", () => ({
  requireDeskUser: async () => door.value,
  doorWords: (state: string) =>
    state === "signed-out"
      ? "Sign in with your operations account to continue."
      : state === "handbook"
        ? "Read and acknowledge the staff handbook to open your desk."
        : state === "step-up"
          ? "Confirm your security key to use the console."
          : "My Desk is for Vallo staff.",
}));
vi.mock("@/lib/admin/guard", () => ({
  STAFF_SCOPE_LABEL: { support: "Support", operations: "Operations", finance: "Finance" },
}));
vi.mock("@/components/admin/copilot/AdminCopilot", () => ({
  AdminCopilot: ({ scope, position, context }: { scope: string; position: string | null; context: string | null }) => (
    <div data-testid="copilot" data-scope={scope} data-position={position ?? ""}>{context}</div>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => "/admin/my-desk" }));

const reads = vi.hoisted(() => ({ tasks: vi.fn(), announcements: vi.fn(), counts: vi.fn() }));
vi.mock("@/lib/admin/my-desk/queries", () => ({
  readMyTasks: reads.tasks,
  readAnnouncements: reads.announcements,
  readNames: async () => new Map([["u1", "Ada Okafor"]]),
}));
vi.mock("@/lib/admin/queries", () => ({ getQueueCounts: reads.counts }));

const { default: Page } = await import("./page");

const text = (el: unknown) => renderToStaticMarkup(el as React.ReactElement).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

function ok(over: Record<string, unknown> = {}) {
  return {
    state: "ok",
    db: {},
    userClient: {},
    who: { userId: "u1", isAdmin: false, isSuperAdmin: false, position: "support_agent", scopes: ["support"] },
    canAssign: false,
    canAnnounce: false,
    copilotScope: "support",
    ...over,
  };
}

const today = new Date().toISOString();
const task = (over: Record<string, unknown>) => ({
  id: "t", title: "T", detail: "", assignedTo: "u1", createdBy: "u1", dueDate: null, status: "todo", priority: "normal",
  relatedDesk: null, relatedLink: null, createdAt: today, completedAt: null, ...over,
});

beforeEach(() => {
  reads.tasks.mockReset();
  reads.announcements.mockReset();
  reads.counts.mockReset();
  reads.tasks.mockResolvedValue({ state: "ok", data: [] });
  reads.announcements.mockResolvedValue({ state: "ok", data: [] });
  reads.counts.mockResolvedValue({ state: "ok", data: { tickets: 4 } });
});

describe("a refused caller", () => {
  it.each([
    ["signed-out", /Sign in/],
    ["not-admin", /for Vallo staff/],
    ["step-up", /security key/],
    ["handbook", /acknowledge the staff handbook/],
  ])("%s reads one sentence and nothing is read", async (state, pattern) => {
    door.value = { state };
    const el = await Page();
    expect(text(el)).toMatch(pattern);
    expect(reads.tasks).not.toHaveBeenCalled();
    expect(reads.counts).not.toHaveBeenCalled();
  });
});

describe("an admitted staff member", () => {
  it("sees identity, a real count for their desk and the copilot with their own scope", async () => {
    door.value = ok();
    reads.tasks.mockResolvedValue({
      state: "ok",
      data: [
        task({ id: "a", dueDate: "2020-01-01" }),
        task({ id: "b" }),
        task({ id: "c", status: "done", completedAt: today }),
        task({ id: "d", assignedTo: "someone-else" }),
      ],
    });
    reads.announcements.mockResolvedValue({ state: "ok", data: [{ id: "x", read: false }, { id: "y", read: true }] });
    const html = renderToStaticMarkup((await Page()) as React.ReactElement);
    const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(t).toMatch(/Ada Okafor/);
    expect(t).toMatch(/Support Agent/i);
    expect(t).toMatch(/Open: 2/);
    expect(t).toMatch(/Overdue: 1/);
    expect(t).toMatch(/Unread: 1/);
    expect(t).toMatch(/Waiting: 4/);
    expect(t).toMatch(/Completed this week: 1/);
    expect(html).toContain('data-scope="support"');
    expect(html).toContain('data-position="support_agent"');
  });

  it("shows a link and no figure for a desk with no cheap count, and says so when counts fail", async () => {
    door.value = ok({ who: { userId: "u1", isAdmin: false, isSuperAdmin: false, position: "finance_officer", scopes: ["finance"] }, copilotScope: "finance" });
    reads.counts.mockResolvedValue({ state: "unavailable" });
    const t = text(await Page());
    expect(t).toMatch(/Finance/);
    expect(t).toMatch(/could not be read/);
    expect(t).not.toMatch(/Waiting:/);
  });

  it("says the tables are not set up yet instead of showing zero", async () => {
    door.value = ok();
    reads.tasks.mockResolvedValue({ state: "not-open" });
    reads.announcements.mockResolvedValue({ state: "not-open" });
    const t = text(await Page());
    expect(t).toMatch(/not on this database yet/);
    expect(t).not.toMatch(/Open: 0/);
  });
});

describe("an admin", () => {
  it("is admitted without a position and without scopes", async () => {
    door.value = ok({
      who: { userId: "u1", isAdmin: true, isSuperAdmin: false, position: null, scopes: [] },
      canAssign: true,
      canAnnounce: true,
      copilotScope: "operations",
    });
    const html = renderToStaticMarkup((await Page()) as React.ReactElement);
    const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(t).toMatch(/Admin/);
    expect(t).toMatch(/Administration/);
    expect(t).toMatch(/through the admin role/);
    expect(html).toContain('data-scope="operations"');
  });
});
