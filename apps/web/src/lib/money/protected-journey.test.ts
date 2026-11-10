import { describe, expect, it } from "vitest";
import { ARRANGEMENT_STATUSES } from "./arrangement-states";
import { PROTECTED_STAGES, STAGE_IDENTITY, journeyTimeline, milestoneFor, stageFor, transferCountdown } from "./protected-journey";
import { PROTECTED_CATEGORIES } from "./protected-categories";
import { PROTECTED_STAGE_LABEL } from "./copy";

const NOW = Date.parse("2026-11-10T10:00:00Z");
const stage = (status: (typeof ARRANGEMENT_STATUSES)[number], over: { transferReported?: boolean; fundingExpiresAt?: string | null } = {}) =>
  stageFor({ status, transferReported: over.transferReported ?? false, fundingExpiresAt: over.fundingExpiresAt ?? null, now: NOW });

describe("the screen is chosen by the recorded state, never by the browser", () => {
  it("every recorded state has a screen", () => {
    for (const status of ARRANGEMENT_STATUSES) expect(PROTECTED_STAGES).toContain(stage(status));
  });

  it("pressing 'I've made the transfer' never reaches protected", () => {
    expect(stage("awaiting_payment", { transferReported: true })).toBe("confirming");
    for (const status of ["preparing", "unknown", "awaiting_payment", "payment_processing"] as const) {
      expect(stage(status, { transferReported: true })).not.toBe("protected");
    }
  });

  it("only the provider-confirmed state is protected, and only its own report releases", () => {
    const protectedFrom = ARRANGEMENT_STATUSES.filter((s) => stage(s) === "protected");
    expect(protectedFrom).toEqual(["protected"]);
    expect(ARRANGEMENT_STATUSES.filter((s) => stage(s) === "released")).toEqual(["released"]);
  });

  it("an unknown or not yet answered call is confirming, never a success", () => {
    expect(stage("unknown")).toBe("confirming");
    expect(stage("preparing")).toBe("confirming");
  });

  it("a passed genuine expiry is expired; no expiry never expires", () => {
    expect(stage("awaiting_payment", { fundingExpiresAt: "2026-11-10T09:59:00Z" })).toBe("expired");
    expect(stage("awaiting_payment", { fundingExpiresAt: null })).toBe("awaiting_transfer");
  });
});

describe("every state has words and an icon", () => {
  it.each(PROTECTED_STAGES)("%s", (s) => {
    expect(PROTECTED_STAGE_LABEL[s].length).toBeGreaterThan(3);
    expect(STAGE_IDENTITY[s].icon).toBeTruthy();
  });
});

describe("the timeline", () => {
  const stamps = { fundedAt: "2026-11-10T09:40:00Z", releaseRequestedAt: null, releaseConfirmedAt: null, refundConfirmedAt: null };
  it("protected: transfer and held done, the milestone now, release next", () => {
    expect(journeyTimeline("protected", stamps).map((s) => s.state)).toEqual(["done", "done", "now", "next"]);
  });
  it("a refund or a dispute stops the spine where it stood", () => {
    expect(journeyTimeline("refunded", stamps).map((s) => s.state)).toEqual(["done", "done", "stopped", "next"]);
    expect(journeyTimeline("disputed", stamps).map((s) => s.state)).toEqual(["done", "done", "stopped", "next"]);
  });
  it("released: every step done", () => {
    expect(journeyTimeline("released", stamps).every((s) => s.state === "done")).toBe(true);
  });
});

describe("the transfer clock", () => {
  it("draws only a genuine, future expiry", () => {
    expect(transferCountdown(null, NOW)).toBeNull();
    expect(transferCountdown("not a date", NOW)).toBeNull();
    expect(transferCountdown("2026-11-10T09:59:59Z", NOW)).toBeNull();
    expect(transferCountdown("2026-11-10T10:14:32Z", NOW)).toMatchObject({ label: "14:32", remainingSeconds: 872 });
    expect(transferCountdown("2026-11-10T12:00:05Z", NOW)?.label).toBe("2:00:05");
  });
});

describe("the milestone is the category's own", () => {
  it("a stay checks in, a rental gets the keys, a sale never has a protected flow", () => {
    expect(milestoneFor("shortlet")).toBe("check_in");
    expect(milestoneFor("residential_rent")).toBe("keys");
    expect(milestoneFor("property_sale")).toBeNull();
    expect(milestoneFor("land_sale")).toBeNull();
    for (const c of PROTECTED_CATEGORIES) expect([null, "check_in", "keys"]).toContain(milestoneFor(c));
  });
});
