import { describe, expect, it } from "vitest";
import { decideSweep, holdNeedsAPerson, SWEEP_CEILING_MINOR, SWEEP_FLOOR_MINOR, sweepReason, type SweepReading } from "./revenue-sweep";

const ready: SweepReading = { availableMinor: SWEEP_FLOOR_MINOR, unsettled: false, destinationSet: true, switchedOn: true };

describe("whether Vallo's own earnings move to the bank", () => {
  it("moves the whole available balance once it is worth a transfer", () => {
    expect(decideSweep(ready)).toEqual({ move: true, amountMinor: SWEEP_FLOOR_MINOR });
    expect(decideSweep({ ...ready, availableMinor: 2_500_000_00 })).toEqual({ move: true, amountMinor: 2_500_000_00 });
  });

  it("waits below the floor, where the partner's flat fee would eat the transfer", () => {
    expect(decideSweep({ ...ready, availableMinor: SWEEP_FLOOR_MINOR - 1 })).toEqual({ move: false, hold: "below_floor" });
    expect(decideSweep({ ...ready, availableMinor: 0 })).toEqual({ move: false, hold: "below_floor" });
  });

  it("moves nothing until the founder switches it on and names the destination", () => {
    expect(decideSweep({ ...ready, switchedOn: false })).toEqual({ move: false, hold: "switched_off" });
    expect(decideSweep({ ...ready, destinationSet: false })).toEqual({ move: false, hold: "no_destination" });
    /* Switched off is answered before anything else, so a deployment with the
       sweep off never reads a balance and never needs a destination. */
    expect(decideSweep({ availableMinor: null, unsettled: true, destinationSet: false, switchedOn: false })).toEqual({ move: false, hold: "switched_off" });
  });

  it("sends nothing while an earlier sweep is still open, so one balance is never sent twice", () => {
    expect(decideSweep({ ...ready, unsettled: true })).toEqual({ move: false, hold: "waiting_on_earlier_sweep" });
  });

  it("refuses a balance it could not read plainly, rather than moving a guess", () => {
    for (const bad of [null, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      expect(decideSweep({ ...ready, availableMinor: bad as number | null }), String(bad)).toEqual({ move: false, hold: "balance_unreadable" });
    }
  });

  it("stops and asks a person when the balance is far larger than Vallo's share could be", () => {
    expect(decideSweep({ ...ready, availableMinor: SWEEP_CEILING_MINOR })).toEqual({ move: true, amountMinor: SWEEP_CEILING_MINOR });
    expect(decideSweep({ ...ready, availableMinor: SWEEP_CEILING_MINOR + 1 })).toEqual({ move: false, hold: "too_large" });
  });

  it("tells the job which holds are quiet and which want somebody", () => {
    expect(holdNeedsAPerson("balance_unreadable")).toBe(true);
    expect(holdNeedsAPerson("too_large")).toBe(true);
    for (const quiet of ["switched_off", "no_destination", "below_floor", "waiting_on_earlier_sweep"] as const) {
      expect(holdNeedsAPerson(quiet), quiet).toBe(false);
    }
  });

  it("says on the payout whose money this is", () => {
    expect(sweepReason()).toContain("Vallo");
    expect(sweepReason().length).toBeLessThanOrEqual(500);
  });
});
