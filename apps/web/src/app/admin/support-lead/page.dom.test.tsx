import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** THE SUPPORT LEAD'S DESK: its door, its honest states, and that it shows references and counts, never a conversation. */
const door = vi.hoisted(() => ({ value: { state: "ok", db: {}, user: { id: "l1" }, viaApprover: false, canApprove: false, isAdminRole: false } as Record<string, unknown> }));
vi.mock("@/lib/admin/desk-door", () => ({ deskDoor: async () => door.value }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: async () => ({ state: "admin", userClient: {} }) }));
vi.mock("@/lib/admin/copilot/contexts/DeskCopilot", () => ({ DeskCopilot: ({ context }: { context: string | null }) => <div>{context ?? "no-context"}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
const reads = vi.hoisted(() => ({ queue: vi.fn(), qa: vi.fn(), policy: vi.fn(), entries: vi.fn(), agents: vi.fn(), topics: vi.fn(), outcomes: vi.fn(), docs: vi.fn() }));
vi.mock("@/lib/admin/support-queue", () => ({ getSupportQueue: reads.queue }));
vi.mock("@/lib/admin/support-lead/queries", () => ({ readQaReviews: reads.qa, readPolicyNotes: reads.policy, readTicketTopics: reads.topics, readTicketOutcomes: reads.outcomes }));
vi.mock("@/lib/admin/desk-entries/queries", () => ({ readEntries: reads.entries, readNames: async () => new Map(), readSupportAgents: reads.agents }));
vi.mock("@/app/admin/doc-feedback/read", () => ({ readDocFeedback: reads.docs }));

const { default: Page } = await import("./page");
const text = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const ticket = (over: Record<string, unknown> = {}) => ({
  id: "t1", reference: "VAL-0042", name: "A Member", topic: "payments", status: "open", lane: "waiting_on_us",
  sla: { breached: true, label: "Late by 3h" }, claim: null, escalatedTo: [], createdAt: "2026-11-09T00:00:00Z", lastActivityAt: "2026-11-09T00:00:00Z",
  replyCount: 0, preview: "my private words", hasAccount: true, ...over,
});
const note = (over: Record<string, unknown> = {}) => ({ id: "p1", title: "Deposits", body: "Say this", status: "draft", approvedBy: null, approvedAt: null, createdBy: "l1", createdAt: "x", updatedAt: "x", ...over });

beforeEach(() => {
  door.value = { state: "ok", db: {}, user: { id: "l1" }, viaApprover: false, canApprove: false, isAdminRole: false };
  for (const r of Object.values(reads)) r.mockReset();
  reads.queue.mockResolvedValue({ state: "ok", data: { rows: [ticket()], escalationsInstalled: true } });
  reads.qa.mockResolvedValue({ state: "ok", data: [] });
  reads.policy.mockResolvedValue({ state: "ok", data: [] });
  reads.entries.mockResolvedValue({ state: "ok", data: [] });
  reads.agents.mockResolvedValue([{ id: "a1", name: "Ada" }]);
});

describe("the door", () => {
  it.each([
    ["signed-out", /Sign in/],
    ["step-up", /Confirm it is you/],
    ["unconfigured", /cannot reach the console/],
    ["not-admin", /Customer Support Lead/],
  ])("answers %s with its own words and reads nothing", async (state, words) => {
    door.value = { state };
    const el = await Page({ searchParams: Promise.resolve({}) });
    expect(reads.queue).not.toHaveBeenCalled();
    expect(text(el as React.ReactElement)).toMatch(words);
  });
});

describe("the team", () => {
  it("shows the load, the unassigned ticket by reference with a way to hand it over, and none of the message", async () => {
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/Past promised time/);
    expect(out).toMatch(/VAL-0042/);
    expect(out).toMatch(/Assign/);
    expect(out).toMatch(/Open the ticket/);
    expect(out).not.toMatch(/my private words|A Member/);
    expect(out).toMatch(/1 ticket open/);
  });
  it("says the queue could not be read instead of showing a clean queue", async () => {
    reads.queue.mockResolvedValue({ state: "unavailable" });
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/support queue could not be read/);
    expect(out).not.toMatch(/Open tickets/);
  });
  it("says the tables are not set up and never crashes", async () => {
    reads.qa.mockResolvedValue({ state: "not-open" });
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/quality review and policy tables are not on this database yet/);
    expect(out).toContain("no-context");
  });
});

describe("quality and policy", () => {
  it("draws the review form and the empty scores", async () => {
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "quality" }) })) as React.ReactElement);
    expect(out).toMatch(/No reviews yet/);
    expect(out).toMatch(/Save review/);
    expect(out).toMatch(/Coaching notes/);
  });
  it("shows the approver a draft policy note to approve and no editor", async () => {
    door.value = { state: "ok", db: {}, user: { id: "coo" }, viaApprover: true, canApprove: true, isAdminRole: false };
    reads.policy.mockResolvedValue({ state: "ok", data: [note()] });
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/Draft, waiting for approval/);
    expect(out).toMatch(/Approve/);
    expect(out).not.toMatch(/Save draft policy note/);
    expect(reads.queue).not.toHaveBeenCalled();
  });
  it("lets the lead write a policy note", async () => {
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "library" }) })) as React.ReactElement);
    expect(out).toMatch(/Save draft policy note/);
    expect(out).toMatch(/Canned replies/);
  });
});

describe("figures", () => {
  it("shows the promised times and the topics, and is honest when feedback is not switched on", async () => {
    reads.topics.mockResolvedValue({ state: "ok", topics: ["payments", "payments", "account"], since: "x" });
    reads.outcomes.mockResolvedValue({ open: 2, resolved: 1 });
    reads.docs.mockResolvedValue({ state: "not-switched-on" });
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "figures" }) })) as React.ReactElement);
    expect(out).toMatch(/Within 4 hours/);
    expect(out).toMatch(/payments/);
    expect(out).toMatch(/Page feedback is not switched on/);
  });
  it("says the topics could not be read instead of an empty list", async () => {
    reads.topics.mockResolvedValue({ state: "error" });
    reads.outcomes.mockResolvedValue(null);
    reads.docs.mockResolvedValue({ state: "unavailable" });
    expect(text((await Page({ searchParams: Promise.resolve({ tab: "figures" }) })) as React.ReactElement)).toMatch(/ticket topics could not be read/);
  });
});
