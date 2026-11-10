import { describe, expect, it } from "vitest";
import { shapeReferredBy } from "./referred-by";

describe("shapeReferredBy", () => {
  it("says none when the account has no referral row", () => {
    expect(shapeReferredBy(null, null)).toEqual({ state: "none" });
  });
  it("names the referrer and the status, never an amount", () => {
    const shaped = shapeReferredBy({ referrer_id: "u1", status: "pending", attributed_at: "2026-11-01T00:00:00Z" }, "Ada Okafor");
    expect(shaped).toEqual({ state: "referred", referrerId: "u1", referrerName: "Ada Okafor", status: "pending", attributedAt: "2026-11-01T00:00:00Z" });
    expect(JSON.stringify(shaped)).not.toMatch(/reward|minor|amount/);
  });
});
