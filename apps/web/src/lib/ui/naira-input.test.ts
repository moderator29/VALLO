import { describe, expect, it } from "vitest";
import { caretAfter, readNairaTyping, significantBefore } from "./naira-input";

describe("naira as it is typed", () => {
  it("groups the figure and keeps the plain value", () => {
    expect(readNairaTyping("1500000")).toEqual({ display: "1,500,000", value: "1500000" });
    expect(readNairaTyping("₦ 1,500,000")).toEqual({ display: "1,500,000", value: "1500000" });
    expect(readNairaTyping("")).toEqual({ display: "", value: "" });
  });

  it("drops leading zeros and stray letters", () => {
    expect(readNairaTyping("00450k")).toEqual({ display: "450", value: "450" });
  });

  it("drops a full stop and its tail when kobo is not taken", () => {
    expect(readNairaTyping("1500.00")).toEqual({ display: "1,500", value: "1500" });
  });

  it("keeps up to two kobo digits when asked", () => {
    expect(readNairaTyping("1500.5", true)).toEqual({ display: "1,500.5", value: "1500.5" });
    expect(readNairaTyping("1500.567", true)).toEqual({ display: "1,500.56", value: "1500.56" });
    expect(readNairaTyping(".5", true)).toEqual({ display: "0.5", value: "0.5" });
  });

  it("keeps the caret after the same digit when a comma appears", () => {
    /* "15000|" typed to "150000|": still at the end. */
    expect(caretAfter("150,000", significantBefore("150000", 6))).toBe(7);
    /* Caret after the "1" of "1|5000": stays after the "1". */
    expect(caretAfter("15,000", significantBefore("15000", 1))).toBe(1);
    expect(caretAfter("1,500", 0)).toBe(0);
  });
});

/**
 * A PASTED AMOUNT (founder, 14 November 2026, handoff 6.2 part 5: "a pasted
 * amount loses its currency sign and commas and lands in NairaField as a
 * number"). The field reads every arrival the same way, typing and paste
 * alike, so this pins the paste shapes people actually copy: a price from a
 * listing, a figure from a bank app, a total with kobo.
 */
describe("a pasted amount lands as a number", () => {
  it("drops the currency sign, the commas and the spaces", () => {
    expect(readNairaTyping("NGN 1,250,000").value).toBe("1250000");
    expect(readNairaTyping("₦1,250,000").value).toBe("1250000");
    expect(readNairaTyping("1 250 000").value).toBe("1250000");
    expect(readNairaTyping("₦1,250,000").display).toBe("1,250,000");
  });

  it("keeps kobo where the field allows it, and drops a stray point where it does not", () => {
    expect(readNairaTyping("₦1,250.50", true).value).toBe("1250.50");
    expect(readNairaTyping("₦1,250.50").value).toBe("1250");
  });

  it("leaves nothing behind when a paste holds no figure at all", () => {
    expect(readNairaTyping("about three million").value).toBe("");
  });
});
