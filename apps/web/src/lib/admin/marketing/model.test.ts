import { describe, expect, it } from "vitest";

import {
  boardColumn,
  budgetLines,
  buildUtmLink,
  canMoveStatus,
  lastWeekStarts,
  metricTotals,
  parseCampaign,
  spendKobo,
  summarise,
  utmValue,
  weeklyCounts,
  type Campaign,
  type CampaignInput,
  type CampaignResult,
} from "./model";

const NOW = Date.parse("2026-11-10T09:00:00Z"); // a Tuesday

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: "c1", name: "December push", objective: "", channel: "social", audience: "", startsOn: "2026-11-01", endsOn: "2026-11-30", budgetKobo: null,
  status: "live", approval: "approved", approvalNote: null, approvedBy: null, approvedAt: null, ownerId: null, utmBase: null, utmSource: null,
  utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, notes: "", createdBy: null, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...over,
});
const result = (over: Partial<CampaignResult> = {}): CampaignResult => ({
  id: "r1", campaignId: "c1", recordedOn: "2026-11-10", metric: "clicks", value: 10, note: "", voidedAt: null, recordedBy: null, createdAt: "2026-11-10T00:00:00Z", ...over,
});

describe("the tracked link builder", () => {
  it("adds the three required tags and keeps an existing query", () => {
    const r = buildUtmLink({ base: "https://vallo.ng/stays?city=lagos", source: "Instagram", medium: "Social", campaign: "December Shortlets" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const url = new URL(r.url);
      expect(url.searchParams.get("city")).toBe("lagos");
      expect(url.searchParams.get("utm_source")).toBe("instagram");
      expect(url.searchParams.get("utm_medium")).toBe("social");
      expect(url.searchParams.get("utm_campaign")).toBe("december-shortlets");
      expect(url.searchParams.has("utm_content")).toBe(false);
    }
  });

  it("replaces a utm tag that is already on the address instead of doubling it", () => {
    const r = buildUtmLink({ base: "https://vallo.ng/?utm_source=old", source: "email", medium: "email", campaign: "x", content: "Hero Button", term: "lagos flats" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(new URL(r.url).searchParams.getAll("utm_source")).toEqual(["email"]);
      expect(new URL(r.url).searchParams.get("utm_content")).toBe("hero-button");
      expect(new URL(r.url).searchParams.get("utm_term")).toBe("lagos-flats");
    }
  });

  it("refuses a missing page, a page that is not a web address and an address carrying a password", () => {
    expect(buildUtmLink({ base: "", source: "a", medium: "b", campaign: "c" })).toMatchObject({ ok: false, field: "base" });
    expect(buildUtmLink({ base: "javascript:alert(1)", source: "a", medium: "b", campaign: "c" })).toMatchObject({ ok: false, field: "base" });
    expect(buildUtmLink({ base: "https://user:secret@vallo.ng", source: "a", medium: "b", campaign: "c" })).toMatchObject({ ok: false, field: "base" });
  });

  it("names the first required tag that is missing", () => {
    expect(buildUtmLink({ base: "https://vallo.ng", source: "", medium: "b", campaign: "c" })).toMatchObject({ ok: false, field: "source" });
    expect(buildUtmLink({ base: "https://vallo.ng", source: "a", medium: "  ", campaign: "c" })).toMatchObject({ ok: false, field: "medium" });
    expect(buildUtmLink({ base: "https://vallo.ng", source: "a", medium: "b", campaign: "!!!" })).toMatchObject({ ok: false, field: "campaign" });
  });

  it("normalises a value to lower case with single dashes", () => {
    expect(utmValue("  Black  Friday / 2026 ")).toBe("black-friday-2026");
  });
});

describe("status moves", () => {
  it("allows planned -> live -> paused -> live -> ended and nothing out of an ended campaign", () => {
    expect(canMoveStatus("planned", "live")).toBe(true);
    expect(canMoveStatus("live", "paused")).toBe(true);
    expect(canMoveStatus("paused", "live")).toBe(true);
    expect(canMoveStatus("live", "ended")).toBe(true);
    expect(canMoveStatus("ended", "live")).toBe(false);
    expect(canMoveStatus("draft", "live")).toBe(false);
    expect(canMoveStatus("cancelled", "draft")).toBe(false);
  });
});

describe("the campaign form", () => {
  const input: CampaignInput = {
    name: "  December push ", objective: "Grow", channel: "social", audience: "Renters", startsOn: "2026-12-01", endsOn: "2026-12-31", budget: "250,000",
    notes: "", utmBase: "", utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "",
  };
  it("stores the budget in kobo and trims the name", () => {
    const parsed = parseCampaign(input);
    expect("value" in parsed && parsed.value.budget_kobo).toBe(25_000_000);
    expect("value" in parsed && parsed.value.name).toBe("December push");
  });
  it("allows no budget at all", () => {
    const parsed = parseCampaign({ ...input, budget: "" });
    expect("value" in parsed && parsed.value.budget_kobo).toBeNull();
  });
  it("refuses a negative or garbled budget, an impossible date and an end before the start", () => {
    for (const bad of [{ budget: "-5" }, { budget: "abc" }, { startsOn: "2026-02-31" }, { endsOn: "2026-11-01" }, { name: "  " }, { channel: "telepathy" }, { utmBase: "ftp://x" }]) {
      const parsed = parseCampaign({ ...input, ...bad });
      expect("fieldErrors" in parsed, JSON.stringify(bad)).toBe(true);
    }
  });
});

describe("budget against logged spend", () => {
  it("sums only spend that is not voided, and flags a campaign over its budget", () => {
    const c = campaign({ budgetKobo: 100_000 });
    const rs = [result({ metric: "spend_kobo", value: 60_000 }), result({ id: "r2", metric: "spend_kobo", value: 50_000 }), result({ id: "r3", metric: "spend_kobo", value: 999_999, voidedAt: "2026-11-10T00:00:00Z" })];
    expect(spendKobo(rs, "c1")).toBe(110_000);
    expect(budgetLines([c], rs)).toEqual([{ campaignId: "c1", budgetKobo: 100_000, spentKobo: 110_000, remainingKobo: -10_000, over: true }]);
  });
  it("leaves out a campaign with no budget and one that was cancelled", () => {
    expect(budgetLines([campaign(), campaign({ id: "c2", budgetKobo: 5, status: "cancelled" })], [])).toEqual([]);
  });
  it("totals each metric apart", () => {
    expect(metricTotals([result({ value: 4 }), result({ id: "x", value: 6 }), result({ id: "y", metric: "signups", value: 3 })], "c1")).toEqual({ clicks: 10, signups: 3 });
  });
});

describe("the summary", () => {
  it("counts by status, approvals, endings and this week's results from rows only", () => {
    const s = summarise(
      [
        campaign({ endsOn: "2026-11-14" }),
        campaign({ id: "c2", status: "draft", approval: "submitted" }),
        campaign({ id: "c3", status: "draft", approval: "sent_back" }),
        campaign({ id: "c4", status: "ended", endsOn: "2026-11-02" }),
      ],
      [result({ recordedOn: "2026-11-09" }), result({ id: "old", recordedOn: "2026-11-01" }), result({ id: "v", recordedOn: "2026-11-10", voidedAt: "2026-11-10T01:00:00Z" })],
      NOW,
    );
    expect(s.byStatus).toMatchObject({ live: 1, draft: 2, ended: 1 });
    expect(s.waitingApproval).toBe(1);
    expect(s.sentBack).toBe(1);
    expect(s.endingWithinSevenDays).toBe(1);
    expect(s.resultsThisWeek).toBe(1);
  });
  it("puts each status in its board column", () => {
    expect(["draft", "planned", "live", "paused", "ended", "cancelled"].map((status) => boardColumn({ status: status as Campaign["status"] }))).toEqual(["planned", "planned", "live", "live", "ended", "other"]);
  });
});

describe("weekly counts", () => {
  it("buckets timestamps on their Lagos day into Monday weeks and ignores the rest", () => {
    const weeks = lastWeekStarts(3, "2026-11-10");
    expect(weeks).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    /* 23:30 UTC on Sunday 8 Nov is 00:30 Monday 9 Nov in Lagos. */
    expect(weeklyCounts(["2026-11-08T23:30:00Z", "2026-11-03T10:00:00Z", "2026-09-01T10:00:00Z", "garbage"], weeks)).toEqual([0, 1, 1]);
  });
});
