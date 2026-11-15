import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/control/read", () => ({ readControlRoom: vi.fn() }));
vi.mock("@/lib/admin/queries", () => ({ getQueueCounts: vi.fn() }));
vi.mock("@/lib/admin/examples-queries", () => ({ getExamplesConsole: vi.fn() }));
vi.mock("@/lib/admin/reads/overview", () => ({ getConsolePulse: vi.fn(), getCollectedSeries: vi.fn() }));
vi.mock("@/lib/admin/reads/supply", () => ({ getSupplyDesk: vi.fn() }));
vi.mock("@/lib/admin/staff-queries", () => ({ readStaffDesk: vi.fn() }));
vi.mock("@/lib/admin/audit-queries", () => ({ getAuditLog: vi.fn(), getAuditActivity: vi.fn() }));

const { getPlatformPulse, getStaffOverview, getWhatChanged, recordDesk, actionWords, teamsWithNobody } = await import("./platform");
const { isOfferable } = await import("./registry");
const { readControlRoom } = await import("@/lib/admin/control/read");
const { getQueueCounts } = await import("@/lib/admin/queries");
const { getExamplesConsole } = await import("@/lib/admin/examples-queries");
const { getConsolePulse, getCollectedSeries } = await import("@/lib/admin/reads/overview");
const { getSupplyDesk } = await import("@/lib/admin/reads/supply");
const { readStaffDesk } = await import("@/lib/admin/staff-queries");
const { getAuditLog, getAuditActivity } = await import("@/lib/admin/audit-queries");
const { readSwitches } = await import("@/lib/admin/control/setup");
import type { CopilotViewer } from "./types";

/**
 * THE SUPER ADMIN'S THREE READS. Each is offered to a super admin alone, each
 * is built from reads the console already has, and each says plainly when a
 * read did not answer instead of filling the gap.
 */
const NOW = Date.parse("2026-11-16T09:00:00Z");
const viewer = (over: Partial<CopilotViewer> = {}): CopilotViewer => ({
  userId: "u1",
  firstName: "Tunde",
  isAdmin: true,
  isSuperAdmin: true,
  scopes: [],
  position: null,
  ...over,
});
const ctx = (v: CopilotViewer) => ({ viewer: v, now: NOW });

const pulse = {
  state: "ok" as const,
  data: {
    listingsLive: 340,
    listingsLiveWeekAgo: 320,
    peopleTotal: 9120,
    signupsToday: 14,
    signupsYesterday: 21,
    collectedTodayMinor: 250_000,
    collectedYesterdayMinor: 180_000,
    collectedWeekMinor: 4_500_000,
    collectedPrevWeekMinor: 3_900_000,
    newSupplyWeek: 26,
    newSupplyPrevWeek: 19,
    daily: [],
  },
};
const counts = {
  state: "ok" as const,
  data: { flags: 2, alerts: 3, applications: 4, listings: 7, reports: 1, tickets: 15, moderation: 0, agreements: 2, claims: 0, referrals: 1, payouts: 1, verification: 9 },
};
const room = {
  state: "ok" as const,
  setup: [],
  switches: readSwitches([{ key: "phone_confirmation", enabled: true }]),
  connections: [],
  waiting: [{ key: "escalations", count: 1, words: "1 escalation is waiting on you.", href: "/admin/escalations" }],
};
const supply = {
  state: "ok" as const,
  data: {
    counts: { owner: { now: 40, weekAgo: 38 }, agent: { now: 55, weekAgo: 52 }, firm: { now: 6, weekAgo: 6 }, host: { now: 11, weekAgo: 9 } },
    examplesExcluded: 12,
    rows: [],
    total: 112,
    page: 1,
    pageSize: 1,
    growth: [],
    topAreas: [],
    byPropertyType: [],
    complete: true,
  },
};
const examples = { state: "ok" as const, data: { live: [], retired: [], full: false, totals: { total: 64, liveCount: 60, retiredCount: 4, cities: 8, overdueCount: 2, nextDueOn: "2026-12-01" } } };
const month = { state: "ok" as const, data: { range: "30d" as const, buckets: [{ start: "2026-10-18", amountMinor: 10_000_000, count: 30 }, { start: "2026-10-19", amountMinor: 6_000_000, count: 12 }] } };

beforeEach(() => {
  vi.mocked(getConsolePulse).mockReset().mockResolvedValue(pulse);
  vi.mocked(getCollectedSeries).mockReset().mockResolvedValue(month);
  vi.mocked(getQueueCounts).mockReset().mockResolvedValue(counts);
  vi.mocked(readControlRoom).mockReset().mockResolvedValue(room);
  vi.mocked(getSupplyDesk).mockReset().mockResolvedValue(supply);
  vi.mocked(getExamplesConsole).mockReset().mockResolvedValue(examples);
  vi.mocked(readStaffDesk).mockReset();
  vi.mocked(getAuditLog).mockReset();
  vi.mocked(getAuditActivity).mockReset();
});

describe("who these tools are for", () => {
  it("offers all three to a super admin and to nobody else", () => {
    for (const tool of [getPlatformPulse, getStaffOverview, getWhatChanged]) {
      expect(isOfferable(tool, viewer()), tool.name).toBe(true);
      expect(isOfferable(tool, viewer({ isSuperAdmin: false })), tool.name).toBe(false);
      expect(isOfferable(tool, viewer({ isAdmin: false, isSuperAdmin: false, scopes: ["operations"] })), tool.name).toBe(false);
    }
  });

  it("refuses an admin who is not a super admin without reading anything", async () => {
    for (const tool of [getPlatformPulse, getStaffOverview, getWhatChanged]) {
      expect((await tool.handler({}, ctx(viewer({ isSuperAdmin: false })))).ok, tool.name).toBe(false);
    }
    expect(getConsolePulse).not.toHaveBeenCalled();
    expect(readStaffDesk).not.toHaveBeenCalled();
    expect(getAuditLog).not.toHaveBeenCalled();
  });

  it("reads only: no tool here has a name the forbidden list would allow through", () => {
    for (const tool of [getPlatformPulse, getStaffOverview, getWhatChanged]) expect(tool.kind).toBe("read");
  });
});

describe("get_platform_pulse", () => {
  const run = async () => {
    const out = await getPlatformPulse.handler({}, ctx(viewer()));
    if (!out.ok) throw new Error("expected an answer");
    return { data: out.data as Record<string, never>, links: out.links ?? [] };
  };

  it("answers with members, listings real and example, listers, money and what is waiting", async () => {
    const { data } = await run();
    expect(data.people).toMatchObject({ members: 9120, signedUpToday: 14 });
    expect(data.listings).toMatchObject({ liveReal: 340, liveRealAWeekAgo: 320, examplesLive: 60, examplesTotal: 64, examplesPastTheirDate: 2 });
    expect(data.listers).toMatchObject({ owners: 40, agents: 55, firms: 6, hosts: 11, exampleListersLeftOut: 12 });
    expect(data.moneyTakenIn).toMatchObject({ last7Days: "N45,000", the7DaysBefore: "N39,000", last30Days: "N160,000" });
    const waiting = data.waitingAcrossTheDesks as unknown as { work: string; count: number; link: string }[];
    expect(waiting.find((w) => w.link === "/admin/support")!.count).toBe(15);
    expect(waiting.find((w) => w.link === "/admin/referrals")!.count).toBe(2);
    expect(waiting.some((w) => w.count === 0)).toBe(false);
  });

  it("carries what is waiting on the founder and how each switch stands", async () => {
    const { data } = await run();
    expect(JSON.stringify(data.waitingOnYou)).toContain("1 escalation is waiting on you.");
    expect(JSON.stringify(data.switches)).toContain("Phone confirmation");
    expect(JSON.stringify(data.switches)).toContain("confirms a mobile number");
  });

  it("offers the control room, which only a super admin may open", async () => {
    const { links } = await run();
    const control = links.find((l) => l.href === "/admin/control");
    expect(control?.requires).toBe("super_admin");
  });

  it("names every read that did not answer and quotes no figure for it", async () => {
    vi.mocked(getCollectedSeries).mockResolvedValue({ state: "unavailable" });
    vi.mocked(getSupplyDesk).mockResolvedValue({ state: "unavailable" });
    vi.mocked(getExamplesConsole).mockRejectedValue(new Error("no"));
    const { data } = await run();
    expect(data.listers).toBeNull();
    expect(data.moneyTakenIn).toMatchObject({ last30Days: null, last7Days: "N45,000" });
    expect(data.couldNotBeRead as unknown as string[]).toEqual(["money over the last 30 days", "the listers", "the example listings"]);
  });

  it("says the figures could not be read when the pulse, the counts and the control room all fail", async () => {
    vi.mocked(getConsolePulse).mockResolvedValue({ state: "unavailable" });
    vi.mocked(getQueueCounts).mockResolvedValue({ state: "unavailable" });
    vi.mocked(readControlRoom).mockResolvedValue({ state: "unavailable" });
    const out = await getPlatformPulse.handler({}, ctx(viewer()));
    expect(out.ok).toBe(false);
  });
});

describe("get_staff_overview", () => {
  const rows = [
    { userId: "a", name: "Tunde", kind: "super_admin" as const, position: null, scopes: [], grantedBy: null, revokedBy: null, lastActiveAt: new Date(NOW - 3_600_000).toISOString(), note: null, grantedAt: null, revokedAt: null, revokeReason: null, handbookAcknowledgedAt: "2026-10-01T00:00:00Z", actionsLast30: 120, supportActionsLast30: 0 },
    { userId: "b", name: "Ada", kind: "staff" as const, position: "support_agent" as const, scopes: ["support" as const], grantedBy: "a", revokedBy: null, lastActiveAt: new Date(NOW - 2 * 86_400_000).toISOString(), note: null, grantedAt: "2026-09-01T00:00:00Z", revokedAt: null, revokeReason: null, handbookAcknowledgedAt: "2026-09-02T00:00:00Z", actionsLast30: 40, supportActionsLast30: 36 },
    { userId: "c", name: "Chidi", kind: "staff" as const, position: "finance_officer" as const, scopes: ["finance" as const], grantedBy: "a", revokedBy: null, lastActiveAt: new Date(NOW - 40 * 86_400_000).toISOString(), note: null, grantedAt: "2026-08-01T00:00:00Z", revokedAt: null, revokeReason: null, handbookAcknowledgedAt: null, actionsLast30: 0, supportActionsLast30: 0 },
    { userId: "d", name: "Gone", kind: "staff" as const, position: "support_agent" as const, scopes: ["support" as const], grantedBy: "a", revokedBy: "a", lastActiveAt: null, note: null, grantedAt: "2026-07-01T00:00:00Z", revokedAt: "2026-10-01T00:00:00Z", revokeReason: "left", handbookAcknowledgedAt: null, actionsLast30: 0, supportActionsLast30: 0 },
  ];

  it("counts the people, the handbook and who has been active, and leaves withdrawn access out", async () => {
    vi.mocked(readStaffDesk).mockResolvedValue({ state: "ok", rows, recent: [{ at: "2026-11-15T10:00:00Z", actor: "Tunde", action: "staff.grant", entity: "staff_grant b" }] });
    const out = await getStaffOverview.handler({}, ctx(viewer()));
    if (!out.ok) throw new Error("expected an answer");
    const data = out.data as Record<string, never>;
    expect(data.people).toMatchObject({ total: 3, superAdmins: 1, admins: 0, staffWithScopes: 2, accessWithdrawn: 1 });
    expect(data.handbook).toMatchObject({ acknowledged: 2 });
    expect(JSON.stringify(data.handbook)).toContain("Chidi");
    expect(data.activeInTheLast7Days).toMatchObject({ count: 2, of: 3 });
    expect(JSON.stringify(data.quiet)).toContain("Chidi");
  });

  it("names the teams nobody is on, and why that lands on the founder", async () => {
    vi.mocked(readStaffDesk).mockResolvedValue({ state: "ok", rows, recent: [] });
    const out = await getStaffOverview.handler({}, ctx(viewer()));
    if (!out.ok) throw new Error("expected an answer");
    const data = out.data as { teamsWithNobodyOnThem: string[]; whyAnEmptyTeamMatters: string };
    expect(data.teamsWithNobodyOnThem).toContain("Reports and moderation");
    expect(data.teamsWithNobodyOnThem).not.toContain("Support");
    expect(data.teamsWithNobodyOnThem).not.toContain("Finance");
    expect(data.whyAnEmptyTeamMatters).toContain("COO");
  });

  it("counts a role holder as covering nothing, since a team needs somebody who holds the area", () => {
    expect(teamsWithNobody([{ kind: "super_admin", scopes: [], revokedAt: null }])).toContain("support");
    expect(teamsWithNobody([{ kind: "staff", scopes: ["support"], revokedAt: null }])).not.toContain("support");
    expect(teamsWithNobody([{ kind: "staff", scopes: ["support"], revokedAt: "2026-10-01" }])).toContain("support");
  });

  it("refuses when the desk refuses, and says so when it could not be read", async () => {
    vi.mocked(readStaffDesk).mockResolvedValue({ state: "forbidden" });
    expect((await getStaffOverview.handler({}, ctx(viewer()))).ok).toBe(false);
    vi.mocked(readStaffDesk).mockResolvedValue({ state: "unavailable" });
    const out = await getStaffOverview.handler({}, ctx(viewer()));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toContain("could not be read");
  });

  it("survives a read that throws", async () => {
    vi.mocked(readStaffDesk).mockRejectedValue(new Error("boom"));
    expect((await getStaffOverview.handler({}, ctx(viewer()))).ok).toBe(false);
  });
});

describe("get_what_changed", () => {
  it("puts each entry in plain words with the desk its record lives on", async () => {
    vi.mocked(getAuditLog).mockResolvedValue({
      state: "ok",
      data: {
        full: true,
        rows: [
          { id: "1", createdAt: "2026-11-15T10:00:00Z", actorId: "a", actorName: "Tunde", action: "listing.approve", entityType: "listing", entityId: "L1", metadata: {} },
          { id: "2", createdAt: "2026-11-15T09:00:00Z", actorId: null, actorName: null, action: "wallet.funding.posted", entityType: "wallet_entry", entityId: "W1", metadata: {} },
        ],
      },
    });
    vi.mocked(getAuditActivity).mockResolvedValue({ state: "ok", data: { perDay: [], byKind: [{ label: "listing", count: 40 }], byActor: [{ label: "Tunde", count: 30 }], windowDays: 30, total: 212, capped: false } });
    const out = await getWhatChanged.handler({}, ctx(viewer()));
    if (!out.ok) throw new Error("expected an answer");
    const data = out.data as Record<string, never>;
    const latest = data.latest as unknown as { items: { who: string; did: string; desk: string; link: string }[]; morePagesExist: boolean };
    expect(latest.items[0]).toMatchObject({ who: "Tunde", did: "listing approve", desk: "Listings", link: "/admin/listings" });
    expect(latest.items[1]).toMatchObject({ who: "the system", desk: "Payments", link: "/admin/payments" });
    expect(latest.morePagesExist).toBe(true);
    expect(data.lastThirtyDays).toMatchObject({ recordedDecisions: 212, isAFloor: false, days: 30 });
  });

  it("narrows to one kind of record through the desk's own filter", async () => {
    vi.mocked(getAuditLog).mockResolvedValue({ state: "ok", data: { full: false, rows: [] } });
    vi.mocked(getAuditActivity).mockResolvedValue({ state: "unavailable" });
    await getWhatChanged.handler({ kind: "listing" }, ctx(viewer()));
    expect(getAuditLog).toHaveBeenCalledWith({ status: "listing" });
  });

  it("names the half that did not answer rather than filling it", async () => {
    vi.mocked(getAuditLog).mockResolvedValue({ state: "ok", data: { full: false, rows: [] } });
    vi.mocked(getAuditActivity).mockResolvedValue({ state: "unavailable" });
    const out = await getWhatChanged.handler({}, ctx(viewer()));
    if (!out.ok) throw new Error("expected an answer");
    const data = out.data as { lastThirtyDays: null; couldNotBeRead: string[] };
    expect(data.lastThirtyDays).toBeNull();
    expect(data.couldNotBeRead).toEqual(["the last 30 days"]);
  });

  it("says the trail could not be read when both reads fail", async () => {
    vi.mocked(getAuditLog).mockResolvedValue({ state: "unavailable" });
    vi.mocked(getAuditActivity).mockRejectedValue(new Error("boom"));
    expect((await getWhatChanged.handler({}, ctx(viewer()))).ok).toBe(false);
  });

  it("sends an unknown kind of record to the audit log rather than a guessed desk", () => {
    expect(recordDesk("something_new")).toEqual({ desk: "Audit log", href: "/admin/audit" });
    expect(recordDesk("staff_grant").href).toBe("/admin/staff");
    expect(actionWords("staff.grant_scope")).toBe("staff grant scope");
  });
});
