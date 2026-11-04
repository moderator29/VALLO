import { describe, expect, it } from "vitest";
import { SUBSCRIPTIONS_OPEN } from "./open";
import { startSubscriptionCheckout, startSubscriptionTrial } from "./actions";

describe("plans are not offered while App Review 3.1.1 is open", () => {
  it("is switched off", () => {
    expect(SUBSCRIPTIONS_OPEN).toBe(false);
  });
  it("starts no trial and opens no checkout", async () => {
    expect(await startSubscriptionTrial("pro")).toEqual({ ok: true, data: { started: false, reason: "unavailable" } });
    expect(await startSubscriptionCheckout("pro")).toEqual({ ok: true, data: { opened: false, reason: "closed" } });
  });
});
