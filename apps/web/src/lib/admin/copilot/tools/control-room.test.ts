import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/control/read", () => ({ readControlRoom: vi.fn() }));

const { getControlRoom } = await import("./control-room");
const { readControlRoom } = await import("@/lib/admin/control/read");
const { SETUP_ITEMS, readConnections, readReach, readSwitches } = await import("@/lib/admin/control/setup");
const { isOfferable } = await import("./registry");

const viewer = (isSuperAdmin: boolean) => ({ userId: "u", firstName: "A", isAdmin: true, isSuperAdmin, scopes: [], position: null }) as never;
const ctx = (isSuperAdmin: boolean) => ({ viewer: viewer(isSuperAdmin), now: Date.parse("2026-11-15T12:00:00Z") });

describe("the control room tool", () => {
  it("is offered to a super admin and to nobody else", () => {
    expect(isOfferable(getControlRoom, viewer(true))).toBe(true);
    expect(isOfferable(getControlRoom, viewer(false))).toBe(false);
  });

  it("refuses an admin who is not a super admin without reading anything", async () => {
    const out = await getControlRoom.handler({}, ctx(false));
    expect(out.ok).toBe(false);
    expect(readControlRoom).not.toHaveBeenCalled();
  });

  it("answers with what is waiting, the file to run, the switches and the services, and never a secret", async () => {
    vi.mocked(readControlRoom).mockResolvedValueOnce({
      state: "ok",
      setup: SETUP_ITEMS.map((item) => ({ item, state: item.key === "staff_escalations" ? ("waiting" as const) : ("ready" as const) })),
      switches: readSwitches([{ key: "phone_confirmation", enabled: true }]),
      connections: readConnections({ codesNigeria: true, codesAbroad: false, paymentPartner: false, paymentPartnerWebhook: false, cardPayments: true, email: true, copilot: true, onCallPage: false }),
      reach: readReach(true),
      waiting: [{ key: "escalations", count: 1, words: "1 escalation is waiting on you.", href: "/admin/escalations" }],
    });
    const out = await getControlRoom.handler({}, ctx(true));
    expect(out.ok).toBe(true);
    const text = JSON.stringify(out);
    expect(text).toContain("1 escalation is waiting on you.");
    expect(text).toContain("supabase/migrations/pending/staff_escalations_2026-11-15.sql");
    expect(text).toContain("members abroad are not asked for a phone");
    /* The control room's own reading of whether Vallo can be read signed out. */
    expect(text).toContain("Reading Vallo without an account");
    expect(text).toContain("VALLO_PUBLIC_CATALOGUE");
    expect(text).not.toMatch(/sk_|whsec_/);
  });

  it("says it could not be read rather than guess", async () => {
    vi.mocked(readControlRoom).mockResolvedValueOnce({ state: "unavailable" });
    expect((await getControlRoom.handler({}, ctx(true))).ok).toBe(false);
  });
});
