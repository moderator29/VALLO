/**
 * The Guarantee claims desk's two money actions (migration fm02): while the
 * claimant owes a lost card chargeback the database answers
 * `chargeback_hold`, and the reviewer reads why and what to do in words,
 * on the caller's own client. Nothing is retried, nothing is revalidated.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { fn: string; args: Record<string, unknown> | undefined }[] = [];
let answers: Record<string, unknown> = {};
const revalidatePath = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("../locale", () => ({ getLocale: async () => "en" }));
vi.mock("../alerts", () => ({ recordAlert: vi.fn() }));
vi.mock("./guard", () => ({
  requireAdmin: vi.fn(async (scope?: string) => {
    expect(scope).toBe("guarantee");
    return {
      state: "admin",
      user: { id: "staff-1" },
      userClient: {
        rpc: async (fn: string, args?: Record<string, unknown>) => {
          calls.push({ fn, args });
          return { data: answers[fn] ?? { status: "ok" }, error: null };
        },
      },
    };
  }),
  adminRefusal: () => "This area is for the Vallo operations team.",
}));

const { decideClaim, markClaimPaid } = await import("./agreements-actions");

const CLAIM = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  calls.length = 0;
  answers = {};
  revalidatePath.mockClear();
});

describe("Guarantee claim payouts under the payout rule (migration fm02)", () => {
  it("says why approving is refused while the claimant owes a lost chargeback", async () => {
    answers.admin_decide_guarantee_claim = { status: "chargeback_hold" };
    const result = await decideClaim({ claimId: CLAIM, decision: "approve", amountNaira: "15000" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/lost card chargeback/);
      expect(result.error).toMatch(/Nothing was approved/);
      expect(result.error).toMatch(/override this one claim/);
    }
    expect(calls).toEqual([
      { fn: "admin_decide_guarantee_claim", args: { p_claim: CLAIM, p_decision: "approve", p_amount_minor: 1_500_000, p_reason: null } },
    ]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says why marking paid is refused, and what to do if the transfer already went", async () => {
    answers.admin_mark_guarantee_claim_paid = { status: "chargeback_hold" };
    const result = await markClaimPaid({ claimId: CLAIM, reference: "TRF-0001" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Nothing was recorded/);
      expect(result.error).toMatch(/If the transfer already went/);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("goes through once finance has overridden that claim", async () => {
    expect(await decideClaim({ claimId: CLAIM, decision: "approve", amountNaira: "15000" })).toEqual({ ok: true, data: null });
    expect(await markClaimPaid({ claimId: CLAIM, reference: "TRF-0001" })).toEqual({ ok: true, data: null });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/money");
  });
});
