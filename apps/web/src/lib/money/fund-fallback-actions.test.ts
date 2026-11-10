import { beforeEach, describe, expect, it, vi } from "vitest";
import { SWITCH_TO_CARD_REFUSED } from "./copy";

/*
 * The calm way out of the escrow step (founder instruction, 13 October 2026):
 * card only where the rules allow it, an unfunded escrow withdrawn at the
 * partner before the choice moves, a held or moving payment never touched,
 * and the database's own rule (`payment_rail_choose`) deciding the move.
 */

const AG = "4f0e8a52-3c1b-4f7a-9d2e-0b6a1c2d3e4f";
const seam = vi.hoisted(() => ({
  options: { status: "ok", options: ["escrow", "card"], payer: true } as Record<string, unknown>,
  choose: { status: "ok", choice: "card" } as Record<string, unknown>,
  withdraw: { outcome: "withdrawn" } as Record<string, unknown>,
  rpcs: [] as string[],
  withdrawCalls: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../alerts", () => ({ recordAlert: async () => ({ ok: true }) }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: "payer" },
    supabase: {
      rpc: async (fn: string) => {
        seam.rpcs.push(fn);
        return { data: fn === "payment_rail_options" ? seam.options : seam.choose, error: null };
      },
      from: () => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          neq: () => chain,
          maybeSingle: async () => ({ data: { id: AG, kind: "stay", booking_id: "bk-1", inspection_id: null }, error: null }),
        };
        return chain;
      },
    },
  }),
}));
vi.mock("./member-wallet", () => ({ adminDb: () => ({}) }));
vi.mock("../payments/providers/payluk", () => ({ paylukContext: () => ({}) }));
vi.mock("./provider-arrangements", () => ({
  withdrawForCard: async () => {
    seam.withdrawCalls += 1;
    return seam.withdraw;
  },
}));

const { switchEscrowToCard } = await import("./fund-fallback-actions");

beforeEach(() => {
  seam.options = { status: "ok", options: ["escrow", "card"], payer: true };
  seam.choose = { status: "ok", choice: "card" };
  seam.withdraw = { outcome: "withdrawn" };
  seam.rpcs = [];
  seam.withdrawCalls = 0;
});

describe("switchEscrowToCard", () => {
  it("withdraws the unfunded escrow, stores card through the database, and opens the card checkout", async () => {
    expect(await switchEscrowToCard({ agreementId: AG })).toEqual({ ok: true, data: { next: "/checkout/bk-1", review: false } });
    expect(seam.withdrawCalls).toBe(1);
    expect(seam.rpcs).toEqual(["payment_rail_options", "payment_rail_choose"]);
  });

  it("a purchase is escrow only: refused with a sentence, nothing withdrawn", async () => {
    seam.options = { status: "ok", options: ["escrow"], payer: true };
    expect(await switchEscrowToCard({ agreementId: AG })).toEqual({ ok: false, error: SWITCH_TO_CARD_REFUSED.card_not_allowed });
    expect(seam.withdrawCalls).toBe(0);
  });

  it("money the partner holds or is moving is never switched: the payer is told where it is", async () => {
    seam.withdraw = { outcome: "refused", reason: "held" };
    expect(await switchEscrowToCard({ agreementId: AG })).toEqual({ ok: false, error: SWITCH_TO_CARD_REFUSED.held });
    seam.withdraw = { outcome: "refused", reason: "moving" };
    expect(await switchEscrowToCard({ agreementId: AG })).toEqual({ ok: false, error: SWITCH_TO_CARD_REFUSED.moving });
    expect(seam.rpcs.filter((r) => r === "payment_rail_choose")).toHaveLength(0);
  });

  it("when a person must look first, the payer is sent to the agreement, where escrow is still open", async () => {
    seam.choose = { status: "ok", choice: "card", review: true };
    expect(await switchEscrowToCard({ agreementId: AG })).toEqual({ ok: true, data: { next: `/agreements/${AG}`, review: true } });
  });

  it("a card attempt already moving locks the choice, calmly", async () => {
    seam.choose = { status: "payment_started" };
    expect(await switchEscrowToCard({ agreementId: AG })).toEqual({ ok: false, error: SWITCH_TO_CARD_REFUSED.locked });
  });

  it("only the payer", async () => {
    seam.options = { status: "ok", options: ["escrow", "card"], payer: false };
    expect((await switchEscrowToCard({ agreementId: AG })).ok).toBe(false);
    expect(seam.withdrawCalls).toBe(0);
  });
});
