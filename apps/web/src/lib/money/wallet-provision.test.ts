import { beforeEach, describe, expect, it, vi } from "vitest";

const upserts: unknown[] = [];
const findCustomer = vi.fn();
const createCustomer = vi.fn();
let account: { status: string; provider_customer_id: string | null } | null = null;
let profile: { firstName: string | null; lastName: string | null; phone: string | null; email: string | null } = { firstName: "Ada", lastName: "Okafor", phone: "+2348012345678", email: "ada@example.com" };

vi.mock("server-only", () => ({}));
vi.mock("../payments/providers", () => ({ memberWalletRailLive: async () => "live" }));
vi.mock("../security/money-limits", () => ({ guardMoney: async () => ({ allowed: true, degraded: false }) }));
vi.mock("./audit", () => ({ recordMoneyAudit: async () => undefined }));
vi.mock("./member-wallet", () => ({
  adminDb: () => ({
    from: () => ({
      upsert: async (row: unknown) => {
        upserts.push(row);
        return { error: null };
      },
    }),
  }),
  walletProvider: () => ({ findCustomer, createCustomer }),
  loadAccount: async () => account,
  profileFor: async () => profile,
}));

import { provisionWallet } from "./wallet-provision";

const user = { id: "u1" } as never;

beforeEach(() => {
  upserts.length = 0;
  findCustomer.mockReset();
  createCustomer.mockReset();
  account = null;
  profile = { firstName: "Ada", lastName: "Okafor", phone: "+2348012345678", email: "ada@example.com" };
});

describe("provisionWallet", () => {
  it("an account that is already active answers at once and never calls the provider", async () => {
    account = { status: "ACTIVE", provider_customer_id: "c1" };
    const r = await provisionWallet(user);
    expect(r).toMatchObject({ ok: true, data: { state: "ACTIVE" } });
    expect(findCustomer).not.toHaveBeenCalled();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it("a missing detail is said, not sent: the provider is not asked", async () => {
    profile = { ...profile, lastName: null };
    const r = await provisionWallet(user);
    expect(r).toMatchObject({ ok: true, data: { state: "VERIFICATION_REQUIRED", gaps: ["last_name"] } });
    expect(findCustomer).not.toHaveBeenCalled();
  });

  it("looks the customer up before it creates one, so a second caller finds the first's account", async () => {
    findCustomer.mockResolvedValue({ ok: true, value: { customerId: "c9", status: "ACTIVE" } });
    const r = await provisionWallet(user);
    expect(findCustomer).toHaveBeenCalledTimes(1);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true });
  });
});
