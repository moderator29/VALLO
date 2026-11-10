import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({
  access: { state: "signed-out" } as Record<string, unknown>,
  rpc: vi.fn(),
  owner: "owner-1" as string | null,
  gateApplies: true,
  status: "pending" as "approved" | "pending" | "failed" | "none",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/admin/guard", () => ({ requireConsole: async () => seam.access }));
vi.mock("@/lib/admin/audit", () => ({ writeAudit: async () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/verification/lister-identity", () => ({
  identityGateApplies: async () => seam.gateApplies,
  listerIdentityStatus: async () => ({ status: seam.status, reason: { pending: "The ID is still waiting for review.", failed: "The ID check failed.", none: "No ID sent yet.", approved: "ok" }[seam.status] }),
  identityRefusal: (i: { reason: string }) => `Cannot approve: identity check not approved. ${i.reason}`,
}));

const ID = "11111111-1111-4111-8111-111111111111";
const staff = () => ({
  state: "console",
  user: { id: "staff-1" },
  supabase: {
    rpc: seam.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: seam.owner ? { owner_id: seam.owner } : null }) }) }) }),
  },
});

beforeEach(() => {
  seam.access = staff();
  seam.rpc.mockReset().mockResolvedValue({ data: "live", error: null });
  seam.owner = "owner-1";
  seam.gateApplies = true;
  seam.status = "pending";
});

describe("decideRoomOffer", () => {
  it("is for staff only", async () => {
    seam.access = { state: "signed-out" };
    const { decideRoomOffer } = await import("./actions");
    expect((await decideRoomOffer({ id: ID, decision: "approve" })).ok).toBe(false);
    expect(seam.rpc).not.toHaveBeenCalled();
  });

  it("refuses a bad id or decision before the database", async () => {
    const { decideRoomOffer } = await import("./actions");
    expect((await decideRoomOffer({ id: "x", decision: "approve" })).ok).toBe(false);
    expect((await decideRoomOffer({ id: ID, decision: "delete" as never })).ok).toBe(false);
    expect(seam.rpc).not.toHaveBeenCalled();
  });

  it("needs a reason for changes and for a refusal", async () => {
    const { decideRoomOffer } = await import("./actions");
    expect((await decideRoomOffer({ id: ID, decision: "changes", note: "no" })).ok).toBe(false);
    expect((await decideRoomOffer({ id: ID, decision: "reject" })).ok).toBe(false);
    expect(seam.rpc).not.toHaveBeenCalled();
    expect((await decideRoomOffer({ id: ID, decision: "changes", note: "Add a front photo" })).ok).toBe(true);
    expect(seam.rpc).toHaveBeenCalledWith("admin_roommate_review_decide", { p_id: ID, p_decision: "changes", p_note: "Add a front photo" });
  });

  it("refuses to approve while the owner's identity is not approved, naming the cause", async () => {
    const { decideRoomOffer } = await import("./actions");
    for (const [status, cause] of [["pending", "still waiting for review"], ["failed", "check failed"], ["none", "No ID sent yet"]] as const) {
      seam.status = status;
      const r = await decideRoomOffer({ id: ID, decision: "approve" });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain("Cannot approve: identity check not approved.");
        expect(r.error).toContain(cause);
      }
    }
    expect(seam.rpc).not.toHaveBeenCalled();
  });

  it("approves when identity is approved, or when the wall is off", async () => {
    const { decideRoomOffer } = await import("./actions");
    seam.status = "approved";
    expect((await decideRoomOffer({ id: ID, decision: "approve" })).ok).toBe(true);
    seam.status = "none";
    seam.gateApplies = false;
    expect((await decideRoomOffer({ id: ID, decision: "approve" })).ok).toBe(true);
    expect(seam.rpc).toHaveBeenCalledTimes(2);
  });

  it("passes the database's own sentence through", async () => {
    seam.status = "approved";
    seam.rpc.mockResolvedValue({ data: null, error: { code: "RM410", message: "A room offer needs at least three photos." } });
    const { decideRoomOffer } = await import("./actions");
    const r = await decideRoomOffer({ id: ID, decision: "approve" });
    expect(!r.ok && r.error).toBe("A room offer needs at least three photos.");
  });
});
