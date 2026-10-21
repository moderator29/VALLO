import { describe, expect, it } from "vitest";
import {
  blockersFrom,
  canProceed,
  readingFrom,
  EMPTY_READING,
  type BlockerReading,
} from "./preconditions";

/**
 * The preconditions, and the rule that every one of them has a way out.
 *
 * What is pinned: a clean account proceeds; each of the seven blockers fires
 * on its own number and on nothing else; every blocker carries a route; money is
 * ordered before diary entries because a balance is the one that costs
 * somebody something; a negative balance does not hold a deletion hostage; and
 * a malformed answer from the database reads as zero rather than throwing on a
 * settings screen.
 */

function reading(patch: Partial<BlockerReading> = {}): BlockerReading {
  return { ...EMPTY_READING, ...patch };
}

describe("the preconditions", () => {
  it("lets a clean account through", () => {
    expect(blockersFrom(reading())).toEqual([]);
    expect(canProceed(reading())).toBe(true);
  });

  it("names each blocker on its own number and nothing else", () => {
    const cases: [Partial<BlockerReading>, string][] = [
      [{ rentRefundsOwedMinor: 1 }, "rent-refunds-owed"],
      [{ rentRefundsDueMinor: 120_000_00 }, "rent-refunds-due"],
      [{ activeBookings: 2 }, "active-bookings"],
      [{ activeReservations: 1 }, "active-reservations"],
      [{ publishedListings: 3 }, "published-listings"],
      [{ ownedBusinesses: 1 }, "owned-businesses"],
      [{ partnerHeldMinor: 250_000_00 }, "partner-held"],
      [{ rewardsWithdrawableMinor: 5_000_00 }, "rewards-balance"],
      [{ rewardsPayoutsInFlight: 1 }, "rewards-payouts"],
    ];
    for (const [patch, kind] of cases) {
      const blockers = blockersFrom(reading(patch));
      expect(blockers.map((blocker) => blocker.kind)).toEqual([kind]);
      expect(canProceed(reading(patch))).toBe(false);
    }
  });

  it("gives every blocker a route out, and never a dead end", () => {
    const all = blockersFrom(
      reading({
        rentRefundsOwedMinor: 500_00,
        rentRefundsDueMinor: 1_200_000_00,
        activeBookings: 1,
        activeReservations: 1,
        publishedListings: 1,
        ownedBusinesses: 1,
        partnerHeldMinor: 1,
        rewardsWithdrawableMinor: 1,
        rewardsPayoutsInFlight: 1,
      }),
    );
    expect(all).toHaveLength(9);
    for (const blocker of all) {
      expect(blocker.href.startsWith("/")).toBe(true);
      expect(blocker.href.length).toBeGreaterThan(1);
    }
  });

  it("puts the money blockers first, because money owed is the costly one to get wrong", () => {
    const all = blockersFrom(
      reading({ rentRefundsOwedMinor: 100, activeBookings: 1, publishedListings: 1 }),
    );
    expect(all[0]?.kind).toBe("rent-refunds-owed");
  });

  it("never blocks on a wallet, a held payment, a pot or a withdrawal: Vallo holds no money", () => {
    const patch = { walletBalanceMinor: 500_00, walletHeldMinor: 1_00, potBalanceMinor: 1_00, pendingPayouts: 3 };
    expect(blockersFrom(reading(patch))).toEqual([]);
    expect(canProceed(reading(patch))).toBe(true);
  });

  it("carries the kobo untouched, so nothing here can turn money into a float", () => {
    const blocker = blockersFrom(reading({ rentRefundsOwedMinor: 1_234_567 }))[0];
    expect(blocker?.amount).toBe(1_234_567);
    expect(Number.isInteger(blocker?.amount)).toBe(true);
  });

  it("does not hold a deletion hostage to a negative balance", () => {
    expect(blockersFrom(reading({ walletBalanceMinor: -5_000 }))).toEqual([]);
    expect(canProceed(reading({ walletBalanceMinor: -5_000 }))).toBe(true);
  });

  it("puts money a partner holds before every other blocker, and routes it to the agreement", () => {
    const all = blockersFrom(reading({ rentRefundsOwedMinor: 100, activeBookings: 1, partnerHeldMinor: 9_000_00 }));
    expect(all[0]).toEqual({ kind: "partner-held", href: "/agreements", amount: 9_000_00 });
  });

  it("routes the rewards blockers to the rewards screen, where Withdraw lives", () => {
    const all = blockersFrom(reading({ rewardsWithdrawableMinor: 2_000_00, rewardsPayoutsInFlight: 2 }));
    expect(all.map((blocker) => [blocker.kind, blocker.href])).toEqual([
      ["rewards-balance", "/rewards"],
      ["rewards-payouts", "/rewards"],
    ]);
  });

  it("sends the business blocker to a surface that carries both doors", () => {
    const [blocker] = blockersFrom(reading({ ownedBusinesses: 2 }));
    expect(blocker?.href).toBe("/host/transfer");
    expect(blocker?.amount).toBe(2);
  });

  it("puts the business last, because its route out needs another person to agree", () => {
    const all = blockersFrom(
      reading({ ownedBusinesses: 1, publishedListings: 1, rentRefundsOwedMinor: 100 }),
    );
    expect(all[all.length - 1]?.kind).toBe("owned-businesses");
  });
});

describe("reading the database's answer", () => {
  it("takes the thirteen numbers", () => {
    expect(
      readingFrom({
        blocked: true,
        wallet_balance_minor: 250_00,
        wallet_held_minor: 0,
        pot_balance_minor: 5_000,
        rent_refunds_owed_minor: 0,
        rent_refunds_due_minor: 7_500,
        active_bookings: 2,
        active_reservations: 0,
        pending_payouts: 1,
        published_listings: 4,
        owned_businesses: 2,
        partner_held_minor: "150000000",
        rewards_withdrawable_minor: 500_000,
        rewards_payouts_in_flight: 1,
      }),
    ).toEqual({
      walletBalanceMinor: 25_000,
      walletHeldMinor: 0,
      potBalanceMinor: 5_000,
      rentRefundsOwedMinor: 0,
      rentRefundsDueMinor: 7_500,
      activeBookings: 2,
      activeReservations: 0,
      pendingPayouts: 1,
      publishedListings: 4,
      ownedBusinesses: 2,
      partnerHeldMinor: 150_000_000,
      rewardsWithdrawableMinor: 500_000,
      rewardsPayoutsInFlight: 1,
    });
  });

  it("reads a bigint that arrived as a string, which PostgREST does for large kobo", () => {
    expect(readingFrom({ wallet_balance_minor: "9007199254740" }).walletBalanceMinor).toBe(
      9_007_199_254_740,
    );
  });

  it("reads anything malformed as zero rather than throwing on a settings screen", () => {
    expect(readingFrom(null)).toEqual(EMPTY_READING);
    expect(readingFrom("no")).toEqual(EMPTY_READING);
    expect(readingFrom([1, 2])).toEqual(EMPTY_READING);
    expect(readingFrom({ wallet_balance_minor: {} })).toEqual(EMPTY_READING);
  });
});

describe("MON-09 / STORE-12: a rent refund in either direction blocks deletion", () => {
  it("names both directions of rent refund, and never a pot", async () => {
    const { blockersFrom } = await import("./preconditions");
    const kinds = blockersFrom({
      ...EMPTY_READING,
      potBalanceMinor: 1,
      rentRefundsOwedMinor: 1,
      rentRefundsDueMinor: 1,
    }).map((b) => b.kind);
    expect(kinds).toEqual(["rent-refunds-owed", "rent-refunds-due"]);
  });
});
