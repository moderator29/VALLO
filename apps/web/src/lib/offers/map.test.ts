import { describe, expect, it, vi } from "vitest";

vi.mock("../listings/supabase-repository", () => ({ photoUrl: (p: string) => `https://img.test/${p}` }));

import { changesBetween, countsOf, dealRoomOf, differenceOf, eligibilityOf, nextActionOf, offerRow, priceBlockOf, stateOf } from "./map";

describe("offer mapping", () => {
  it("maps database statuses to what a person reads, and agreed is never sold", () => {
    expect(stateOf("approved")).toBe("agreed");
    expect(stateOf("rejected")).toBe("declined");
    expect(stateOf("awaiting_parties")).toBe("open");
    expect(stateOf("paid")).toBe("open"); // unreachable for a sale; never mapped to anything money-like
  });

  it("shows the difference as an amount and a percentage", () => {
    expect(differenceOf(7_800_000_000, 8_500_000_000)).toEqual({ differenceMinor: -700_000_000, differencePct: -8.2 });
    expect(differenceOf(8_500_000_000, 8_500_000_000).differencePct).toBe(0);
  });

  it("states the honest price: asking only, no invented costs, no total", () => {
    const p = priceBlockOf(8_500_000_000);
    expect(p.costs).toEqual([]);
    expect(p.totalIsComplete).toBe(false);
    expect(p.totalMinor).toBeNull();
  });

  it("puts the Fix button on the id row only, never on age, and none when met", () => {
    const e = eligibilityOf({ eligible: false, requirements: [{ key: "government_id", state: "required" }, { key: "minimum_age", state: "required" }] });
    expect(e.requirements.find((r) => r.key === "government_id")?.fixHref).toBe("/verification");
    expect(e.requirements.find((r) => r.key === "minimum_age")?.fixHref).toBeNull();
    expect(eligibilityOf({ eligible: true, requirements: [{ key: "government_id", state: "met" }] }).requirements[0]?.fixHref).toBeNull();
  });

  it("lists what changed between versions", () => {
    const fmt = (m: number) => `N${m / 100}`;
    const v1 = { version: 1, amountMinor: 7_800_000_000, terms: { paymentPreference: "mortgage" as const, proposedBy: "buyer" as const, atAskingPrice: false }, proposedBy: "buyer" as const, at: "", changes: [], buyerConfirmed: true, sellerConfirmed: false };
    const next = { amountMinor: 8_300_000_000, terms: { paymentPreference: "cash" as const, proposedBy: "seller" as const, atAskingPrice: false } };
    const out = changesBetween(v1, next, fmt);
    expect(out[0]).toContain("up");
    expect(out.join(" ")).toContain("cash");
    expect(changesBetween(null, next, fmt)).toEqual([]);
  });

  it("builds a room whose history is in order and whose waiting side is clear", () => {
    const room = dealRoomOf({
      status: "ok",
      viewer_side: "seller",
      offer: { id: "o1", reference: "VO-AAAA1111", listing_id: "l1", listing_title: "House", asking_minor: 100, amount_minor: 90, status: "awaiting_parties", stage: "negotiating", awaiting_side: "seller", version: 2, thumb: "p.jpg", counterparty_name: "Tunde" },
      versions: [
        { version: 1, amount_minor: 80, terms: { payment_preference: "cash", proposed_by: "buyer" }, at: "a", buyer_confirmed: true, seller_confirmed: false },
        { version: 2, amount_minor: 90, terms: { payment_preference: "cash", proposed_by: "buyer" }, at: "b", buyer_confirmed: true, seller_confirmed: false },
      ],
      events: [], documents: [], mandate: { held: false }, buyer_eligible: true,
    });
    expect(room.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(room.offer.turn).toBe("seller");
    expect(room.offer.listingThumb).toBe("https://img.test/p.jpg");
    expect(room.next?.kind).toBe("respond");
  });

  it("never lets a next-action sentence promise a sale", () => {
    const row = offerRow({ id: "o", listing_id: "l", asking_minor: 1, amount_minor: 1, status: "approved", stage: "agreed", viewer_side: "buyer" });
    const next = nextActionOf(row, []);
    expect(next?.detail).toMatch(/not a sale/i);
  });

  it("counts honestly: awaiting you is the viewer's own turn only", () => {
    const mine = offerRow({ id: "1", listing_id: "l", asking_minor: 1, amount_minor: 1, status: "awaiting_parties", awaiting_side: "seller", viewer_side: "seller" });
    const theirs = offerRow({ id: "2", listing_id: "l", asking_minor: 1, amount_minor: 1, status: "awaiting_parties", awaiting_side: "buyer", viewer_side: "seller" });
    const c = countsOf([mine, theirs]);
    expect(c.awaiting_you).toBe(1);
    expect(c.open).toBe(2);
  });
});
