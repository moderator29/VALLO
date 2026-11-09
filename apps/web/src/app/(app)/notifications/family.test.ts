import { describe, expect, it } from "vitest";
import { FAMILY_ORDER, familyOf, figureIn, glyphOf, groupByObject, objectKeyOf, objectOf } from "./family";
import { familyOf as pushFamilyOf } from "@/lib/push/family";

/*
 * The titles below are the ones database triggers really write
 * (supabase/migrations: the tenancy, split-rent and caution notices, and the
 * severity table's own patterns), so the rules are held to real sentences.
 */
describe("familyOf", () => {
  const cases: [string, { kind: string; title: string; href: string | null }, string][] = [
    ["a message", { kind: "message", title: "New message from Tunde", href: "/messages/abc" }, "messages"],
    ["a wallet row", { kind: "wallet", title: "Wallet funded", href: "/wallet" }, "money"],
    ["a support reply", { kind: "support", title: "Support replied", href: "/support/messages/x" }, "messages"],
    ["a caution due back", { kind: "booking", title: "Your caution is due back today", href: "/tenancy/t1" }, "money"],
    ["rent renewing", { kind: "booking", title: "Your rent renews in 12 days", href: "/tenancy/t1" }, "money"],
    ["a share that fell through", { kind: "booking", title: "The move-in you paid a share of fell through", href: "/rent/share/s1" }, "money"],
    ["a tenancy ending", { kind: "booking", title: "A tenancy ends in 30 days", href: "/tenancy/t1" }, "bookings"],
    ["an inspection", { kind: "booking", title: "Inspection confirmed for Saturday", href: "/inspections" }, "bookings"],
    ["a mandate running out", { kind: "agent", title: "Your mandate is running out", href: "/agent/mandates" }, "activity"],
    ["a listing submitted", { kind: "listing", title: "Your listing is verified", href: "/agent" }, "activity"],
    ["a new sign-in", { kind: "system", title: "New sign-in to your account", href: "/settings/devices/alert/d1" }, "activity"],
    ["a follow", { kind: "social", title: "Chioma started following you", href: "/u/chioma" }, "activity"],
    ["a badge earned", { kind: "social", title: "You earned a badge", href: null }, "activity"],
    ["verification approved", { kind: "system", title: "Your verification is approved", href: "/verification" }, "activity"],
    ["an unknown system notice", { kind: "system", title: "Something changed", href: null }, "activity"],
    ["an unknown booking notice", { kind: "booking", title: "Something changed", href: null }, "bookings"],
  ];
  cases.push(
    ["a price drop on a saved place", { kind: "listing", title: "A place you saved dropped its price", href: "/listing/l1" }, "offers"],
    ["a booking request", { kind: "booking", title: "New booking request", href: "/bookings/b1" }, "bookings"],
  );
  it.each(cases)("%s", (_name, facts, family) => {
    expect(familyOf(facts)).toBe(family);
  });
});

describe("figureIn", () => {
  it("reads the one naira figure the words state, in kobo", () => {
    expect(figureIn("Rent of ₦1,200,000 is due on 14 October")).toBe(120_000_000);
    expect(figureIn("Refund", "₦42,000.75 is on its way")).toBe(4_200_075);
    expect(figureIn("NGN 185,000 per night")).toBe(18_500_000);
  });
  it("counts one amount stated twice as one amount", () => {
    expect(figureIn("₦5,000 received", "You received ₦5,000")).toBe(500_000);
  });
  it("refuses to choose between two different amounts", () => {
    expect(figureIn("Rent ₦1,200,000 and caution ₦200,000")).toBeNull();
  });
  it("is null when there is no figure, and never reads a bare number", () => {
    expect(figureIn("Your rent renews in 12 days")).toBeNull();
    expect(figureIn(null, undefined)).toBeNull();
  });
});

describe("objectOf and grouping", () => {
  it("names the record a link points at", () => {
    expect(objectOf("/bookings/b1")).toBe("booking");
    expect(objectOf("/messages/abc")).toBe("conversation");
    expect(objectOf("/settings/devices")).toBe("setting");
    expect(objectOf(null)).toBe("page");
    expect(objectOf("/somewhere-new")).toBe("page");
  });
  it("calls a rent payment a payment, and never a wallet (D48)", () => {
    expect(objectOf("/rent/pay/i1")).toBe("payment");
    expect(objectOf("/rent/move-in/l1")).toBe("payment");
    expect(objectOf("/rent")).toBe("payment");
    /* `/wallet` only redirects now; an old row pointing at it is a payment. */
    expect(objectOf("/wallet")).toBe("payment");
    expect(objectOf("/wallet/transactions")).toBe("payment");
    expect(objectOf("/rentals")).toBe("page");
  });
  const id = "5d6f1f0e-1c2b-4f6a-9d7e-0a1b2c3d4e5f";
  it("only treats an id-shaped link as one record", () => {
    expect(objectKeyOf(`/bookings/${id}?tab=1`)).toBe(`/bookings/${id}`);
    expect(objectKeyOf("/settings")).toBeNull();
    expect(objectKeyOf("/wallet")).toBeNull();
    expect(objectKeyOf(null)).toBeNull();
  });
  it("folds events on one record and leaves general pages as their own rows", () => {
    const rows = [
      { id: "1", href: `/bookings/${id}` },
      { id: "2", href: "/wallet" },
      { id: "3", href: `/bookings/${id}` },
      { id: "4", href: "/wallet" },
    ];
    const groups = groupByObject(rows);
    expect(groups.map((g) => g.rows.map((r) => r.id))).toEqual([["1", "3"], ["2"], ["4"]]);
    expect(groups[0]!.lead.id).toBe("1");
  });
});

describe("calls are not messages", () => {
  it("recognises a ring and a missed call by their trigger titles", async () => {
    const { isCallRow, glyphOf, groupByObject } = await import("./family");
    expect(isCallRow({ title: "Incoming video call" })).toBe(true);
    expect(isCallRow({ title: "Missed voice call from Ada" })).toBe(true);
    expect(isCallRow({ title: "New message" })).toBe(false);
    expect(glyphOf({ kind: "message", title: "Incoming video call", href: "/messages/x" })).toBe("phone");
    expect(glyphOf({ kind: "message", title: "New message", href: "/messages/x" })).toBe("chat-bubble");
    const id = "11111111-1111-4111-8111-111111111111";
    const href = `/messages/${id}`;
    const groups = groupByObject([
      { id: "a", href, title: "Missed voice call from Ada" },
      { id: "b", href, title: "New message" },
      { id: "c", href, title: "New message" },
    ]);
    expect(groups.map((g) => g.rows.length)).toEqual([1, 2]);
  });
});

describe("the families are the lock screen's", () => {
  it("names the same families as the push header line", () => {
    const pushFamilies = new Set(
      (["message", "booking", "wallet", "social"] as const).map((kind) => pushFamilyOf({ kind }).family),
    );
    for (const family of pushFamilies) expect(FAMILY_ORDER).toContain(family);
    expect(pushFamilyOf({ kind: "social", priceDrop: true }).family).toBe("offers");
    expect(FAMILY_ORDER).toContain("offers");
  });
  it("never draws a chat bubble on something nobody wrote", () => {
    expect(glyphOf({ kind: "social", title: "Chioma started following you", href: "/u/chioma" })).toBe("user-check");
    expect(glyphOf({ kind: "system", title: "New sign-in to your staff account", href: "/settings/devices/alert/d1" })).toBe("shield-lock");
    expect(glyphOf({ kind: "system", title: "Your verification is approved", href: "/verification" })).toBe("verified");
    expect(glyphOf({ kind: "message", title: "Missed voice call from Ada", href: "/messages/x" })).toBe("phone-missed");
  });
});
