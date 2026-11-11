import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANCELLATION_STOPS,
  PLATFORM_TERMS_V1,
  boundedByRefundable,
  cancelStanding,
  freeCancellationOpen,
  freeToCancelUntil,
  isNonRefundable,
  readCancellationTerms,
  refundForCancellation,
  refundForReasonUnderTerms,
  refundUnderTerms,
  termsFromPolicyRules,
  termsWindows,
} from "./cancellation";

const CHECK_IN = "2026-10-17"; // Saturday; 15:00 Lagos is 14:00Z.

describe("the platform schedule as terms", () => {
  it("is the same three stops the timeline draws", () => {
    expect(PLATFORM_TERMS_V1.tiers).toEqual([
      { closesHoursBefore: 72, refundBps: 10_000 },
      { closesHoursBefore: 0, refundBps: 5_000 },
    ]);
    expect(CANCELLATION_STOPS).toHaveLength(3);
  });

  it("equals the database's own copy, character for character in meaning", () => {
    // The applied migration (MONEY redesign, 29 September 2026), not the superseded draft.
    const dir = join(__dirname, "../../../../../supabase/migrations");
    const file = readdirSync(dir).find((name) => name.includes("_money_v20_") && name.endsWith(".sql"));
    const sql = readFileSync(join(dir, file!), "utf8");
    const json = sql.match(/select '(\{"version":1[^']+\})'::jsonb/)?.[1];
    expect(json).toBeDefined();
    const read = readCancellationTerms("platform_schedule_v1", JSON.parse(json!));
    expect(read).toEqual(PLATFORM_TERMS_V1);
  });

  it("prices a refund exactly as the old function does", () => {
    const now = new Date("2026-10-13T10:00:00Z");
    expect(refundUnderTerms(25_500_000, CHECK_IN, PLATFORM_TERMS_V1, now).refundMinor).toBe(
      refundForCancellation(25_500_000, CHECK_IN, now).refundMinor,
    );
    const late = new Date("2026-10-16T10:00:00Z");
    expect(refundUnderTerms(25_500_000, CHECK_IN, PLATFORM_TERMS_V1, late).refundMinor).toBe(12_750_000);
  });
});

describe("dated windows", () => {
  it("turns hours into the three instants a guest reads", () => {
    const windows = termsWindows(PLATFORM_TERMS_V1, CHECK_IN);
    expect(windows.map((w) => [w.refundBps, w.from?.toISOString() ?? null, w.until?.toISOString() ?? null])).toEqual([
      [10_000, null, "2026-10-14T14:00:00.000Z"],
      [5_000, "2026-10-14T14:00:00.000Z", "2026-10-17T14:00:00.000Z"],
      [0, "2026-10-17T14:00:00.000Z", null],
    ]);
    expect(freeToCancelUntil(PLATFORM_TERMS_V1, CHECK_IN)?.toISOString()).toBe("2026-10-14T14:00:00.000Z");
  });

  it("reads a non-refundable policy as one window of nothing", () => {
    const terms = termsFromPolicyRules("p2", [{ refund_bps: 0, hours_before: 0 }])!;
    expect(isNonRefundable(terms)).toBe(true);
    expect(freeToCancelUntil(terms, CHECK_IN)).toBeNull();
    expect(termsWindows(terms, CHECK_IN)).toHaveLength(1);
  });

  it("reads the 48 hour policy from its rules", () => {
    const terms = termsFromPolicyRules("p1", [
      { refund_bps: 10000, hours_before: 48 },
      { refund_bps: 0, hours_before: 0 },
    ])!;
    expect(freeToCancelUntil(terms, CHECK_IN)?.toISOString()).toBe("2026-10-15T14:00:00.000Z");
    expect(termsWindows(terms, CHECK_IN)).toHaveLength(2);
  });
});

describe("frozen terms decide the refund", () => {
  const frozen = termsFromPolicyRules("p1", [{ refund_bps: 10000, hours_before: 48 }])!;
  const now = new Date("2026-10-14T20:00:00Z"); // inside 72h, outside 48h

  it("prices a guest's own cancellation by the terms it was paid under", () => {
    expect(refundForReasonUnderTerms("guest_choice", 1_000_000, CHECK_IN, frozen, now).refundMinor).toBe(1_000_000);
    expect(refundForReasonUnderTerms("guest_choice", 1_000_000, CHECK_IN, null, now).refundMinor).toBe(500_000);
  });

  it("never lets terms undercut the reasons that override to full", () => {
    const none = termsFromPolicyRules("p2", [{ refund_bps: 0, hours_before: 0 }])!;
    expect(refundForReasonUnderTerms("host_cancelled", 1_000_000, CHECK_IN, none, now).refundMinor).toBe(1_000_000);
  });

  it("refuses a malformed row rather than guessing", () => {
    expect(readCancellationTerms("platform_schedule_v1", { tiers: [{ closes_hours_before: -1, refund_bps: 1 }], check_in_hour: 15 })).toBeNull();
    expect(readCancellationTerms("", {})).toBeNull();
  });
});

describe("cancelStanding and freeCancellationOpen", () => {
  it("promises a free window only while it is ahead", () => {
    expect(cancelStanding(PLATFORM_TERMS_V1, CHECK_IN, new Date("2026-10-10T00:00:00Z")).kind).toBe("free");
    expect(cancelStanding(PLATFORM_TERMS_V1, CHECK_IN, new Date("2026-10-15T00:00:00Z"))).toEqual({ kind: "share", refundBps: 5_000 });
    expect(cancelStanding(PLATFORM_TERMS_V1, CHECK_IN, new Date("2026-10-18T00:00:00Z")).kind).toBe("none");
  });

  it("turns a closed 48-hour window into nothing back", () => {
    const terms = termsFromPolicyRules("p1", [{ refund_bps: 10000, hours_before: 48 }, { refund_bps: 0, hours_before: 0 }])!;
    expect(cancelStanding(terms, CHECK_IN, new Date("2026-10-16T00:00:00Z")).kind).toBe("none");
    expect(freeCancellationOpen(terms, CHECK_IN, new Date("2026-10-16T00:00:00Z"))).toBe(false);
    expect(freeCancellationOpen(terms, CHECK_IN, new Date("2026-10-10T00:00:00Z"))).toBe(true);
  });

  it("does not call a partial first tier refundable", () => {
    const half = termsFromPolicyRules("p3", [{ refund_bps: 5000, hours_before: 24 }])!;
    expect(freeCancellationOpen(half, null)).toBe(false);
  });
});

describe("boundedByRefundable", () => {
  const now = new Date("2026-10-13T10:00:00Z");

  /* The refund desk promises a host cancellation everything back. A goodwill
     part refund has already handed 30,000 kobo of the 100,000 back, so only
     70,000 is still refundable: the database refuses anything above that and
     the booking cannot be cancelled at all until the figure is bounded. */
  it("returns only what is still refundable after an earlier part refund", () => {
    const full = refundForReasonUnderTerms("host_cancelled", 100_000, CHECK_IN, null, now);
    expect(full.refundMinor).toBe(100_000);
    const bounded = boundedByRefundable(full, 100_000, 30_000);
    expect(bounded.refundMinor).toBe(70_000);
    /* Retained stays `paid - refund`, which is the column the database writes
       and the email prints. The 30,000 that went back earlier is its own row. */
    expect(bounded.retainedMinor).toBe(30_000);
  });

  it("leaves a refund inside the bound exactly as the schedule decided", () => {
    const half = refundForReasonUnderTerms("guest_choice", 100_000, CHECK_IN, null, new Date("2026-10-16T00:00:00Z"));
    expect(half.refundMinor).toBe(50_000);
    const bounded = boundedByRefundable(half, 100_000, 10_000);
    expect(bounded.refundMinor).toBe(50_000);
    expect(bounded.retainedMinor).toBe(50_000);
  });

  it("never goes below zero when everything has already gone back", () => {
    const full = refundForReasonUnderTerms("host_cancelled", 100_000, CHECK_IN, null, now);
    const bounded = boundedByRefundable(full, 100_000, 100_000);
    expect(bounded.refundMinor).toBe(0);
    expect(bounded.retainedMinor).toBe(100_000);
  });
});
