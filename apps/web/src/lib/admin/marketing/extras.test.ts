import { describe, expect, it } from "vitest";

import { buildMonthlyReport, campaignCalendar, channelClashes, currentMonth } from "./extras";
import type { Campaign, CampaignResult } from "./model";

const c = (over: Partial<Campaign> = {}): Campaign => ({
  id: "c1", name: "December push", objective: "", channel: "social", audience: "", startsOn: "2026-11-03", endsOn: "2026-11-14", budgetKobo: 1_000_000, status: "live", approval: "approved",
  approvalNote: null, approvedBy: null, approvedAt: null, ownerId: null, utmBase: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null,
  notes: "", createdBy: null, createdAt: "x", updatedAt: "x", ...over,
});
const r = (over: Partial<CampaignResult> = {}): CampaignResult => ({ id: "r", campaignId: "c1", recordedOn: "2026-11-05", metric: "clicks", value: 120, note: "", voidedAt: null, recordedBy: null, createdAt: "x", ...over });

describe("the campaign calendar", () => {
  it("puts a campaign in every Monday-start week it touches and leaves cancelled ones out", () => {
    const rows = campaignCalendar([c(), c({ id: "x", status: "cancelled" })], "2026-11");
    expect(rows[0]!.start).toBe("2026-10-26");
    const holding = rows.filter((w) => w.campaigns.length > 0).map((w) => w.start);
    expect(holding).toEqual(["2026-11-02", "2026-11-09"]);
  });
  it("answers nothing for a bad month", () => {
    expect(campaignCalendar([c()], "nope")).toEqual([]);
    expect(currentMonth(Date.parse("2026-11-10T10:00:00Z"))).toBe("2026-11");
  });
  it("finds two campaigns on one channel on overlapping dates, and not on different channels", () => {
    expect(channelClashes([c(), c({ id: "b", startsOn: "2026-11-10", endsOn: "2026-11-20" })])).toHaveLength(1);
    expect(channelClashes([c(), c({ id: "b", channel: "email", startsOn: "2026-11-10", endsOn: "2026-11-20" })])).toHaveLength(0);
    expect(channelClashes([c(), c({ id: "b", startsOn: "2026-11-15", endsOn: "2026-11-20" })])).toHaveLength(0);
  });
});

describe("the monthly report draft", () => {
  it("says what was not logged instead of writing zero", () => {
    const text = buildMonthlyReport({ month: "2026-11", campaigns: [c()], results: [r()], signups: null });
    expect(text).toContain("clicks");
    expect(text).toContain("120 clicks");
    expect(text).toContain("spend not logged");
    expect(text).toContain("sign-ups not logged");
    expect(text).toContain("not available from the console just now");
    expect(text).not.toContain("—");
  });
  it("names an over-budget campaign and ignores voided numbers", () => {
    const text = buildMonthlyReport({
      month: "2026-11",
      campaigns: [c({ budgetKobo: 100 })],
      results: [r({ metric: "spend_kobo", value: 500 }), r({ id: "v", metric: "clicks", value: 999, voidedAt: "2026-11-06T00:00:00Z" })],
      signups: 12,
    });
    expect(text).toContain("Over budget: 1 campaign");
    expect(text).not.toContain("999");
    expect(text).toContain("12");
  });
});
