import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE WEEKLY REPORT PAGE PER STATE: before Saturday it says when it opens and
 * previews what it asks; once open it shows the form with the desk counts
 * marked as prefilled; submitted reads as such and can still be edited;
 * reviewed is read-only; a refused caller reads one sentence and nothing is read.
 */
const door = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/admin/my-desk/access", () => ({
  requireDeskUser: async () => door.value,
  doorWords: (state: string) => (state === "signed-out" ? "Sign in with your operations account to continue." : "My Desk is for Vallo staff."),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => "/admin/my-desk/weekly" }));
vi.mock("@/lib/admin/weekly-reports/actions", () => ({
  saveWeeklyReportDraft: vi.fn(),
  submitWeeklyReport: vi.fn(),
  addProofLink: vi.fn(),
  uploadProofFile: vi.fn(),
  removeProof: vi.fn(),
}));
const reads = vi.hoisted(() => ({ report: vi.fn(), history: vi.fn(), desk: vi.fn() }));
vi.mock("@/lib/admin/weekly-reports/queries", () => ({
  readReport: reads.report,
  readHistory: reads.history,
  readDeskRows: reads.desk,
  signProofs: async () => new Map(),
}));

const { default: Page } = await import("./page");

const text = (el: unknown) => renderToStaticMarkup(el as React.ReactElement).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const html = (el: unknown) => renderToStaticMarkup(el as React.ReactElement);

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ok = { state: "ok", db: {}, userClient: {}, who: { userId: ME, isAdmin: false, isSuperAdmin: false, position: "social_media_manager", scopes: ["social_media"] } };
const props = (week?: string) => ({ searchParams: Promise.resolve(week ? { week } : {}) });

const report = (over: Record<string, unknown> = {}) => ({
  id: "r1", authorId: ME, position: "social_media_manager", weekStart: "2026-11-09", status: "draft", accomplishments: "Posted twelve reels.", numbers: [],
  blockers: "", nextWeek: "", proofs: [], submittedAt: null, isLate: false, reviewedBy: null, reviewedAt: null, reviewNote: null, createdAt: "", updatedAt: "", ...over,
});
const deskRow = { label: "Posts posted", value: 7, target: null, source: "desk", deskValue: 7 };

beforeEach(() => {
  vi.useFakeTimers();
  door.value = ok;
  reads.report.mockReset();
  reads.history.mockReset();
  reads.desk.mockReset();
  reads.report.mockResolvedValue({ state: "ok", data: null });
  reads.history.mockResolvedValue({ state: "ok", data: [] });
  reads.desk.mockResolvedValue([deskRow]);
});
afterEach(() => vi.useRealTimers());

describe("a refused caller", () => {
  it.each([["signed-out", /Sign in/], ["not-admin", /for Vallo staff/]])("%s reads one sentence and nothing is read", async (state, pattern) => {
    door.value = { state };
    vi.setSystemTime(new Date("2026-11-14T10:00:00Z"));
    expect(text(await Page(props()))).toMatch(pattern);
    expect(reads.report).not.toHaveBeenCalled();
  });
});

describe("before Saturday", () => {
  it("says it opens Saturday with the date, previews the questions and shows no form", async () => {
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z")); // Wednesday; last week is already in
    reads.report.mockResolvedValue({ state: "ok", data: report({ status: "submitted", submittedAt: "2026-11-15T10:00:00Z" }) });
    const el = await Page(props());
    const out = text(el);
    expect(out).toContain("Opens Saturday Sat 21 Nov 2026");
    expect(out).toContain("What I achieved this week");
    expect(html(el)).not.toContain('data-testid="weekly-report-form"');
    expect(html(el)).toContain('data-state="opens-saturday"');
  });

  it("will not open the form for a week that has not opened, when asked for it by address", async () => {
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    reads.report.mockResolvedValue({ state: "ok", data: null });
    const el = await Page(props("2026-11-23"));
    expect(reads.report).toHaveBeenCalledWith({}, ME, expect.not.stringMatching(/2026-11-23/));
    expect(html(el)).toContain('data-state="overdue"');
  });
});

describe("open", () => {
  it("shows the form, the due time and the desk counts marked as prefilled", async () => {
    vi.setSystemTime(new Date("2026-11-14T10:00:00Z")); // Saturday
    const el = await Page(props());
    const out = text(el);
    expect(html(el)).toContain('data-testid="weekly-report-form"');
    expect(out).toContain("9 Nov to 15 Nov 2026");
    expect(out).toMatch(/Open\s+Due/);
    expect(out).toContain("Prefilled from the desk");
    expect(out).toContain("Save draft");
    expect(out).toContain("Submit report");
  });

  it("flags an overdue week and says a late filing is marked", async () => {
    vi.setSystemTime(new Date("2026-11-17T10:00:00Z")); // Tuesday
    const out = text(await Page(props()));
    expect(out).toContain("Overdue");
    expect(out).toContain("marked late");
  });
});

describe("submitted and reviewed", () => {
  it("a submitted report can still be changed", async () => {
    vi.setSystemTime(new Date("2026-11-15T10:00:00Z")); // Sunday
    reads.report.mockResolvedValue({ state: "ok", data: report({ status: "submitted", submittedAt: "2026-11-15T09:00:00Z", numbers: [deskRow] }) });
    const out = text(await Page(props()));
    expect(out).toContain("Submitted");
    expect(out).toContain("Save changes");
    expect(out).not.toContain("Submit report");
  });

  it("a reviewed report is read-only and shows the reviewer's note", async () => {
    vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
    reads.report.mockResolvedValue({ state: "ok", data: report({ status: "reviewed", submittedAt: "2026-11-15T09:00:00Z", reviewNote: "Good week" }) });
    const el = await Page(props());
    expect(html(el)).not.toContain('data-testid="weekly-report-form"');
    expect(html(el)).toContain('data-testid="report-view"');
    expect(text(el)).toContain("Reviewer note: Good week");
    expect(reads.desk).not.toHaveBeenCalled();
  });

  it("lists past reports with their status and a late mark", async () => {
    vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
    reads.history.mockResolvedValue({ state: "ok", data: [report({ weekStart: "2026-11-02", status: "reviewed", isLate: true })] });
    const out = text(await Page(props()));
    expect(out).toContain("2 Nov to 8 Nov 2026");
    expect(out).toContain("Reviewed");
    expect(out).toContain("Late");
  });
});

describe("when the table is missing", () => {
  it("says the migration is pending instead of failing", async () => {
    vi.setSystemTime(new Date("2026-11-14T10:00:00Z"));
    reads.report.mockResolvedValue({ state: "not-open" });
    expect(text(await Page(props()))).toContain("staff_weekly_reports_2026-11-10.sql");
  });
});
