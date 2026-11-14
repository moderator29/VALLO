import { describe, expect, it } from "vitest";
import {
  activityByProspect,
  filterPipeline,
  followUpState,
  lagosToday,
  lastActivityByProspect,
  matchesQuery,
  orderPipeline,
  pipelineCsv,
  stageCounts,
} from "./pipeline";
import type { BdActivity, BdProspect } from "./types";

function prospect(over: Partial<BdProspect>): BdProspect {
  return {
    id: "p1",
    contactName: "Ada Obi",
    businessName: "Ada Lets",
    category: "landlord",
    email: "ada@example.com",
    phone: "+234 803 123 4567",
    location: "Lekki, Lagos",
    stage: "new",
    notes: null,
    assignedTo: null,
    createdBy: null,
    listingId: null,
    onboardedAt: null,
    nextFollowUpAt: null,
    createdAt: "2026-11-01T09:00:00Z",
    updatedAt: "2026-11-01T09:00:00Z",
    ...over,
  };
}

function activity(over: Partial<BdActivity>): BdActivity {
  return { id: "a1", prospectId: "p1", kind: "contact", body: "Called", outcome: "Interested", actorId: null, createdAt: "2026-11-02T10:00:00Z", ...over };
}

const TODAY = "2026-11-14";

describe("lagosToday", () => {
  it("is the Lagos calendar day, an hour ahead of UTC", () => {
    expect(lagosToday(Date.parse("2026-11-13T23:30:00Z"))).toBe("2026-11-14");
    expect(lagosToday(Date.parse("2026-11-13T22:30:00Z"))).toBe("2026-11-13");
  });
});

describe("followUpState", () => {
  it("reads a date against today", () => {
    expect(followUpState(prospect({ nextFollowUpAt: "2026-11-13" }), TODAY)).toBe("overdue");
    expect(followUpState(prospect({ nextFollowUpAt: "2026-11-14" }), TODAY)).toBe("today");
    expect(followUpState(prospect({ nextFollowUpAt: "2026-11-21" }), TODAY)).toBe("soon");
    expect(followUpState(prospect({ nextFollowUpAt: "2026-11-22" }), TODAY)).toBe("later");
    expect(followUpState(prospect({ nextFollowUpAt: null }), TODAY)).toBe("none");
  });

  it("never calls a closed prospect due", () => {
    expect(followUpState(prospect({ stage: "onboarded", nextFollowUpAt: "2026-11-01" }), TODAY)).toBe("none");
    expect(followUpState(prospect({ stage: "rejected", nextFollowUpAt: "2026-11-01" }), TODAY)).toBe("none");
  });
});

describe("matchesQuery", () => {
  const p = prospect({ notes: "Owns two blocks in Ikate" });
  it("finds by business, person, email, place and notes, whatever the case", () => {
    for (const q of ["ada lets", "OBI", "example.com", "lekki", "ikate"]) expect(matchesQuery(p, q), q).toBe(true);
    expect(matchesQuery(p, "abuja")).toBe(false);
    expect(matchesQuery(p, "   ")).toBe(true);
  });

  it("finds a phone number typed the local way or the international way", () => {
    expect(matchesQuery(p, "0803 123 4567")).toBe(true);
    expect(matchesQuery(p, "8031234567")).toBe(true);
    expect(matchesQuery(prospect({ phone: "08031234567" }), "+2348031234567")).toBe(true);
    expect(matchesQuery(p, "0809")).toBe(false);
  });
});

describe("filterPipeline and stageCounts", () => {
  const all = [
    prospect({ id: "a", stage: "new" }),
    prospect({ id: "b", stage: "negotiation", category: "hotel" }),
    prospect({ id: "c", stage: "onboarded" }),
    prospect({ id: "d", stage: "rejected" }),
  ];

  it("keeps the open view to prospects still being worked", () => {
    expect(filterPipeline(all, { query: "", view: "open", category: "all" }).map((p) => p.id)).toEqual(["a", "b"]);
    expect(filterPipeline(all, { query: "", view: "all", category: "all" })).toHaveLength(4);
    expect(filterPipeline(all, { query: "", view: "onboarded", category: "all" }).map((p) => p.id)).toEqual(["c"]);
    expect(filterPipeline(all, { query: "", view: "open", category: "hotel" }).map((p) => p.id)).toEqual(["b"]);
  });

  it("counts each stage, the open ones and the whole", () => {
    const counts = stageCounts(all);
    expect(counts.all).toBe(4);
    expect(counts.open).toBe(2);
    expect(counts.new).toBe(1);
    expect(counts.contacted).toBe(0);
    expect(counts.rejected).toBe(1);
  });
});

describe("orderPipeline", () => {
  it("puts what is due first, then the undated newest first, then the closed", () => {
    const rows = [
      prospect({ id: "undated-old", createdAt: "2026-10-01T00:00:00Z" }),
      prospect({ id: "closed", stage: "onboarded", nextFollowUpAt: "2026-10-01" }),
      prospect({ id: "later", nextFollowUpAt: "2026-12-01" }),
      prospect({ id: "undated-new", createdAt: "2026-11-10T00:00:00Z" }),
      prospect({ id: "overdue", nextFollowUpAt: "2026-11-02" }),
    ];
    expect(orderPipeline(rows).map((p) => p.id)).toEqual(["overdue", "later", "undated-new", "undated-old", "closed"]);
  });
});

describe("activity grouping", () => {
  const log = [
    activity({ id: "1", prospectId: "p1", createdAt: "2026-11-02T10:00:00Z" }),
    activity({ id: "2", prospectId: "p1", createdAt: "2026-11-05T10:00:00Z", body: "Met" }),
    activity({ id: "3", prospectId: "p2", createdAt: "2026-11-03T10:00:00Z" }),
  ];
  it("gives each prospect its newest row and its whole history, newest first", () => {
    expect(lastActivityByProspect(log).get("p1")?.id).toBe("2");
    expect(activityByProspect(log).get("p1")?.map((a) => a.id)).toEqual(["2", "1"]);
    expect(activityByProspect(log).get("p2")).toHaveLength(1);
    expect(activityByProspect(log).get("nobody")).toBeUndefined();
  });
});

describe("pipelineCsv", () => {
  it("writes one row per prospect under a header, with the last activity", () => {
    const csv = pipelineCsv([prospect({ nextFollowUpAt: "2026-11-20" })], [activity({})]);
    const [head, row] = csv.split("\r\n");
    expect(head).toBe("Business,Contact,Category,Email,Phone,Location,Stage,Next follow-up,Last activity,Last activity date,Onboarded,Listing linked,Added,Notes");
    expect(row).toBe('Ada Lets,Ada Obi,Landlord,ada@example.com,\'+234 803 123 4567,"Lekki, Lagos",New,2026-11-20,Called (Interested),2026-11-02,,No,2026-11-01,');
  });

  it("quotes commas, quotes and line breaks, and disarms a cell a spreadsheet would run as a formula", () => {
    const csv = pipelineCsv([prospect({ businessName: '=HYPERLINK("x")', notes: 'Said "yes"\nthen left', phone: null })], []);
    const row = csv.split("\r\n").slice(1).join("\r\n");
    expect(row.startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
    expect(row.endsWith('"Said ""yes""\nthen left"')).toBe(true);
  });
});
