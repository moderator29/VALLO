import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ on: new Set<string>(), fail: false }));
vi.mock("../../flags/read", () => ({
  /* flagIsOn answers false on a failed read, which is what `fail` models. */
  flagIsOn: async (key: string) => (flags.fail ? false : flags.on.has(key)),
}));

const { providerEnabled, assertProviderEnabled, FiatProviderDisabled } = await import("./kill-switch");

describe("provider kill switch", () => {
  beforeEach(() => {
    flags.on.clear();
    flags.fail = false;
  });
  afterEach(() => {
    delete process.env.PAYMENTS_KILL_PAYSTACK;
  });

  it("Paystack fails open: only an explicit off flag or the env kill stops it", async () => {
    expect(await providerEnabled("paystack")).toBe(true);
    flags.fail = true;
    expect(await providerEnabled("paystack")).toBe(true);
    flags.fail = false;
    flags.on.add("payments_paystack_off");
    expect(await providerEnabled("paystack")).toBe(false);
    flags.on.clear();
    process.env.PAYMENTS_KILL_PAYSTACK = "1";
    expect(await providerEnabled("paystack")).toBe(false);
  });

  it("assertProviderEnabled throws FiatProviderDisabled while Paystack is stopped", async () => {
    await expect(assertProviderEnabled("paystack")).resolves.toBeUndefined();
    process.env.PAYMENTS_KILL_PAYSTACK = "1";
    await expect(assertProviderEnabled("paystack")).rejects.toBeInstanceOf(FiatProviderDisabled);
  });
});
