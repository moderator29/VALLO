import { describe, expect, it } from "vitest";
import { revenueSweepVerdict } from "./revenue-sweep";

describe("what the sweep run reports", () => {
  it("counts the money that moved, and nothing when none did", () => {
    expect(revenueSweepVerdict({ kind: "sent", amountMinor: 360_000, payoutId: "POT_1" })).toEqual({
      outcome: "ok",
      counts: { swept_minor: 360_000, sent: 1 },
      detail: { payout_id: "POT_1" },
      alert: null,
    });
    expect(revenueSweepVerdict({ kind: "held", hold: "below_floor" })).toEqual({
      outcome: "ok",
      counts: { swept_minor: 0, sent: 0 },
      detail: { reason: "below_floor" },
      alert: null,
    });
  });

  it("reads the ordinary quiet states as clean runs with their reason", () => {
    for (const hold of ["switched_off", "no_destination", "waiting_on_earlier_sweep"] as const) {
      expect(revenueSweepVerdict({ kind: "held", hold }).outcome, hold).toBe("ok");
      expect(revenueSweepVerdict({ kind: "held", hold }).alert, hold).toBeNull();
    }
    expect(revenueSweepVerdict({ kind: "not_set_up" })).toMatchObject({ outcome: "ok", detail: { reason: "not_set_up" } });
    expect(revenueSweepVerdict({ kind: "no_partner_key" })).toMatchObject({ outcome: "ok", detail: { reason: "no_partner_key" } });
  });

  it("asks for attention on the two holds a person should look at", () => {
    for (const hold of ["balance_unreadable", "too_large"] as const) {
      const verdict = revenueSweepVerdict({ kind: "held", hold });
      expect(verdict.outcome, hold).toBe("attention");
      expect(verdict.alert?.kind, hold).toBe("cron.revenue_sweep_held");
    }
  });

  it("treats a refusal as a warning and a lost answer as critical, because one of them may have moved money", () => {
    const refused = revenueSweepVerdict({ kind: "failed", amountMinor: 500_00, why: "insufficient_balance" });
    expect(refused.outcome).toBe("attention");
    expect(refused.alert).toMatchObject({ kind: "cron.revenue_sweep_failed", severity: "warning" });

    const lost = revenueSweepVerdict({ kind: "unknown", amountMinor: 500_00, why: "unknown" });
    expect(lost.outcome).toBe("attention");
    expect(lost.alert).toMatchObject({ kind: "cron.revenue_sweep_unknown", severity: "critical" });
  });

  it("is quiet about a payout still on its way, which the next run reads back", () => {
    expect(revenueSweepVerdict({ kind: "still_sending", amountMinor: 500_00 })).toMatchObject({ outcome: "ok", detail: { reason: "still_sending" }, alert: null });
  });

  it("never reports money as swept unless it was", () => {
    for (const outcome of [
      { kind: "failed" as const, amountMinor: 900, why: "x" },
      { kind: "unknown" as const, amountMinor: 900, why: "x" },
      { kind: "still_sending" as const, amountMinor: 900 },
      { kind: "held" as const, hold: "below_floor" as const },
    ]) {
      expect(revenueSweepVerdict(outcome).counts.swept_minor, outcome.kind).toBe(0);
    }
  });
});
