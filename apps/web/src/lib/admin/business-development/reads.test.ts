import { describe, expect, it } from "vitest";
import { dueThisWeek, kpiCounts, weeklySummary } from "./reads";
import type { BdActivity, BdProspect } from "./types";

const now = new Date("2026-11-10T12:00:00Z").getTime();

function prospect(over: Partial<BdProspect>): BdProspect {
  return {
    id: "p1",
    contactName: "Ada",
    businessName: "Ada Lets",
    category: "landlord",
    email: "ada@example.com",
    phone: null,
    location: null,
    stage: "new",
    notes: null,
    assignedTo: null,
    createdBy: "u1",
    listingId: null,
    onboardedAt: null,
    nextFollowUpAt: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    ...over,
  };
}

function activity(over: Partial<BdActivity>): BdActivity {
  return {
    id: "a1",
    prospectId: "p1",
    kind: "note",
    body: "hello",
    outcome: null,
    actorId: "u1",
    createdAt: new Date(now).toISOString(),
    ...over,
  };
}

describe("kpiCounts", () => {
  it("counts prospects identified, contacted, follow-ups, onboarded and listing-linked, reported apart", () => {
    const prospects = [
      prospect({ id: "p1", stage: "onboarded", onboardedAt: new Date(now).toISOString(), listingId: null }),
      prospect({ id: "p2", stage: "new", listingId: "listing-1" }),
      prospect({ id: "p3", stage: "rejected" }),
    ];
    const activities = [
      activity({ id: "a1", prospectId: "p1", kind: "contact", outcome: "Interested" }),
      activity({ id: "a2", prospectId: "p2", kind: "contact", outcome: "Not now" }),
      activity({ id: "a3", prospectId: "p1", kind: "follow_up" }),
      activity({ id: "a4", prospectId: "p1", kind: "follow_up" }),
    ];
    const kpi = kpiCounts(prospects, activities);
    expect(kpi.prospectsIdentified).toBe(3);
    expect(kpi.qualifiedContacted).toBe(2);
    expect(kpi.followUpActivity).toBe(2);
    // Onboarded (1) and listing-linked (1, a DIFFERENT prospect here) are
    // never conflated: a business can be onboarded with no listing, or
    // have a listing with no onboarding recorded yet.
    expect(kpi.onboarded).toBe(1);
    expect(kpi.listingsSubmittedFromPipeline).toBe(1);
  });
});

describe("dueThisWeek", () => {
  it("includes overdue and due-within-7-days, excludes onboarded and rejected, sorted soonest first", () => {
    const prospects = [
      prospect({ id: "p1", nextFollowUpAt: "2026-11-09", stage: "contacted" }), // overdue
      prospect({ id: "p2", nextFollowUpAt: "2026-11-14", stage: "interested" }), // within 7 days
      prospect({ id: "p3", nextFollowUpAt: "2026-11-20", stage: "interested" }), // too far
      prospect({ id: "p4", nextFollowUpAt: "2026-11-11", stage: "onboarded", onboardedAt: new Date(now).toISOString() }),
      prospect({ id: "p5", nextFollowUpAt: "2026-11-11", stage: "rejected" }),
      prospect({ id: "p6", nextFollowUpAt: null }),
    ];
    const due = dueThisWeek(prospects, now);
    expect(due.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

describe("weeklySummary", () => {
  it("counts only what happened in the last 7 days", () => {
    const recent = new Date(now).toISOString();
    const old = new Date(now - 10 * 86_400_000).toISOString();
    const prospects = [
      prospect({ id: "p1", createdAt: recent }),
      prospect({ id: "p2", createdAt: old }),
      prospect({ id: "p3", createdAt: recent, onboardedAt: recent }),
    ];
    const activities = [
      activity({ id: "a1", kind: "follow_up", createdAt: recent }),
      activity({ id: "a2", kind: "follow_up", createdAt: old }),
      activity({ id: "a3", kind: "contact", createdAt: recent }),
    ];
    const week = weeklySummary(prospects, activities, now);
    expect(week).toEqual({ prospectsAdded: 2, followUpsDone: 1, contactsLogged: 1, onboardedThisWeek: 1 });
  });
});
