import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** THE CONTENT DESK'S DOOR AND ITS HONEST STATES. */
const door = vi.hoisted(() => ({ value: { state: "ok", db: {}, user: { id: "m1" }, viaApprover: false, canApprove: false, isAdminRole: false } as Record<string, unknown> }));
vi.mock("@/lib/admin/desk-door", () => ({ deskDoor: async () => door.value }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: async () => ({ state: "admin", userClient: {} }) }));
vi.mock("@/lib/admin/copilot/contexts/DeskCopilot", () => ({ DeskCopilot: ({ context }: { context: string | null }) => <div>{context ?? "no-context"}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
const reads = vi.hoisted(() => ({ items: vi.fn(), feed: vi.fn(), entries: vi.fn(), docs: vi.fn() }));
vi.mock("@/lib/admin/content/queries", () => ({ readContentItems: reads.items, readFeedModeration: reads.feed }));
vi.mock("@/lib/admin/desk-entries/queries", () => ({ readEntries: reads.entries, readNames: async () => new Map() }));
vi.mock("@/app/admin/doc-feedback/read", () => ({ readDocFeedback: reads.docs }));

const { default: Page } = await import("./page");
const text = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const item = (over: Record<string, unknown> = {}) => ({
  id: "i1", kind: "guide", title: "How deposits work", summary: "", body: "", status: "draft", plannedFor: "2020-01-01", ownerId: null, approverId: null, approvedAt: null, reviewNote: null,
  linkUrl: null, publishedUrl: null, publishedAt: null, createdBy: "m1", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...over,
});
const feed = { openReports: 3, heldPosts: null, heldStories: 0, heldComments: 0, openFeedCases: 1, openCircleCases: 0 };

beforeEach(() => {
  door.value = { state: "ok", db: {}, user: { id: "m1" }, viaApprover: false, canApprove: false, isAdminRole: false };
  for (const r of Object.values(reads)) r.mockReset();
  reads.entries.mockResolvedValue({ state: "ok", data: [] });
  reads.feed.mockResolvedValue(feed);
  reads.items.mockResolvedValue({ state: "ok", data: [] });
});

describe("the door", () => {
  it.each([
    ["signed-out", /Sign in/],
    ["step-up", /security key/],
    ["unconfigured", /cannot reach the console/],
    ["not-admin", /Content Manager/],
  ])("answers %s with its own words and reads nothing", async (state, words) => {
    door.value = { state };
    const el = await Page({ searchParams: Promise.resolve({}) });
    expect(reads.items).not.toHaveBeenCalled();
    expect(text(el as React.ReactElement)).toMatch(words);
  });
});

describe("the desk", () => {
  it("says the tables are not set up yet and never crashes", async () => {
    reads.items.mockResolvedValue({ state: "not-open" });
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/content tables are not on this database yet/);
    expect(out).not.toMatch(/undefined|NaN/);
    expect(out).toContain("no-context");
  });
  it("shows an item past its date and builds the copilot line from counts only", async () => {
    reads.items.mockResolvedValue({ state: "ok", data: [item()] });
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/How deposits work/);
    expect(out).toMatch(/days late/);
    expect(out.slice(out.indexOf("1 content item in draft"))).not.toMatch(/deposits/i);
  });
  it("shows the approver the item waiting and not the writer's editor", async () => {
    door.value = { state: "ok", db: {}, user: { id: "coo" }, viaApprover: true, canApprove: true, isAdminRole: false };
    reads.items.mockResolvedValue({ state: "ok", data: [item({ status: "in_review" })] });
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/Waiting for approval/);
    expect(out).toMatch(/Approve/);
    expect(out).not.toMatch(/Create draft/);
  });
  it("says Not available for a feed count it could not read, never zero", async () => {
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "feed" }) })) as React.ReactElement);
    expect(out).toMatch(/Posts held for review: Not available/);
    expect(out).toMatch(/Open reports on the feed: 3/);
  });
  it("is honest when page feedback is not switched on or cannot be read", async () => {
    reads.docs.mockResolvedValue({ state: "not-switched-on" });
    expect(text((await Page({ searchParams: Promise.resolve({ tab: "gaps" }) })) as React.ReactElement)).toMatch(/Page feedback is not switched on/);
    reads.docs.mockResolvedValue({ state: "unavailable" });
    expect(text((await Page({ searchParams: Promise.resolve({ tab: "gaps" }) })) as React.ReactElement)).toMatch(/could not be read/);
  });
  it("draws the request inbox with its form", async () => {
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "requests" }) })) as React.ReactElement);
    expect(out).toMatch(/No content requests yet/);
    expect(out).toMatch(/Add content request/);
  });
});
