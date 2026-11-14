import { describe, expect, it } from "vitest";
import { maskNational } from "./phone";

/**
 * A PASTED PHONE NUMBER (founder, 14 November 2026, handoff 6.2 part 5: "a
 * pasted phone number loses its spaces, dashes and brackets"). Every arrival
 * in `PhoneField` goes through this mask, typing and paste alike, so these
 * pin the shapes people actually copy out of a chat, a contact card or a
 * listing. Nothing in the field had to change for a paste; this is the proof
 * that it already holds, and the guard that keeps it holding.
 */
describe("a pasted number loses its punctuation", () => {
  it("takes a number copied with spaces, dashes or brackets", () => {
    expect(maskNational("0803-123-4567")).toBe("803 123 4567");
    expect(maskNational("(0803) 123 4567")).toBe("803 123 4567");
    expect(maskNational("+234 803 123 4567")).toBe("803 123 4567");
    expect(maskNational("0803.123.4567")).toBe("803 123 4567");
  });

  it("drops the trunk zero and anything past the national length", () => {
    expect(maskNational("08031234567890")).toBe("803 123 4567");
  });
});
