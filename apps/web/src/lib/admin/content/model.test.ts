import { describe, expect, it } from "vitest";

import { calendarWeeks, canMove, contentHealth, daysLate, isEditable, isOverdue, isStuckInReview, needsPublishedUrl, parseItem, shiftMonth, type ContentItem } from "./model";

const item = (over: Partial<ContentItem> = {}): ContentItem => ({
  id: "i1", kind: "guide", title: "Deposits", summary: "", body: "", status: "draft", plannedFor: null, ownerId: null, approverId: null, approvedAt: null, reviewNote: null,
  linkUrl: null, publishedUrl: null, publishedAt: null, createdBy: null, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...over,
});
const input = { kind: "guide", title: "T", summary: "", body: "", plannedFor: "", linkUrl: "" };

describe("the moves", () => {
  it("goes draft, in review, approved, published and only a draft is edited", () => {
    expect(canMove("draft", "in_review")).toBe(true);
    expect(canMove("draft", "published")).toBe(false);
    expect(canMove("in_review", "approved")).toBe(true);
    expect(canMove("approved", "published")).toBe(true);
    expect(canMove("published", "draft")).toBe(false);
    expect(canMove("retired", "draft")).toBe(true);
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("in_review")).toBe(false);
  });
  it("needs a live link for a guide and not for a brand note", () => {
    expect(needsPublishedUrl("guide")).toBe(true);
    expect(needsPublishedUrl("brand_asset")).toBe(false);
  });
});

describe("parseItem", () => {
  it("needs a title, a kind and real date and link", () => {
    expect("fieldErrors" in parseItem({ ...input, title: " ", kind: "x", plannedFor: "2026-02-31", linkUrl: "ftp://x" })).toBe(true);
    expect(parseItem({ ...input, plannedFor: "2026-12-01", linkUrl: "https://vallospaces.com" })).toMatchObject({ value: { planned_for: "2026-12-01" } });
  });
  it("refuses a body that is too long", () => {
    expect("fieldErrors" in parseItem({ ...input, body: "x".repeat(20_001) })).toBe(true);
  });
});

describe("health and the calendar", () => {
  const now = Date.parse("2026-11-10T10:00:00Z");
  it("counts overdue, stuck, sent back and published this month", () => {
    const items = [
      item({ id: "a", plannedFor: "2026-11-01" }),
      item({ id: "b", status: "in_review", updatedAt: "2026-10-20T00:00:00Z" }),
      item({ id: "c", reviewNote: "Name the policy" }),
      item({ id: "d", status: "published", publishedAt: "2026-11-03T00:00:00Z", plannedFor: "2026-11-01" }),
    ];
    const h = contentHealth(items, now);
    expect(h.overdue).toBe(1);
    expect(h.stuckInReview).toBe(1);
    expect(h.sentBack).toBe(1);
    expect(h.publishedThisMonth).toBe(1);
    expect(isOverdue(items[0]!, "2026-11-10")).toBe(true);
    expect(isOverdue(items[3]!, "2026-11-10")).toBe(false);
    expect(isStuckInReview(items[1]!, now)).toBe(true);
    expect(daysLate(items[0]!, "2026-11-10")).toBe(9);
  });
  it("lays a month out in Monday weeks and leaves retired items out", () => {
    const weeks = calendarWeeks([item({ plannedFor: "2026-11-12" }), item({ id: "r", plannedFor: "2026-11-12", status: "retired" })], "2026-11");
    expect(weeks.flatMap((w) => w.items)).toHaveLength(1);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(calendarWeeks([], "bad")).toEqual([]);
  });
});
