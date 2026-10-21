import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * NO-SHOWS: the three doors, the sentences their refusals become, the staff
 * gate on the third, and the admin panel's arithmetic. The database function
 * decides who, when and once; these pin what the app does with its answer.
 */

const session = vi.hoisted(() => ({ resolveSession: vi.fn() }));
const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(), adminRefusal: vi.fn(() => "Staff only.") }));
const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => true) }));
vi.mock("../actions/session", () => session);
vi.mock("../admin/guard", () => guard);
vi.mock("../admin/audit", () => audit);
const parties = vi.hoisted(() => ({
  noShow: { reported_by: "renter", absent_id: "lister" } as Record<string, string> | null,
  viewing: { requester_id: "renter", lister_id: "lister" } as Record<string, string> | null,
}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "inspection_no_shows" ? parties.noShow : table === "inspection_requests" ? parties.viewing : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("server-only", () => ({}));

const { reportNoShow, disputeNoShow, resolveNoShow } = await import("./no-show-actions");
const { noShowActivityFrom } = await import("../admin/reads/operations");
const { viewingTrack } = await import("@/components/app/status/tracks");
const { statusFor } = await import("@/components/app/inspections/status");

const ID = "44444444-4444-4444-8444-444444444444";

function client(answer: { data?: unknown; error?: { hint?: string } | null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    supabase: {
      rpc: (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
      },
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("reporting and disputing a no-show", () => {
  it("reports through the database function, note and all", async () => {
    const c = client({ data: "reported" });
    session.resolveSession.mockResolvedValue({ state: "signed-in", user: { id: "u" }, supabase: c.supabase });
    const result = await reportNoShow({ id: ID, note: "Waited forty minutes." });
    expect(result.ok).toBe(true);
    expect(c.calls).toEqual([{ fn: "report_inspection_no_show", args: { p_inspection: ID, p_note: "Waited forty minutes." } }]);
  });

  it("says too early in words", async () => {
    const c = client({ error: { hint: "no_show_too_early" } });
    session.resolveSession.mockResolvedValue({ state: "signed-in", user: { id: "u" }, supabase: c.supabase });
    const result = await reportNoShow({ id: ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("once the viewing time has come");
  });

  it("says a closed dispute window in words", async () => {
    const c = client({ error: { hint: "no_show_dispute_closed" } });
    session.resolveSession.mockResolvedValue({ state: "signed-in", user: { id: "u" }, supabase: c.supabase });
    const result = await disputeNoShow({ id: ID, note: "I was at the gate." });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("48 hours");
    expect(c.calls[0]?.fn).toBe("dispute_inspection_no_show");
  });

  it("asks a signed-out caller to sign in, and calls nothing", async () => {
    session.resolveSession.mockResolvedValue({ state: "signed-out" });
    const result = await reportNoShow({ id: ID });
    expect(result.ok).toBe(false);
  });
});

describe("staff deciding a dispute", () => {
  it("is refused to anyone the admin guard refuses", async () => {
    guard.requireAdmin.mockResolvedValue({ state: "not-admin" });
    const result = await resolveNoShow({ id: ID, upheld: true });
    expect(result.ok).toBe(false);
  });

  it("decides through the database function and is audited", async () => {
    const c = client({ data: "overturned" });
    guard.requireAdmin.mockResolvedValue({ state: "admin", supabase: c.supabase, user: { id: "staff" } });
    const result = await resolveNoShow({ id: ID, upheld: false });
    expect(result.ok).toBe(true);
    expect(c.calls).toEqual([{ fn: "resolve_inspection_no_show", args: { p_inspection: ID, p_upheld: false } }]);
    expect(audit.writeAudit).toHaveBeenCalledOnce();
  });

  it("refuses a member of staff who is part of the viewing, and calls nothing", async () => {
    for (const who of ["renter", "lister"]) {
      const c = client({ data: "upheld" });
      guard.requireAdmin.mockResolvedValue({ state: "admin", supabase: c.supabase, user: { id: who } });
      const result = await resolveNoShow({ id: ID, upheld: true });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/another member of staff/);
      expect(c.calls).toEqual([]);
    }
  });
});

describe("the admin no-show panel", () => {
  const row = (over: Partial<Parameters<typeof noShowActivityFrom>[0][number]>) => ({
    inspection_id: ID,
    absent_id: "a",
    absent_role: "requester" as const,
    reported_at: "2026-10-01T10:00:00Z",
    disputed_at: null,
    dispute_note: null,
    resolved_at: null,
    resolution: null,
    ...over,
  });

  it("lists open disputes and counts repeats, never an overturned one", () => {
    const out = noShowActivityFrom(
      [
        row({ inspection_id: "1", disputed_at: "2026-10-02T10:00:00Z" }),
        row({ inspection_id: "2", reported_at: "2026-10-05T10:00:00Z" }),
        row({ inspection_id: "3", absent_id: "b", resolution: "overturned", resolved_at: "x", disputed_at: "y" }),
        row({ inspection_id: "4", absent_id: "b" }),
      ],
      new Map([["1", "Yaba flat"]]),
      new Map([["a", "Ada"]]),
    );
    expect(out.disputes.map((d) => d.inspectionId)).toEqual(["1"]);
    expect(out.disputes[0]?.listingTitle).toBe("Yaba flat");
    expect(out.repeats).toEqual([{ userId: "a", name: "Ada", count: 2, lastAt: "2026-10-05T10:00:00Z" }]);
  });
});

describe("a no-show on the card", () => {
  it("reads as a no-show, with the visit as the step that failed", () => {
    expect(statusFor({ state: "NO_SHOW", outcome: null }, "lister")).toEqual({ label: "No-show", tone: "bad" });
    const steps = viewingTrack({
      state: "NO_SHOW",
      outcome: null,
      createdAt: "2026-10-01T10:00:00Z",
      respondedAt: "2026-10-01T12:00:00Z",
      slotAt: "2026-10-03T10:00:00Z",
    });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "failed", "upcoming"]);
  });
});
