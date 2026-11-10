import { describe, expect, it } from "vitest";

import {
  canEdit,
  canRemoveProof,
  canReview,
  canSubmit,
  csvCell,
  fileProblem,
  isOwnProofPath,
  parseProofLink,
  proofPath,
  sanitizeProofs,
  summarise,
  validateContent,
  weekCsv,
  weeklyState,
  type WeeklyReport,
} from "./model";
import { weekInfo } from "./week";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const base = { week: "2026-11-09", accomplishments: "Signed three landlords.", numbers: [], blockers: "", nextWeek: "" };

describe("validateContent", () => {
  it("accepts a well formed report", () => {
    const r = validateContent({ ...base, numbers: [{ label: "Calls", value: 12, target: 20, source: "typed" }] });
    expect("value" in r && r.value.numbers[0]).toEqual({ label: "Calls", value: 12, target: 20, source: "typed", deskValue: null });
  });
  it("refuses a week that is not a Monday", () => {
    expect("error" in validateContent({ ...base, week: "2026-11-10" })).toBe(true);
  });
  it("refuses over-long text, bad numbers and too many rows", () => {
    expect("error" in validateContent({ ...base, accomplishments: "x".repeat(5001) })).toBe(true);
    expect("error" in validateContent({ ...base, numbers: [{ label: "", value: 1 }] })).toBe(true);
    expect("error" in validateContent({ ...base, numbers: [{ label: "A", value: null }] })).toBe(true);
    expect("error" in validateContent({ ...base, numbers: [{ label: "A", value: -1 }] })).toBe(true);
    expect("error" in validateContent({ ...base, numbers: [{ label: "A", value: 1, target: "x" }] })).toBe(true);
    expect("error" in validateContent({ ...base, numbers: Array.from({ length: 31 }, () => ({ label: "A", value: 1 })) })).toBe(true);
    expect("error" in validateContent({ ...base, numbers: "nope" })).toBe(true);
  });
});

describe("proof rules", () => {
  it("keeps only https links", () => {
    expect("url" in parseProofLink("https://instagram.com/p/abc")).toBe(true);
    for (const bad of ["http://example.com", "javascript:alert(1)", "ftp://x.com/a", "https://u:p@example.com", "https://localhost", "", "not a link", 5]) {
      expect("error" in parseProofLink(bad), String(bad)).toBe(true);
    }
  });
  it("accepts only a path in the author's own folder", () => {
    const ok = proofPath(ME, "2026-11-09", "abc-123.png");
    expect(isOwnProofPath(ok, ME)).toBe(true);
    expect(isOwnProofPath(ok, OTHER)).toBe(false);
    expect(isOwnProofPath(`${OTHER}/2026-11-09/abc.png`, ME)).toBe(false);
    expect(isOwnProofPath(`${ME}/2026-11-09/../../x.png`, ME)).toBe(false);
    expect(isOwnProofPath(`${ME}/2026-11-10/abc.png`, ME)).toBe(false);
    expect(isOwnProofPath("social-media-library/abc.png", ME)).toBe(false);
  });
  it("drops stored proofs that fail those rules when reading back", () => {
    const good = proofPath(ME, "2026-11-09", "a.png");
    const out = sanitizeProofs(
      [
        { id: "pr01", kind: "link", url: "https://ok.example.com/x", caption: "c" },
        { id: "pr02", kind: "link", url: "http://bad.example.com" },
        { id: "pr03", kind: "file", path: good, name: "a.png", contentType: "image/png" },
        { id: "pr04", kind: "file", path: `${OTHER}/2026-11-09/a.png` },
        { id: "pr05", kind: "other" },
        { kind: "link", url: "https://no-id.example.com" },
      ],
      ME,
    );
    expect(out.map((p) => p.id)).toEqual(["pr01", "pr03"]);
  });
  it("holds files to type and size limits", () => {
    const MB = 1024 * 1024;
    expect(fileProblem({ type: "image/png", size: 10 * MB })).toBeNull();
    expect(fileProblem({ type: "image/png", size: 10 * MB + 1 })).toMatch(/10MB/);
    expect(fileProblem({ type: "application/pdf", size: 10 * MB + 1 })).toMatch(/10MB/);
    expect(fileProblem({ type: "application/pdf", size: 5 * MB })).toBeNull();
    expect(fileProblem({ type: "video/mp4", size: 100 * MB })).toBeNull();
    expect(fileProblem({ type: "video/mp4", size: 100 * MB + 1 })).toMatch(/100MB/);
    expect(fileProblem({ type: "application/zip", size: 10 })).toMatch(/not supported/);
    expect(fileProblem({ type: "image/svg+xml", size: 10 })).toMatch(/not supported/);
    expect(fileProblem({ type: "image/png", size: 0 })).toMatch(/empty/);
  });
});

describe("rules by status", () => {
  it("lets a person edit until it is reviewed, submit only a draft or reopened, and remove proof only then too", () => {
    expect([null, "draft", "submitted", "reopened", "reviewed"].map((s) => canEdit(s as never))).toEqual([true, true, true, true, false]);
    expect([null, "draft", "submitted", "reopened", "reviewed"].map((s) => canSubmit(s as never))).toEqual([true, true, false, true, false]);
    expect([null, "draft", "submitted", "reopened", "reviewed"].map((s) => canRemoveProof(s as never))).toEqual([true, true, false, true, false]);
  });
  it("names the reviewers: admin, super admin and the COO", () => {
    expect(canReview({ isAdmin: true, isSuperAdmin: false, position: null })).toBe(true);
    expect(canReview({ isAdmin: false, isSuperAdmin: true, position: null })).toBe(true);
    expect(canReview({ isAdmin: false, isSuperAdmin: false, position: "coo" })).toBe(true);
    expect(canReview({ isAdmin: false, isSuperAdmin: false, position: "cfo" })).toBe(false);
    expect(canReview({ isAdmin: false, isSuperAdmin: false, position: null })).toBe(false);
  });
});

describe("weeklyState", () => {
  const week = weekInfo("2026-11-09");
  const sat = new Date("2026-11-14T10:00:00Z");
  const wed = new Date("2026-11-18T10:00:00Z");
  it("is open before the due time and overdue after", () => {
    expect(weeklyState(week, null, sat, true)).toBe("open");
    expect(weeklyState(week, "draft", wed, true)).toBe("overdue");
    expect(weeklyState(week, "reopened", wed, true)).toBe("overdue");
  });
  it("is submitted or reviewed, then waits for Saturday once the due time has passed", () => {
    expect(weeklyState(week, "submitted", sat, true)).toBe("submitted");
    expect(weeklyState(week, "reviewed", sat, true)).toBe("reviewed");
    expect(weeklyState(week, "submitted", wed, true)).toBe("opens-saturday");
    expect(weeklyState(week, "submitted", wed, false)).toBe("submitted");
  });
});

describe("the reviewer's summary and CSV", () => {
  const report = (over: Partial<WeeklyReport>): WeeklyReport => ({
    id: "r", authorId: ME, position: null, weekStart: "2026-11-09", status: "submitted", accomplishments: "Did things", numbers: [], blockers: "", nextWeek: "",
    proofs: [], submittedAt: "2026-11-16T09:00:00Z", isLate: false, reviewedBy: null, reviewedAt: null, reviewNote: null, createdAt: "", updatedAt: "", ...over,
  });
  it("counts submitted of everyone and late ones", () => {
    const s = summarise([{ report: report({}) }, { report: report({ status: "reviewed", isLate: true }) }, { report: report({ status: "draft" }) }, { report: null }]);
    expect(s).toEqual({ people: 4, submitted: 2, late: 1, reviewed: 1 });
  });
  it("defuses formulas and quotes in cells", () => {
    expect(csvCell("=SUM(A1)")).toBe(`"'=SUM(A1)"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
    expect(csvCell(null)).toBe('""');
  });
  it("writes a header, a row per person and marks desk counts", () => {
    const csv = weekCsv([
      { name: "Ada", roleLabel: "Social Media Manager", report: report({ numbers: [{ label: "Posts", value: 5, target: 10, source: "desk", deskValue: 5 }] }) },
      { name: "Bayo", roleLabel: "Admin", report: null },
    ]);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Posts: 5 of 10 (desk count)");
    expect(lines[2]).toContain("Not started");
  });
});
