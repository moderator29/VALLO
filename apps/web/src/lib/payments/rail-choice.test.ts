import { describe, expect, it } from "vitest";
import { CHOICE_REFUSALS, payChoiceView, payNextHref, readChoiceRefusal, readPayChoice } from "./rail-choice";
import { RENT_PAYMENT_OPEN } from "../rent/payment-open";
import { getDictionary } from "@vallo/i18n";

/*
 * Founder ruling 2 (13 October 2026), as the payment step reads the
 * database's answer (`public.payment_rail_options`, pov04, applied 13 October 2026):
 *   rent, shortlet  escrow and card, escrow preselected
 *   sale            escrow only
 *   hotel room      card only
 *   restaurant      card only
 * The rail itself is decided in the database and pinned by the probes in
 * supabase/tests/probes/pov03 and pov04; this pins the reading.
 */

const answer = (over: Record<string, unknown> = {}) => ({
  status: "ok",
  options: ["escrow", "card"],
  default: "escrow",
  chosen: null,
  rail: "escrow",
  payer: true,
  locked: null,
  ...over,
});

describe("reading the database's options, fail closed", () => {
  it("reads a rent or shortlet answer: both rails, escrow first and by default", () => {
    expect(readPayChoice(answer())).toEqual({
      options: ["escrow", "card"],
      defaultRail: "escrow",
      chosen: null,
      rail: "escrow",
      payer: true,
      locked: null,
    });
  });

  it("puts escrow first whatever order the database sends", () => {
    expect(readPayChoice(answer({ options: ["card", "escrow"] }))?.options).toEqual(["escrow", "card"]);
  });

  it("reads a refusal, an unknown status or a broken shape as no choice", () => {
    expect(readPayChoice({ status: "not_found" })).toBeNull();
    expect(readPayChoice(null)).toBeNull();
    expect(readPayChoice({ status: "ok", options: "escrow" })).toBeNull();
  });

  it("drops a rail it does not know", () => {
    expect(readPayChoice(answer({ options: ["escrow", "wallet"] }))?.options).toEqual(["escrow"]);
    expect(readPayChoice(answer({ chosen: "wallet" }))?.chosen).toBeNull();
  });
});

describe("what the payment step draws, for every kind of deal", () => {
  it("rent and shortlet: a choice, Escrow preselected", () => {
    expect(payChoiceView(readPayChoice(answer()))).toEqual({ mode: "choose", selected: "escrow", canChoose: true });
  });

  it("the payer's card choice is what is preselected next time", () => {
    expect(payChoiceView(readPayChoice(answer({ chosen: "card", rail: "card" })))).toMatchObject({ selected: "card" });
  });

  it("a sale is escrow only, said and not asked", () => {
    const view = payChoiceView(readPayChoice(answer({ options: ["escrow"], default: "escrow" })));
    expect(view).toEqual({ mode: "escrow_only", selected: "escrow", canChoose: false });
  });

  it("a hotel room is card only, and so is a restaurant", () => {
    const view = payChoiceView(readPayChoice(answer({ options: ["card"], default: "card", rail: "card" })));
    expect(view).toEqual({ mode: "card_only", selected: "card", canChoose: false });
  });

  it("no rail draws nothing", () => {
    expect(payChoiceView(readPayChoice(answer({ options: [], default: null, rail: null })))).toMatchObject({ mode: "none" });
    expect(payChoiceView(null)).toMatchObject({ mode: "none" });
  });

  it("the lister sees the choice but cannot make it, and nobody can once payment has started", () => {
    expect(payChoiceView(readPayChoice(answer({ payer: false })))).toMatchObject({ canChoose: false });
    expect(payChoiceView(readPayChoice(answer({ locked: "payment_started" })))).toMatchObject({ canChoose: false });
  });
});

describe("escrow appears only when the server reads it as working (protectedRailLive)", () => {
  it("open: nothing changes", () => {
    expect(readPayChoice(answer(), true)?.escrowPaused).toBeUndefined();
    expect(payChoiceView(readPayChoice(answer(), true))).toMatchObject({ mode: "choose" });
  });

  it("paused on a rent or shortlet: card is offered instead, and stored when the payer continues", () => {
    const choice = readPayChoice(answer(), false);
    expect(choice).toMatchObject({ options: ["card"], defaultRail: "card", escrowPaused: true });
    expect(payChoiceView(choice)).toEqual({ mode: "card_escrow_paused", selected: "card", canChoose: true });
  });

  it("paused, card already stored: the payer goes straight to the card checkout", () => {
    expect(payChoiceView(readPayChoice(answer({ chosen: "card", rail: "card" }), false))).toMatchObject({
      mode: "card_escrow_paused",
      canChoose: false,
    });
  });

  it("paused on a purchase: nothing can be paid, said plainly, no button", () => {
    const view = payChoiceView(readPayChoice(answer({ options: ["escrow"] }), false));
    expect(view).toEqual({ mode: "escrow_paused", selected: null, canChoose: false });
  });

  it("paused never touches a hotel room (card only)", () => {
    const choice = readPayChoice(answer({ options: ["card"], default: "card", rail: "card" }), false);
    expect(choice?.escrowPaused).toBeUndefined();
    expect(payChoiceView(choice)).toMatchObject({ mode: "card_only" });
  });
});

describe("payment for rentals is not open (9 November 2026, RENT_PAYMENT_OPEN)", () => {
  it("is off today", () => {
    expect(RENT_PAYMENT_OPEN).toBe(false);
  });

  it("a rental draws the fact and offers no rail, with the protected rail on or off", () => {
    const off = { mode: "rent_not_open", selected: null, canChoose: false };
    expect(payChoiceView(readPayChoice(answer(), false), "rent")).toEqual(off);
    expect(payChoiceView(readPayChoice(answer(), true), "rent")).toEqual(off);
    expect(payChoiceView(readPayChoice(answer({ chosen: "card", rail: "card" }), false), "rent")).toEqual(off);
  });

  it("a stay is untouched: card while the protected rail is off", () => {
    expect(payChoiceView(readPayChoice(answer(), false), "stay")).toMatchObject({ mode: "card_escrow_paused" });
  });

  it("opening it is the only thing that brings the rental choice back", () => {
    expect(payChoiceView(readPayChoice(answer(), true), "rent", true)).toMatchObject({ mode: "choose" });
  });

  it("no choice read still draws nothing", () => {
    expect(payChoiceView(null, "rent")).toMatchObject({ mode: "none" });
  });
});

describe("where each rail goes next", () => {
  const ag = { id: "ag-1", kind: "stay", bookingId: "bk-1", inspectionId: null };
  it("escrow goes to the escrow step", () => {
    expect(payNextHref("escrow", ag)).toBe("/agreements/ag-1/fund");
  });
  it("card goes to the stay's checkout, or the rent payment screen for a rental", () => {
    expect(payNextHref("card", ag)).toBe("/checkout/bk-1");
    expect(payNextHref("card", { ...ag, kind: "rent", inspectionId: "in-1" })).toBe("/rent/pay/in-1");
    expect(payNextHref("card", { ...ag, bookingId: null })).toBeNull();
  });
});

describe("every refusal the database can give has a sentence in every language", () => {
  it("maps unknown statuses to unavailable", () => {
    expect(readChoiceRefusal("sale_escrow_only")).toBe("sale_escrow_only");
    expect(readChoiceRefusal("something_new")).toBe("unavailable");
  });
  it("has a non-empty sentence for each code in en, yo, ig and ha", () => {
    for (const locale of ["en", "yo", "ig", "ha"] as const) {
      const refused = getDictionary(locale).payChoice.refused as Record<string, string>;
      for (const code of CHOICE_REFUSALS) expect(refused[code]?.length ?? 0).toBeGreaterThan(5);
    }
  });
  it("Yoruba, Igbo and Hausa are translated, not English", () => {
    const en = getDictionary("en").payChoice;
    for (const locale of ["yo", "ig", "ha"] as const) {
      const t = getDictionary(locale).payChoice;
      expect(t.title).not.toBe(en.title);
      expect(t.escrow).not.toBe(en.escrow);
      expect(t.card).not.toBe(en.card);
      expect(t.accept.payInside).not.toBe(en.accept.payInside);
      expect(t.refused.card_needs_review).not.toBe(en.refused.card_needs_review);
    }
  });
});
