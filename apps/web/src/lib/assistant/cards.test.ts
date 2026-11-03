import { describe, expect, it } from "vitest";
import { cardFor } from "./cards";

const item = { id: "l1", title: "Two bed", city: "Lagos", kind: "apartment", price: "N1", rating: 4, verified: true, href: "/listing/l1" };

describe("cardFor", () => {
  it("builds its buttons from the row: address, kinds and ids, never model text", () => {
    const card = cardFor(item, { viewings: true });
    expect(card.actions.map((a) => a.kind)).toEqual(["link", "photos", "slots", "save", "ask"]);
    expect(card.actions[0]).toMatchObject({ kind: "link", href: "/listing/l1" });
  });

  it("offers no viewing button without the permission, and no actions at all on an example", () => {
    expect(cardFor(item).actions.map((a) => a.kind)).not.toContain("slots");
    expect(cardFor(item, { example: true }).actions.map((a) => a.kind)).toEqual(["link", "ask"]);
  });

  it("carries the reason only when there is one, and shows Saved for a saved place", () => {
    expect(cardFor(item).reason).toBeUndefined();
    expect(cardFor(item, { reason: "You saved two flats in Lagos." }).reason).toMatch(/Lagos/);
    expect(cardFor(item, { saved: true }).actions.map((a) => a.kind)).toContain("unsave");
  });
});
