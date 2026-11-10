import { describe, expect, it } from "vitest";

import { agreementsContext } from "./agreements";
import { analyticsContext } from "./analytics";
import { appealsContext } from "./appeals";
import { casesContext } from "./cases";
import { chargebacksContext } from "./chargebacks";
import { circleContext } from "./circle";
import { ageWords, oldestAge, sentences } from "./common";
import { complianceContext } from "./compliance";
import { kycContext } from "./kyc";
import { listingsContext } from "./listings";
import { moneyContext } from "./money";
import { operationsContext } from "./operations";
import { paymentsContext } from "./payments";
import { queueContext } from "./queue";
import { roommatesContext } from "./roommates";
import { supportContext } from "./support";
import { trustContext } from "./trust";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const NOT_LIVE = /could not be read just now/;

describe("common helpers", () => {
  it("words ages plainly", () => {
    expect(ageWords(30 * 60_000)).toBe("30 minutes");
    expect(ageWords(60_000)).toBe("1 minute");
    expect(ageWords(5 * 3_600_000)).toBe("5 hours");
    expect(ageWords(72 * 3_600_000)).toBe("3 days");
  });
  it("finds the oldest and handles none", () => {
    expect(oldestAge([hoursAgo(2), hoursAgo(10), null], NOW)).toBe("10 hours");
    expect(oldestAge([null], NOW)).toBeNull();
  });
  it("joins sentences and drops empties", () => {
    expect(sentences(["One", null, false, "Two."])).toBe("One. Two.");
  });
});

describe("desk contexts", () => {
  it("listings: real figures in, sentences out", () => {
    const text = listingsContext({
      real: { SUBMITTED: 4, UNDER_REVIEW: 2, MORE_INFO_REQUIRED: 1, PUBLISHED: 30, REJECTED: 3, SUSPENDED: 0 },
      examples: 12,
      medianMinutesThisWeek: 95,
      decisionsThisWeek: 8,
    });
    expect(text).toContain("7 real listings waiting for review (4 submitted, 2 under review, 1 waiting on the lister");
    expect(text).toContain("30 live, 3 rejected and 0 suspended");
    expect(text).toContain("8 decisions this week, with a median of 95 minutes");
    expect(text).toContain("12 example listings left out");
  });
  it("listings: zero decisions and no read", () => {
    const text = listingsContext({ real: {}, examples: 0, medianMinutesThisWeek: null, decisionsThisWeek: 0 });
    expect(text).toContain("0 real listings waiting");
    expect(text).toContain("No review decision has been recorded this week");
    expect(text).not.toContain("example");
    expect(listingsContext(null)).toMatch(NOT_LIVE);
  });

  it("kyc: trend against last week", () => {
    const base = { awaitingLastWeek: 5, passedToday: 2, failedToday: 1, decisionsThisWeek: 9, medianDecisionMinutesThisWeek: 40, selfieChecksWaiting: 3 };
    expect(kycContext({ ...base, awaiting: 8 })).toContain("8 documents waiting for a decision, up from 5 a week ago");
    expect(kycContext({ ...base, awaiting: 5 })).toContain("the same as a week ago");
    expect(kycContext({ ...base, awaiting: 1 })).toContain("1 document waiting for a decision, down from 5");
    const none = kycContext({ ...base, awaiting: 0, decisionsThisWeek: 0, medianDecisionMinutesThisWeek: null, selfieChecksWaiting: null });
    expect(none).not.toContain("median");
    expect(none).not.toContain("selfie");
    expect(kycContext(null)).toMatch(NOT_LIVE);
  });

  it("queue: sums the five queues and names the tab", () => {
    const text = queueContext({ listings: 4, applications: 2, reports: 3, tickets: 5, flags: 1, held: 7, tab: "Reports", late: 2 });
    expect(text).toContain("15 items waiting");
    expect(text).toContain("7 items held by the safety scan");
    expect(text).toContain("2 of the rows on this view are past their promised time");
    expect(text).toContain("Reports tab");
    expect(queueContext({ listings: 0, applications: 0, reports: 0, tickets: 0, flags: 0, held: 0, tab: "All", late: null })).not.toContain("promised");
    expect(queueContext(null)).toMatch(NOT_LIVE);
  });

  it("cases: says the figures are for the filtered view", () => {
    const text = casesContext({ total: 42, shown: 25, overdueOnPage: 3, statusFilter: "Open", narrowed: true });
    expect(text).toContain("42 cases match the current view (status: Open), which has extra filters on");
    expect(text).toContain("3 of the 25 shown on this page are past their deadline");
    expect(casesContext({ total: 1, shown: 1, overdueOnPage: 1, statusFilter: null, narrowed: false })).toContain("1 of the 1 shown on this page is past its deadline");
    expect(casesContext(null)).toMatch(NOT_LIVE);
  });

  it("support: counts by lane and ages the oldest waiting ticket", () => {
    const text = supportContext(
      [
        { lane: "new", breached: true, createdAt: hoursAgo(30) },
        { lane: "waiting_on_us", breached: false, createdAt: hoursAgo(5) },
        { lane: "escalated", breached: true, createdAt: hoursAgo(50) },
        { lane: "waiting_on_member", breached: false, createdAt: hoursAgo(200) },
        { lane: "done", breached: false, createdAt: hoursAgo(400) },
      ],
      NOW,
    );
    expect(text).toContain("3 tickets waiting on the team, 2 past their promised time");
    expect(text).toContain("1 new, 1 escalated and 1 waiting on the member");
    expect(text).toContain("filed 2 days ago");
    expect(supportContext([], NOW)).toContain("0 tickets waiting on the team, 0 past their promised time");
    expect(supportContext([], NOW)).not.toContain("oldest");
    expect(supportContext(null, NOW)).toMatch(NOT_LIVE);
  });

  it("agreements: waiting count, oldest age, watch list", () => {
    const text = agreementsContext({ waitingSubmittedAt: [hoursAgo(3), hoursAgo(26)], decidedRecently: 6, watching: 4 }, NOW);
    expect(text).toContain("2 agreements waiting for review, the oldest submitted 26 hours ago");
    expect(text).toContain("6 recently decided");
    expect(text).toContain("4 payments on the watch list");
    expect(agreementsContext({ waitingSubmittedAt: [], decidedRecently: 0, watching: null }, NOW)).toContain("No agreement is waiting for review");
    expect(agreementsContext(null, NOW)).toMatch(NOT_LIVE);
  });

  it("money: states only what was read", () => {
    const text = moneyContext({ reconciliationRead: true, tenancyCharges: 12, guaranteeReserveMinor: 250_000, openClaims: 1 });
    expect(text).toContain("Vallo never holds customer money");
    expect(text).toContain("1 Guarantee claim made before it retired still open");
    expect(text).toContain("N2,500");
    expect(text).toContain("12 move-in charges opened");
    const bare = moneyContext({ reconciliationRead: false, tenancyCharges: null, guaranteeReserveMinor: null, openClaims: null });
    expect(bare).not.toMatch(/\d/);
    expect(moneyContext(null)).toMatch(NOT_LIVE);
  });

  it("payments: unsettled count, filters and search flag, no term", () => {
    const text = paymentsContext({ unsettled: 2, liveSubscriptions: 9, outcomeFilter: "Failed", searching: true });
    expect(text).toContain("2 payments not settled by the provider yet");
    expect(text).toContain("9 live subscriptions");
    expect(text).toContain("filtered to the Failed outcome");
    expect(text).toContain("looking up a member");
    expect(paymentsContext({ unsettled: 0, liveSubscriptions: null, outcomeFilter: null, searching: false })).toContain("0 payments not settled");
    expect(paymentsContext(null)).toMatch(NOT_LIVE);
  });

  it("chargebacks: empty desk and a busy one", () => {
    expect(chargebacksContext({ all: 0, opened: 0, evidenceRequested: 0, evidenceSubmitted: 0, won: 0, lost: 0, owed: 0, undecided: 0 })).toBe("No chargeback has been recorded.");
    const text = chargebacksContext({ all: 10, opened: 2, evidenceRequested: 1, evidenceSubmitted: 1, won: 4, lost: 2, owed: 1, undecided: 4 });
    expect(text).toContain("10 chargebacks recorded, 4 not decided yet");
    expect(text).toContain("4 won and 2 lost, 1 of the lost ones still owed back");
    expect(chargebacksContext(null)).toMatch(NOT_LIVE);
  });

  it("compliance: desk only, no numbers", () => {
    const text = complianceContext("Suspicious transactions");
    expect(text).toContain("Compliance desk");
    expect(text).toContain("Suspicious transactions lane open");
    expect(text).toContain("do not quote any numbers");
    expect(complianceContext(null)).not.toContain("lane open");
  });

  it("operations: open alerts with the oldest age, cap and tab", () => {
    const text = operationsContext({ tab: "alerts", openAlertTimes: [hoursAgo(2), hoursAgo(49)], alertsCapped: true }, NOW);
    expect(text).toContain("At least 2 open alerts, the oldest raised 2 days ago");
    expect(text).toContain("alerts tab");
    const quiet = operationsContext({ tab: "jobs", openAlertTimes: [], alertsCapped: false }, NOW);
    expect(quiet).toContain("0 open alerts");
    expect(quiet).not.toContain("oldest raised");
    expect(operationsContext({ tab: "jobs", openAlertTimes: null, alertsCapped: false }, NOW)).not.toContain("alert,");
    expect(operationsContext(null, NOW)).toMatch(NOT_LIVE);
  });

  it("trust: the strip and the pace", () => {
    const text = trustContext({
      days: 30, open: 20, overdue: 4, escalated: 2, unassigned: 6, critical: 1,
      openedInPeriod: 55, resolvedInPeriod: 48, medianHoursToResolve: 18, restrictedNow: 3, appealsOpen: 1,
    });
    expect(text).toContain("20 cases open: 4 overdue, 2 escalated, 6 not assigned and 1 critical");
    expect(text).toContain("In the last 30 days 55 opened and 48 resolved, median 18 hours to resolve");
    expect(text).toContain("3 members restricted now and 1 appeal waiting");
    expect(trustContext({ days: 7, open: 0, overdue: 0, escalated: 0, unassigned: 0, critical: 0, openedInPeriod: 0, resolvedInPeriod: 0, medianHoursToResolve: null, restrictedNow: 0, appealsOpen: 0 })).not.toContain("median");
    expect(trustContext(null)).toMatch(NOT_LIVE);
  });

  it("roommates: tab only", () => {
    const text = roommatesContext("Verification");
    expect(text).toContain("Roommates moderation desk");
    expect(text).toContain("Verification tab open");
    expect(text).toContain("do not quote any numbers");
  });

  it("circle: community mix and held posts", () => {
    const text = circleContext({ communities: 6, live: 4, paused: 1, removed: 1, held: 3, openCases: 2, statusFilter: null });
    expect(text).toContain("6 communities in this view: 4 live, 1 paused, 1 removed");
    expect(text).toContain("3 posts held and 2 open cases");
    expect(circleContext({ communities: 1, live: 1, paused: 0, removed: 0, held: 0, openCases: 0, statusFilter: "live" })).toContain("1 community in this view (status: live)");
    expect(circleContext(null)).toMatch(NOT_LIVE);
  });

  it("appeals: waiting count and the oldest age", () => {
    const text = appealsContext({ statusLabel: "waiting", createdAt: [hoursAgo(5), hoursAgo(80)] }, NOW);
    expect(text).toContain("2 appeals in the waiting view");
    expect(text).toContain("oldest was lodged 3 days ago");
    const decided = appealsContext({ statusLabel: "upheld", createdAt: [hoursAgo(5)] }, NOW);
    expect(decided).not.toContain("oldest");
    expect(appealsContext({ statusLabel: "waiting", createdAt: [] }, NOW)).toContain("0 appeals");
    expect(appealsContext(null, NOW)).toMatch(NOT_LIVE);
  });

  it("analytics: names unread panels and passes no figures", () => {
    const text = analyticsContext({ range: "30d", internalAccountsExcluded: 7, live: { bookings: true, supply: false, thinAreas: true, demand: false } });
    expect(text).toContain("last 30d");
    expect(text).toContain("7 internal accounts");
    expect(text).toContain("could not be read just now: supply, demand");
    const ok = analyticsContext({ range: "90d", internalAccountsExcluded: null, live: { bookings: true, supply: true, thinAreas: true, demand: true } });
    expect(ok).not.toContain("could not be read");
    expect(ok).not.toContain("internal account");
  });

  it("never uses a claim word or an em dash", () => {
    const all = [
      listingsContext(null), kycContext(null), queueContext(null), casesContext(null), supportContext(null, NOW),
      agreementsContext(null, NOW), moneyContext({ reconciliationRead: true, tenancyCharges: 1, guaranteeReserveMinor: 1, openClaims: 0 }),
      paymentsContext(null), chargebacksContext(null), complianceContext("x"), operationsContext(null, NOW), trustContext(null),
      roommatesContext("Overview"), circleContext(null), appealsContext(null, NOW),
      analyticsContext({ range: "30d", internalAccountsExcluded: 1, live: { bookings: true, supply: true, thinAreas: true, demand: true } }),
    ].join(" ");
    expect(all).not.toMatch(/guaranteed|\bsafe\b|\bsecure\b|protected|—/i);
  });
});
