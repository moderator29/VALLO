import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** THE TECHNICAL DESK'S DOOR, ITS HONEST STATES, AND THE ABSENCE OF ANY SECRET. */
const door = vi.hoisted(() => ({ value: { state: "ok", db: {}, user: { id: "t1" }, viaApprover: false, canApprove: false, isAdminRole: false } as Record<string, unknown> }));
vi.mock("@/lib/admin/desk-door", () => ({ deskDoor: async () => door.value }));
vi.mock("@/lib/admin/copilot/contexts/DeskCopilot", () => ({ DeskCopilot: ({ context }: { context: string | null }) => <div>{context ?? "no-context"}</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
const reads = vi.hoisted(() => ({ health: vi.fn(), incidents: vi.fn(), updates: vi.fn(), entries: vi.fn() }));
vi.mock("@/lib/admin/technical/queries", () => ({ readHealth: reads.health, readIncidents: reads.incidents, readIncidentUpdates: reads.updates }));
vi.mock("@/lib/admin/desk-entries/queries", () => ({ readEntries: reads.entries, readNames: async () => new Map() }));

const { default: Page } = await import("./page");
const text = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const health = (over: Record<string, unknown> = {}) => ({
  deployment: { environment: "production", release: "abcdef1", runtime: "production" },
  providers: [{ name: "Email", configured: true }, { name: "Video and audio calls", configured: false }],
  jobs: [{ name: "canary", schedule: "Every 5 minutes", state: "late", lastAt: "2026-11-10T08:00:00Z", lastOutcome: "ok", ok: 3, attention: 0, failed: 0 }],
  openAlerts: 2,
  crashes: { open: 1, last24h: 4, bySource: { web: 1 }, daily: Array.from({ length: 14 }, (_, i) => ({ day: `2026-10-${String(i + 20).padStart(2, "0")}`, count: i })), groups: [{ source: "web", type: "TypeError", area: "checkout", release: "abcdef1", occurrences: 9, status: "open", lastSeenAt: "2026-11-10T08:00:00Z" }] },
  ...over,
});
const incident = (over: Record<string, unknown> = {}) => ({ id: "i1", title: "Bookings slow", severity: "sev2", status: "open", startedAt: "2026-11-10T08:00:00Z", resolvedAt: null, summary: "since 8am", resolutionSummary: null, createdBy: null, createdAt: "x", updatedAt: "x", ...over });

beforeEach(() => {
  door.value = { state: "ok", db: {}, user: { id: "t1" }, viaApprover: false, canApprove: false, isAdminRole: false };
  for (const r of Object.values(reads)) r.mockReset();
  reads.health.mockResolvedValue(health());
  reads.incidents.mockResolvedValue({ state: "ok", data: [] });
  reads.updates.mockResolvedValue({ state: "ok", data: [] });
  reads.entries.mockResolvedValue({ state: "ok", data: [] });
});

describe("the door", () => {
  it.each([
    ["signed-out", /Sign in/],
    ["step-up", /security key/],
    ["unconfigured", /cannot reach the console/],
    ["not-admin", /Technical Administrator/],
  ])("answers %s with its own words and reads nothing", async (state, words) => {
    door.value = { state };
    const el = await Page({ searchParams: Promise.resolve({}) });
    expect(reads.health).not.toHaveBeenCalled();
    expect(text(el as React.ReactElement)).toMatch(words);
  });
});

describe("health", () => {
  it("shows late jobs, services as set up or not, the release code, and no key", async () => {
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/canary/);
    expect(out).toMatch(/Late/);
    expect(out).toMatch(/Email: set up/);
    expect(out).toMatch(/Video and audio calls: not set up/);
    expect(out).toMatch(/abcdef1/);
    expect(out).not.toMatch(/sk_live|service_role|SUPABASE_/);
  });
  it("says Not available for parts it could not read, never zero", async () => {
    reads.health.mockResolvedValue(health({ jobs: null, openAlerts: null, crashes: { open: null, last24h: null, bySource: null, daily: null, groups: null } }));
    const out = text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement);
    expect(out).toMatch(/job history could not be read/);
    expect(out).not.toMatch(/undefined|NaN/);
    const errors = text((await Page({ searchParams: Promise.resolve({ tab: "errors" }) })) as React.ReactElement);
    expect(errors).toMatch(/crash log could not be read/);
  });
  it("lists the most frequent open error types without a message", async () => {
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "errors" }) })) as React.ReactElement);
    expect(out).toMatch(/TypeError/);
    expect(out).toMatch(/in the last seven days/);
  });
});

describe("incidents", () => {
  it("says the tables are not set up and never crashes", async () => {
    reads.incidents.mockResolvedValue({ state: "not-open" });
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "incidents" }) })) as React.ReactElement);
    expect(out).toMatch(/incident tables are not on this database yet/);
    expect(out).toContain("no-context");
  });
  it("lists an open incident with its controls and builds the copilot line from counts", async () => {
    reads.incidents.mockResolvedValue({ state: "ok", data: [incident()] });
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "incidents" }) })) as React.ReactElement);
    expect(out).toMatch(/Bookings slow/);
    expect(out).toMatch(/Resolve incident/);
    expect(out).toMatch(/Declare an incident/);
    expect(out.slice(out.indexOf("1 incident open"))).not.toMatch(/Bookings/);
  });
  it("lets the approver read the log but not write", async () => {
    door.value = { state: "ok", db: {}, user: { id: "coo" }, viaApprover: true, canApprove: true, isAdminRole: false };
    reads.incidents.mockResolvedValue({ state: "ok", data: [incident()] });
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "incidents" }) })) as React.ReactElement);
    expect(out).toMatch(/Bookings slow/);
    expect(out).not.toMatch(/Declare incident|Post update/);
  });
});

describe("the notes", () => {
  it("shows a reminder running out soon at the top", async () => {
    reads.entries.mockResolvedValue({ state: "ok", data: [{ id: "r1", desk: "technical", kind: "reminder", title: "Main domain", body: "", status: "open", dueOn: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10), linkUrl: null, subjectUser: null, fields: {}, reviewNote: null, approvedBy: null, approvedAt: null, ownerId: null, createdBy: null, createdAt: "x", updatedAt: "x" }] });
    expect(text((await Page({ searchParams: Promise.resolve({}) })) as React.ReactElement)).toMatch(/Running out soon/);
  });
  it("draws the runbook tool with its form", async () => {
    const out = text((await Page({ searchParams: Promise.resolve({ tab: "runbooks" }) })) as React.ReactElement);
    expect(out).toMatch(/No runbooks yet/);
    expect(out).toMatch(/Add runbook/);
  });
});
