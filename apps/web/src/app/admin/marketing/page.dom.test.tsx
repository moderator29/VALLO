import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE MARKETING DESK'S DOOR, ITS HONEST EMPTY STATES AND ITS FIGURES. The page
 * reads nothing for a caller the door refused, says "not available" for an
 * acquisition series it could not read, and builds the copilot's context only
 * from rows it read.
 */
const door = vi.hoisted(() => ({ value: { state: "ok", db: {}, user: { id: "m1" }, viaApprover: false, canApprove: false, isAdminRole: false } as Record<string, unknown> }));
vi.mock("@/lib/admin/desk-door", () => ({ deskDoor: async () => door.value }));
vi.mock("@/lib/admin/copilot/contexts/DeskCopilot", () => ({ DeskCopilot: ({ context }: { context: string | null }) => <div data-testid="copilot">{context ?? "no-context"}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

const reads = vi.hoisted(() => ({ campaigns: vi.fn(), results: vi.fn(), acquisition: vi.fn(), referrals: vi.fn(), entries: vi.fn() }));
vi.mock("@/lib/admin/marketing/queries", () => ({ readCampaigns: reads.campaigns, readResults: reads.results, readAcquisition: reads.acquisition, readReferralPerformance: reads.referrals }));
vi.mock("@/lib/admin/desk-entries/queries", () => ({ readEntries: reads.entries, readNames: async () => new Map() }));

const { default: Page } = await import("./page");

const text = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const campaign = (over: Record<string, unknown> = {}) => ({
  id: "c1", name: "December push", objective: "Grow", channel: "social", audience: "Renters", startsOn: "2026-11-01", endsOn: "2026-11-30", budgetKobo: 10_000_000,
  status: "live", approval: "approved", approvalNote: null, approvedBy: "a", approvedAt: "2026-11-02T00:00:00Z", ownerId: "m1", utmBase: null, utmSource: null, utmMedium: null,
  utmCampaign: null, utmContent: null, utmTerm: null, notes: "", createdBy: "m1", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ...over,
});

beforeEach(() => {
  door.value = { state: "ok", db: {}, user: { id: "m1" }, viaApprover: false, canApprove: false, isAdminRole: false };
  reads.campaigns.mockReset();
  reads.results.mockReset();
  reads.acquisition.mockReset();
  reads.referrals.mockReset();
  reads.entries.mockReset();
  reads.entries.mockResolvedValue({ state: "ok", data: [] });
});

describe("the door", () => {
  it.each([
    ["signed-out", /Sign in/],
    ["step-up", /Confirm it is you/],
    ["unconfigured", /cannot reach the console/],
    ["not-admin", /Marketing Manager/],
  ])("answers %s with its own words and reads nothing", async (state, words) => {
    door.value = { state };
    const el = await Page({ searchParams: Promise.resolve({}) });
    expect(reads.campaigns).not.toHaveBeenCalled();
    expect(text(el as React.ReactElement)).toMatch(words);
  });
});

describe("the desk", () => {
  it("says the tables are not set up yet and never crashes", async () => {
    reads.campaigns.mockResolvedValue({ state: "not-open" });
    reads.results.mockResolvedValue({ state: "not-open" });
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/not on this database yet/);
    expect(out).not.toMatch(/undefined|NaN/);
    expect(out).toContain("no-context");
  });

  it("shows a budget against logged spend and builds its context from counts only", async () => {
    reads.campaigns.mockResolvedValue({ state: "ok", data: [campaign()] });
    reads.results.mockResolvedValue({ state: "ok", data: [{ id: "r", campaignId: "c1", recordedOn: "2026-11-09", metric: "spend_kobo", value: 12_000_000, note: "", voidedAt: null, recordedBy: null, createdAt: "x" }] });
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/December push/);
    expect(out).toMatch(/over budget/);
    expect(out).toMatch(/1 campaign live and 0 campaigns planned/);
    /* The copilot's line carries counts only: no name, no amount. */
    expect(out.slice(out.indexOf("1 campaign live and"))).not.toMatch(/December|NGN/);
  });

  it("shows the approver the campaign waiting for them, without the maker's editor", async () => {
    door.value = { state: "ok", db: {}, user: { id: "coo" }, viaApprover: true, canApprove: true, isAdminRole: false };
    reads.campaigns.mockResolvedValue({ state: "ok", data: [campaign({ status: "draft", approval: "submitted" })] });
    reads.results.mockResolvedValue({ state: "ok", data: [] });
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "results" }) })) as React.ReactElement);
    expect(out).toMatch(/Waiting for approval/);
    expect(out).toMatch(/Approve/);
    expect(out).not.toMatch(/Create campaign/);
    expect(out).not.toMatch(/Log number/);
  });

  it("says not available for an acquisition series it could not read, never zero", async () => {
    reads.campaigns.mockResolvedValue({ state: "ok", data: [] });
    reads.results.mockResolvedValue({ state: "ok", data: [] });
    reads.acquisition.mockResolvedValue({ weeks: ["2026-11-02", "2026-11-09"], signups: [3, 5], listingsCreated: null, referrals: null });
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "acquisition" }) })) as React.ReactElement);
    expect(out).toMatch(/Not available/);
    expect(out).toMatch(/Could not be read just now/i);
  });
});

describe("the added tools", () => {
  it("draws the campaign calendar and warns about two campaigns on one channel", async () => {
    reads.campaigns.mockResolvedValue({ state: "ok", data: [campaign({ id: "a", name: "Push A", startsOn: "2026-11-02", endsOn: "2026-11-20" }), campaign({ id: "b", name: "Push B", startsOn: "2026-11-10", endsOn: "2026-11-25" })] });
    reads.results.mockResolvedValue({ state: "ok", data: [] });
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "calendar", month: "2026-11" }) })) as React.ReactElement);
    expect(out).toMatch(/Campaign calendar, 2026-11/);
    expect(out).toMatch(/Push A and Push B both use Social media/);
  });

  it("says referral figures could not be read instead of drawing zero, and never shows a reward amount", async () => {
    reads.campaigns.mockResolvedValue({ state: "ok", data: [] });
    reads.results.mockResolvedValue({ state: "ok", data: [] });
    reads.referrals.mockResolvedValue(null);
    expect(text((await Page({ searchParams: Promise.resolve({ tab: "referrals" }) })) as React.ReactElement)).toMatch(/could not be read/);
    reads.referrals.mockResolvedValue({ weeks: ["2026-11-02"], attributed: [4], buckets: { pending: 2, earned: 1, reversed: 0 }, campaigns: [{ title: "Invite and earn", status: "active", startsAt: "2026-10-01T00:00:00Z", endsAt: null }] });
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "referrals" }) })) as React.ReactElement);
    expect(out).toMatch(/Invite and earn/);
    expect(out).toMatch(/Reward amounts and the Rewards Balance belong to Finance/);
  });

  it("offers the report builder with a draft, and the notes tools with their forms", async () => {
    reads.campaigns.mockResolvedValue({ state: "ok", data: [campaign()] });
    reads.results.mockResolvedValue({ state: "ok", data: [] });
    reads.acquisition.mockResolvedValue({ weeks: ["2026-11-02"], signups: [5], listingsCreated: null, referrals: null });
    const report = text((await Page({ searchParams: Promise.resolve({ tab: "report", month: "2026-11" }) })) as React.ReactElement);
    expect(report).toMatch(/Save as draft report/);
    const briefs = text((await Page({ searchParams: Promise.resolve({ tab: "briefs" }) })) as React.ReactElement);
    expect(briefs).toMatch(/No creative briefs yet/);
    expect(briefs).toMatch(/No a\/b test log yet|A\/B test/i);
  });

  it("says the notes tables are not set up when only they are missing", async () => {
    reads.campaigns.mockResolvedValue({ state: "ok", data: [] });
    reads.results.mockResolvedValue({ state: "ok", data: [] });
    reads.entries.mockResolvedValue({ state: "not-open" });
    expect(text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement)).toMatch(/notes, briefs and reports tables are not on this database yet/);
  });
});
