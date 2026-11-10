import { describe, expect, it } from "vitest";
import { heldModel, type HeldFacts } from "./held-model";

const base: HeldFacts = {
  role: "renter",
  status: "protected",
  amountMinor: 180_000_000,
  providerFeeMinor: null,
  paused: false,
  counterpartName: "Ada",
  placeTitle: "Yaba flat",
  moveIn: "2026-11-01",
  milestones: [],
};

describe("step 8, FUNDED (D68d)", () => {
  it("the renter sees it held, what releases it, and one action: release", () => {
    const m = heldModel(base);
    expect(m.title).toBe("Your money is held, not paid");
    expect(m.badge).toEqual({ label: "Held", tone: "held" });
    expect(m.steps.map((s) => s.state)).toEqual(["now", "next", "next"]);
    expect(m.canRelease).toBe(true);
    expect(m.note).toMatch(/Do not confirm/);
  });

  it("the lister cannot release, and their take-home shows only once the provider reported its fee", () => {
    expect(heldModel({ ...base, role: "lister" })).toMatchObject({ canRelease: false, receiveMinor: null });
    expect(heldModel({ ...base, role: "lister", providerFeeMinor: 3_600_000 }).receiveMinor).toBe(176_400_000);
  });

  it("a paused release cannot be swiped, and says why", () => {
    const m = heldModel({ ...base, paused: true });
    expect(m.canRelease).toBe(false);
    expect(m.badge.tone).toBe("attention");
    expect(m.note).toMatch(/Vallo is looking at this deal/);
  });

  it("nothing can be released before it is held, or after it is released", () => {
    expect(heldModel({ ...base, status: "awaiting_payment" })).toMatchObject({ canRelease: false, badge: { tone: "waiting" } });
    const done = heldModel({ ...base, status: "released" });
    expect(done.canRelease).toBe(false);
    expect(done.steps.every((s) => s.state === "done")).toBe(true);
  });

  it("a staged payment releases its next pending milestone, one at a time", () => {
    const m = heldModel({
      ...base,
      milestones: [
        { position: 1, title: "First rent", amountMinor: 60_000_000, status: "released" },
        { position: 2, title: "Balance", amountMinor: 120_000_000, status: "pending" },
      ],
    });
    expect(m.canRelease).toBe(false);
    expect(m.nextMilestone).toEqual({ position: 2, title: "Balance", amountMinor: 120_000_000 });
  });
});
