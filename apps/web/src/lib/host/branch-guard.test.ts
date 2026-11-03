import { describe, expect, it } from "vitest";
import { BRANCH_REFUSAL, wrongBranch } from "./branch-guard";

describe("each host branch writes only its own things", () => {
  it("refuses rooms, rates and places on a restaurant", () => {
    const r = wrongBranch("restaurant", "stay");
    expect(r && !r.ok ? r.error : null).toBe(BRANCH_REFUSAL.stay);
  });
  it("refuses tables and the menu on a hotel or a shortlet", () => {
    for (const kind of ["hotel", "shortlet_operator", "guest_house"]) {
      const r = wrongBranch(kind, "restaurant");
      expect(r && !r.ok ? r.error : null).toBe(BRANCH_REFUSAL.restaurant);
    }
  });
  it("lets each branch write its own, and an unset kind through", () => {
    expect(wrongBranch("hotel", "stay")).toBeNull();
    expect(wrongBranch("restaurant", "restaurant")).toBeNull();
    expect(wrongBranch(null, "stay")).toBeNull();
  });
});
