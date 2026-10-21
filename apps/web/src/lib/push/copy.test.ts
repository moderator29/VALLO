import { describe, expect, it } from "vitest";

import { clipPush, fitPush, lockScreenSafe, maskLongDigitRuns, PUSH_BODY_MAX, PUSH_TITLE_MAX } from "./copy";

describe("push copy is held to the lock screen", () => {
  it("leaves copy that fits exactly as written", () => {
    expect(fitPush({ title: "Payment received", body: "Tunde paid N360,000." })).toEqual({
      title: "Payment received",
      body: "Tunde paid N360,000.",
    });
  });

  it("cuts an overlong title and body at a word", () => {
    const out = fitPush({ title: "Your crypto payment did not go through today at all", body: "word ".repeat(60) });
    expect(out.title.length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
    expect(out.body.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
    expect(out.title.endsWith("…")).toBe(true);
    expect(out.body).not.toMatch(/wor…$/);
  });

  it("a missing body is an empty line, not 'null'", () => {
    expect(fitPush({ title: "Hi", body: null }).body).toBe("");
    expect(clipPush("  a  b ", 10)).toBe("a b");
  });
});

describe("a lock screen never shows an account or phone number in full", () => {
  it("masks a ten-digit account number and an eleven-digit phone, keeping the last two", () => {
    expect(maskLongDigitRuns("Pay into 0123456789 today")).toBe("Pay into ••••89 today");
    expect(maskLongDigitRuns("Call 0803 123 4567")).toBe("Call ••••67");
    expect(maskLongDigitRuns("+2348031234567")).toBe("+••••67");
  });

  it("leaves amounts, dates, references and short codes alone", () => {
    for (const line of ["Tunde paid N360,000.", "Your code is 482913", "On 17/10/2026 at 14:00", "VAL-2026-000123", "N1,250,000,000"]) {
      expect(maskLongDigitRuns(line), line).toBe(line);
    }
  });

  it("masks both lines and keeps a missing body missing", () => {
    expect(lockScreenSafe({ title: "From 08031234567", body: null })).toEqual({ title: "From ••••67", body: null });
  });
});
