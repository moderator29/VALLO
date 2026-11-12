import { beforeEach, describe, expect, it, vi } from "vitest";

const sweep = vi.hoisted(() => vi.fn());

vi.mock("../../payouts/referral-payout", () => ({ sweepRewardsPayouts: sweep }));

import { rewardsPayouts } from "./rewards-payouts";

/**
 * The payout sweep's verdict. The point of the job is the third thing it does:
 * `rewards_payouts_stuck` is read by nothing else on this platform, and before
 * 12 November its answer was handed to `console.error`. A printed line in a
 * serverless function is not an alert, and the only place anybody would see it
 * is a log nobody opens for a job that was never scheduled. So the references
 * come back from the sweep and this job turns them into one critical alert
 * that names each of them.
 */
describe("the rewards payout sweep's verdict", () => {
  beforeEach(() => {
    sweep.mockReset();
  });

  it("reads ok with nothing stuck, and names what it did", async () => {
    sweep.mockResolvedValue({ sent: 2, checked: 3, stuck: [] });
    const verdict = await rewardsPayouts();
    expect(verdict.outcome).toBe("ok");
    expect(verdict.counts).toEqual({ sent: 2, checked: 3, stuck: 0 });
    expect(verdict.alert).toBeNull();
  });

  it("reads ok while payouts are switched off, because nothing to do is not attention", async () => {
    sweep.mockResolvedValue({ sent: 0, checked: 0, stuck: [] });
    const verdict = await rewardsPayouts();
    expect(verdict.outcome).toBe("ok");
    expect(verdict.alert).toBeNull();
  });

  it("raises one critical alert naming every payout in flight for over a day", async () => {
    sweep.mockResolvedValue({ sent: 0, checked: 1, stuck: ["vallo-rw-aaa:sent", "vallo-rw-bbb:unknown"] });
    const verdict = await rewardsPayouts();
    expect(verdict.outcome).toBe("attention");
    expect(verdict.counts.stuck).toBe(2);
    expect(verdict.alert).toEqual({
      kind: "rewards_payout.stuck",
      severity: "critical",
      detail: { stuck_count: 2, stuck_1: "vallo-rw-aaa:sent", stuck_2: "vallo-rw-bbb:unknown" },
    });
  });

  it("carries at most twenty references, and still counts them all", async () => {
    const stuck = Array.from({ length: 25 }, (_, i) => `vallo-rw-${i}:sent`);
    sweep.mockResolvedValue({ sent: 0, checked: 0, stuck });
    const verdict = await rewardsPayouts();
    expect(verdict.alert?.detail.stuck_count).toBe(25);
    expect(verdict.alert?.detail.stuck_20).toBe("vallo-rw-19:sent");
    expect(verdict.alert?.detail.stuck_21).toBeUndefined();
  });
});
