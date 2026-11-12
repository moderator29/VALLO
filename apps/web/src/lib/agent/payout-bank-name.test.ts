import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE BANK'S NAME COMES FROM THE BANK, NOT FROM THE FORM.
 *
 * `payout-actions.ts` re-resolves `account_name` server side so a tampered
 * field cannot put a friendly name on a stranger's NUBAN. `bank_name` was
 * left as the browser sent it, and it is a hidden input derived from the code
 * on the client, so an edited post stored a bank that is not the one the code
 * names. No money follows it (every Paystack call takes `bank_code`), but the
 * agent's payout screen and the support desk's lookup both read it.
 */

const seam = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  banks: vi.fn(async (): Promise<{ name: string; code: string; slug: string }[]> => [
    { name: "Guaranty Trust Bank", code: "058", slug: "gtb" },
    { name: "Zenith Bank", code: "057", slug: "zenith" },
  ]),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../payments/paystack", () => ({
  PaystackError: class extends Error {},
  isPaystackConfigured: () => true,
  listBanks: () => seam.banks(),
  resolveAccountNumber: async () => ({ accountName: "ADAEZE N OKAFOR" }),
}));
vi.mock("../payments/payee-subaccount", () => ({ ensurePayeeSubaccount: vi.fn(async () => undefined) }));
vi.mock("./listings-queries", () => ({
  getAgentContext: async () => ({
    state: "agent",
    user: { id: "u1" },
    agent: { id: "a1", displayName: "Adaeze Okafor" },
    supabase: {},
  }),
}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        seam.inserted = row;
        return { select: () => ({ single: async () => ({ data: { id: "pa1" }, error: null }) }) };
      },
    }),
    rpc: async () => ({ data: null, error: null }),
  }),
}));
vi.mock("../money/hold", () => ({ moneyHoldRefusal: () => null }));
vi.mock("../security/money-lock-guard", () => ({ moneyLockRefusalFor: async () => null }));
vi.mock("../compliance/pep-gate", () => ({ pepQuestionRefusal: async () => null }));
vi.mock("../compliance/gate", () => ({ eddGateMessage: () => "edd", isEddGateRefusal: () => false }));

const { addPayoutAccount } = await import("./payout-actions");

function form(bankName: string) {
  const fd = new FormData();
  fd.set("bankCode", "058");
  fd.set("bankName", bankName);
  fd.set("accountNumber", "0123456789");
  fd.set("accountName", "ADAEZE N OKAFOR");
  return fd;
}

beforeEach(() => {
  seam.inserted = null;
  seam.banks.mockClear();
  seam.banks.mockResolvedValue([
    { name: "Guaranty Trust Bank", code: "058", slug: "gtb" },
    { name: "Zenith Bank", code: "057", slug: "zenith" },
  ]);
});

describe("addPayoutAccount", () => {
  it("stores the bank the code names, not the one the form claimed", async () => {
    const result = await addPayoutAccount(null, form("Zenith Bank"));
    expect(result.ok).toBe(true);
    expect(seam.inserted).toMatchObject({ bank_code: "058", bank_name: "Guaranty Trust Bank" });
  });

  it("stores the honest name unchanged when the form was honest", async () => {
    await addPayoutAccount(null, form("Guaranty Trust Bank"));
    expect(seam.inserted).toMatchObject({ bank_name: "Guaranty Trust Bank" });
  });

  it("still adds the account when the processor's bank list cannot be reached", async () => {
    /* A courtesy, never a gate: an agent is not kept from their payout
       account because a list did not load. */
    seam.banks.mockRejectedValue(new Error("network"));
    const result = await addPayoutAccount(null, form("Zenith Bank"));
    expect(result.ok).toBe(true);
    expect(seam.inserted).toMatchObject({ bank_code: "058", bank_name: "Zenith Bank" });
  });
});
