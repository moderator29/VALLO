import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";

import { EMPTY_LIFESTYLE } from "@/lib/features/roommates/model";

import { availableText, budgetText, counted, dayText, fill, lagosDay, lifestyleFacts, monthlyHint, moveInText, placeText } from "./format";
import { STATE_OPTIONS, stateName } from "./states";

const t = getDictionary("en").roommates;

describe("the roommates kit's words and figures", () => {
  it("fills placeholders and leaves unknown ones as written", () => {
    expect(fill("{n}% match", { n: 86 })).toBe("86% match");
    expect(fill("Hi {name}", {})).toBe("Hi {name}");
  });

  it("counts through the plural rules, never by hand", () => {
    expect(counted(1, t.ui.card.bedrooms)).toBe("1 bedroom");
    expect(counted(3, t.ui.card.bedrooms)).toBe("3 bedrooms");
  });

  it("says a budget only from the bounds that were given", () => {
    expect(budgetText({ minMinor: null, maxMinor: null, period: "year" }, t)).toBeNull();
    expect(budgetText({ minMinor: null, maxMinor: 50_000_000, period: "year" }, t)).toMatch(/^Up to .+\/year$/);
    expect(budgetText({ minMinor: 30_000_000, maxMinor: 50_000_000, period: "month" }, t)).toMatch(/ to .+\/month$/);
    expect(budgetText({ minMinor: 30_000_000, maxMinor: null, period: "year" }, t)).toMatch(/^From /);
  });

  it("gives the monthly figure under a yearly amount only", () => {
    expect(monthlyHint(120_000_00, "month", t)).toBeNull();
    expect(monthlyHint(1_200_000_00, "year", t)).toMatch(/a month$/);
    expect(monthlyHint(null, "year", t)).toBeNull();
  });

  it("reads a calendar day at noon, so no zone moves it", () => {
    expect(dayText("2027-01-12")).toMatch(/12 Jan 2027/);
    expect(dayText("2027-01-12", false)).not.toMatch(/2027/);
    expect(dayText("not a day")).toBe("not a day");
  });

  it("words the move-in by how flexible it is", () => {
    expect(moveInText(null, "asap", t)).toBe(t.ui.card.moveInAsap);
    expect(moveInText(null, "flexible", t)).toBe(t.ui.card.moveInFlexible);
    expect(moveInText("2027-02-01", "fixed", t)).toMatch(/^Move-in /);
  });

  it("joins a place without repeating a part", () => {
    expect(placeText("Yaba", "Lagos", "Lagos")).toBe("Yaba, Lagos");
    expect(placeText(null, "  ", undefined)).toBeNull();
  });

  it("only says available now once the day has come", () => {
    expect(availableText(null, t, "2026-11-08")).toBeNull();
    expect(availableText("2026-11-01", t, "2026-11-08")).toBe(t.ui.card.availableNow);
    expect(availableText("2026-12-01", t, "2026-11-08")).toMatch(/^From /);
  });

  it("puts the telling lifestyle answers first and skips the blank ones", () => {
    expect(lifestyleFacts(EMPTY_LIFESTYLE, t)).toEqual([]);
    const facts = lifestyleFacts({ ...EMPTY_LIFESTYLE, cooking: "often", smoking: "never", cleanliness: 3 }, t);
    expect(facts.map((f) => f.key)).toEqual(["smoking", "cleanliness", "cooking"]);
    expect(facts[0]!.value).toBe("Non-smoker");
  });

  it("reads today in Lagos as a calendar day", () => {
    expect(lagosDay(Date.UTC(2026, 10, 8, 23, 30))).toBe("2026-11-09");
  });

  it("names all 36 states and the FCT once each", () => {
    expect(STATE_OPTIONS).toHaveLength(37);
    expect(new Set(STATE_OPTIONS.map((s) => s.code)).size).toBe(37);
    expect(stateName("la")).toBe("Lagos");
    expect(stateName("XX")).toBeNull();
  });
});
