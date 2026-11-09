import { getDictionary } from "@vallo/i18n";
import { describe, expect, it } from "vitest";
import { unbackedClaim } from "@/lib/trust/claims";
import { AGREEMENT_PAYMENT_OPENS, NO_INSPECTION_FEE, PAYMENT_GATE_SENTENCE } from "@/lib/money/copy";
import { landingDoor } from "./doors";

/*
 * THE HERO'S SHORT LINES MEAN WHAT THE CONSTANTS MEAN (UIUX item 7).
 *
 * The fact row and the eyebrow capsule say the money constants in a few
 * words, and a few words drift. So each short line is pinned to the
 * sentence it shortens: if `NO_INSPECTION_FEE` ever stops saying there is no
 * inspection fee, or the payment gate stops being about the agreement, the
 * short line fails here before the landing says something the product no
 * longer does. None may carry a figure or an unbacked claim.
 */
const t = getDictionary("en");
const hero = t.landing.face.hero;

describe("the hero's facts", () => {
  it("say the inspection constant", () => {
    expect(NO_INSPECTION_FEE.toLowerCase()).toContain("no inspection fee");
    expect(hero.facts.inspect.toLowerCase()).toContain("no inspection fee");
    expect(hero.eyebrow.toLowerCase()).toContain("no inspection fee");
  });

  it("say the move-in total the listing card prints", () => {
    const find = t.landingRooms.journey.steps.find((s) => s.key === "find");
    expect(find && "body" in find ? find.body : "").toContain("move-in total");
    expect(hero.facts.moveIn.toLowerCase()).toContain("move-in total");
  });

  /* D68d: payment opens when both parties confirm; the rail decides whether a
     person looks first. Still never before the agreement. 9 November 2026:
     payment for rentals is not open and Vallo takes none for a purchase, so
     the rental gate says so, and the stay's gate keeps the agreement rule. */
  it("say the payment gate: pay only after the agreement", () => {
    expect(PAYMENT_GATE_SENTENCE.toLowerCase()).toMatch(/payment for rentals is not open on vallo yet\. you can view, inspect and agree terms now/);
    expect(AGREEMENT_PAYMENT_OPENS.toLowerCase()).toMatch(/as soon as .*both of you confirm the agreement/);
    expect(hero.facts.agree.toLowerCase()).toMatch(/only once you both agree/);
  });

  it("carry no figure and no unbacked claim", () => {
    for (const line of [hero.eyebrow, ...Object.values(hero.facts), hero.joinLine]) {
      expect(line).not.toMatch(/\d/);
      expect(unbackedClaim(line)).toBeNull();
    }
  });
});

describe("the landing's doors", () => {
  it("send a stranger to sign up, carrying the place, while the catalogue is closed", () => {
    const door = landingDoor(false);
    expect(door("/search")).toBe("/sign-up?next=%2Fsearch");
    expect(door("/search?type=land")).toBe("/sign-up?next=%2Fsearch%3Ftype%3Dland");
    expect(door("/stays")).toBe("/sign-up?next=%2Fstays");
    /* A page a stranger can already open is left alone. */
    expect(door("/safety")).toBe("/safety");
  });

  it("go straight to the catalogue once the founder opens it, and never open an account page", () => {
    const door = landingDoor(true);
    expect(door("/search")).toBe("/search");
    expect(door("/stays/search?type=hotel")).toBe("/stays/search?type=hotel");
    expect(door("/messages")).toBe("/sign-up?next=%2Fmessages");
    expect(door("/assistant")).toBe("/sign-up?next=%2Fassistant");
  });
});
