import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE REVIEWER TABLE PER ACCESS STATE: a refused caller and a non-reviewer
 * read one sentence and nothing is read; an admin, a super admin and the COO
 * see every current staff member with Submitted, Draft, Not started or Late,
 * a summary line, and can open one report with its review controls.
 */
const door = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/admin/my-desk/access", () => ({
  requireDeskUser: async () => door.value,
  doorWords: (state: string) => (state === "signed-out" ? "Sign in with your operations account to continue." : "My Desk is for Vallo staff."),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => "/admin/reports/weekly" }));
vi.mock("@/lib/admin/weekly-reports/actions", () => ({ reviewReport: vi.fn(), reopenReport: vi.fn() }));
const reads = vi.hoisted(() => ({ table: vi.fn(), weeks: vi.fn() }));
vi.mock("@/lib/admin/weekly-reports/queries", () => ({
  readWeekTable: reads.table,
  readWeeksWithReports: reads.weeks,
  signProofs: async () => new Map([["pr01", "https://signed.example.com/a.png"]]),
}));

const { default: Page } = await import("./page");

const text = (el: unknown) => renderToStaticMarkup(el as React.ReactElement).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const html = (el: unknown) => renderToStaticMarkup(el as React.ReactElement);

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BAYO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHI = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ok = (who: Record<string, unknown>) => ({ state: "ok", db: {}, userClient: {}, who: { userId: ME, isAdmin: false, isSuperAdmin: false, position: null, scopes: [], ...who } });
const props = (params: Record<string, string> = {}) => ({ searchParams: Promise.resolve(params) });

const report = (over: Record<string, unknown>) => ({
  id: "r1", authorId: ADA, position: "social_media_manager", weekStart: "2026-11-09", status: "submitted", accomplishments: "Twelve reels went out.",
  numbers: [{ label: "Reels posted", value: 12, target: 10, source: "desk", deskValue: 12 }], blockers: "", nextWeek: "More.",
  proofs: [{ id: "pr01", kind: "file", url: null, path: `${ADA}/2026-11-09/a.png`, caption: "Insights", name: "a.png", contentType: "image/png" }],
  submittedAt: "2026-11-16T12:00:00Z", isLate: true, reviewedBy: null, reviewedAt: null, reviewNote: null, createdAt: "", updatedAt: "", ...over,
});
const table = [
  { person: { userId: ADA, name: "Ada Okafor", kind: "staff", position: "social_media_manager" }, report: report({}) },
  { person: { userId: BAYO, name: "Bayo Adeyemi", kind: "staff", position: "business_development_executive" }, report: report({ id: "r2", authorId: BAYO, status: "draft", isLate: false, submittedAt: null }) },
  { person: { userId: CHI, name: "Chi Eze", kind: "admin", position: null }, report: null },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T10:00:00Z"));
  door.value = ok({ isAdmin: true });
  reads.table.mockReset();
  reads.weeks.mockReset();
  reads.table.mockResolvedValue({ state: "ok", data: table });
  reads.weeks.mockResolvedValue(["2026-11-09"]);
});
afterEach(() => vi.useRealTimers());

describe("a caller who is refused", () => {
  it.each([["signed-out", /Sign in/], ["not-admin", /for Vallo staff/]])("%s reads one sentence and nothing is read", async (state, pattern) => {
    door.value = { state };
    expect(text(await Page(props()))).toMatch(pattern);
    expect(reads.table).not.toHaveBeenCalled();
  });

  it("a staff member who is not the COO is told who reviews, and nothing is read", async () => {
    door.value = ok({ position: "cfo" });
    expect(text(await Page(props()))).toContain("reviewed by admins, super admins and the COO");
    expect(reads.table).not.toHaveBeenCalled();
  });
});

describe.each([
  ["an admin", { isAdmin: true }],
  ["a super admin", { isSuperAdmin: true }],
  ["the COO", { position: "coo" }],
])("%s", (_name, who) => {
  it("sees everyone, their status and the summary", async () => {
    door.value = ok(who);
    const el = await Page(props());
    const out = text(el);
    expect(reads.table).toHaveBeenCalledWith({}, "2026-11-09");
    expect(out).toContain("Ada Okafor");
    expect(out).toContain("Social Media Manager");
    expect(out).toContain("Business Development Director");
    expect(out).toContain("Admin");
    expect(html(el).match(/data-testid="weekly-row"/g)).toHaveLength(3);
    expect(out).toMatch(/Submitted\s+Late/);
    expect(out).toContain("Draft");
    expect(out).toContain("Not started");
    expect(out).toContain("Submitted 1 of 3, late 1");
    expect(out).toContain("3 people");
    expect(html(el)).toContain("/admin/reports/weekly/export?week=2026-11-09");
  });
});

describe("one report", () => {
  it("opens read-only with its numbers, proof and the review controls", async () => {
    const el = await Page(props({ week: "2026-11-09", who: ADA }));
    const out = text(el);
    expect(out).toContain("Twelve reels went out.");
    expect(out).toContain("Reels posted");
    expect(out).toContain("Prefilled from the desk");
    expect(html(el)).toContain("https://signed.example.com/a.png");
    expect(out).toContain("Mark reviewed");
    expect(out).toContain("Reopen");
  });

  it("does not offer a reviewer to mark their own report reviewed", async () => {
    reads.table.mockResolvedValue({ state: "ok", data: [{ person: { userId: ME, name: "Me", kind: "admin", position: null }, report: report({ authorId: ME }) }] });
    const out = text(await Page(props({ who: ME })));
    expect(out).not.toContain("Mark reviewed");
    expect(out).toContain("another reviewer");
  });

  it("ignores a bad week or person in the address", async () => {
    const out = text(await Page(props({ week: "2026-11-10", who: "x" })));
    expect(out).toContain("9 Nov to 15 Nov 2026");
    expect(reads.table).toHaveBeenCalledWith({}, "2026-11-09");
  });
});

describe("when the table is missing", () => {
  it("says the migration is pending", async () => {
    reads.table.mockResolvedValue({ state: "not-open" });
    expect(text(await Page(props()))).toContain("staff_weekly_reports_2026-11-10.sql");
  });
});
