import { describe, expect, it } from "vitest";

import { contentContext } from "./content";
import { marketingContext } from "./marketing";
import { supportLeadContext } from "./support-lead";
import { technicalContext } from "./technical";

/** The four desks' copilot context: counts only, singular and plural right, and honest when a figure was not read. */
describe("the context lines", () => {
  it("say they are not live when the desk could not be read", () => {
    for (const line of [marketingContext(null), contentContext(null), technicalContext(null), supportLeadContext(null)]) expect(line).toMatch(/not|yet/i);
  });

  it("marketing counts campaigns with the right plural and leaves out a budget figure", () => {
    const line = marketingContext({ live: 1, planned: 2, waitingApproval: 1, sentBack: 0, endingWithinSevenDays: 1, overBudget: 0, resultsThisWeek: 1 });
    expect(line).toMatch(/1 campaign live and 2 campaigns planned/);
    expect(line).toMatch(/1 result logged/);
    expect(line).not.toMatch(/NGN|₦/);
  });

  it("content mentions requests and the moderation count only when it was read", () => {
    const base = { inReview: 1, drafts: 2, overdue: 0, dueThisWeek: 1, stuckInReview: 0, publishedThisMonth: 1, openRequests: 1 };
    expect(contentContext({ ...base, openReports: null })).not.toMatch(/moderation queue/);
    expect(contentContext({ ...base, openReports: 3 })).toMatch(/3 reports open on the feed moderation queue/);
    expect(contentContext({ ...base, openReports: null })).toMatch(/1 request open from other departments/);
  });

  it("technical leaves out what was not read and never names an incident", () => {
    const line = technicalContext({ openIncidents: 1, sev1or2Open: 1, lateJobs: null, failingJobs: 2, openErrorTypes: null, errorsLast24h: 0, openAlerts: 1, remindersDueSoon: 1 });
    expect(line).toMatch(/1 incident open, 1 of them severity 1 or 2/);
    expect(line).toMatch(/2 scheduled jobs whose last run failed/);
    expect(line).not.toMatch(/late/);
    expect(line).toMatch(/1 alert open/);
    expect(line).toMatch(/1 expiry reminder due within thirty days/);
  });

  it("support lead counts tickets, reviews and drafts and never names an agent", () => {
    const line = supportLeadContext({ open: 4, unassigned: 1, late: 1, escalated: 0, oldestOpenHours: 30, qaReviewsThisWeek: 1, policyDraftsWaiting: 2, macrosWaiting: 1, gapsOpen: 3 });
    expect(line).toMatch(/4 tickets open, 1 of them with nobody holding them/);
    expect(line).toMatch(/1 ticket past their promised time|1 ticket past/);
    expect(line).toMatch(/1 quality review written/);
    expect(line).toMatch(/2 policy notes waiting for approval and 1 canned reply waiting/);
    expect(supportLeadContext({ open: null, unassigned: null, late: null, escalated: null, oldestOpenHours: null, qaReviewsThisWeek: 0, policyDraftsWaiting: 0, macrosWaiting: 0, gapsOpen: 0 })).not.toMatch(/tickets open/);
  });
});
