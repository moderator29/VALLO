import { describe, expect, it } from "vitest";

import { isNin } from "../nin";
import {
  ID_NUMBER_KINDS,
  ID_NUMBER_KIND_LABEL,
  ID_NUMBER_KIND_SHAPE,
  idNumberKindFor,
  idNumberShape,
  idNumberShapeFinding,
  isIdNumberKind,
  normaliseIdNumber,
} from "./formats";

describe("the shape of a typed ID number", () => {
  it("strips the separators people type and puts letters in capitals", () => {
    expect(normaliseIdNumber(" 1234 567-8901 ")).toBe("12345678901");
    expect(normaliseIdNumber("a 1234.5678")).toBe("A12345678");
    expect(normaliseIdNumber("90f5/b0e6")).toBe("90F5B0E6");
  });

  it("a NIN is 11 digits, by the same rule as lib/identity/nin.ts", () => {
    for (const sample of ["12345678901", "1234567890", "123456789012", "1234567890A", "", "00000000001"]) {
      const here = idNumberShape("nin", sample).shape === "right";
      expect(here, sample).toBe(isNin(sample));
    }
    expect(idNumberShape("nin", "1234 5678 901").shape).toBe("right");
    expect(idNumberShape("nin", "1234567890").reason).toBe("a NIN is 11 digits, and this has 10");
    expect(idNumberShape("nin", "1234567890A").reason).toContain("digits only");
  });

  it("calls one digit repeated eleven times unusual, the one place it is stricter than a pattern", () => {
    expect(idNumberShape("nin", "11111111111").shape).toBe("unusual");
    expect(idNumberShape("bvn", "00000000000").shape).toBe("unusual");
  });

  it("a BVN is 11 digits", () => {
    expect(idNumberShape("bvn", "22123456789").shape).toBe("right");
    expect(idNumberShape("bvn", "2212345678").shape).toBe("unusual");
    expect(idNumberShape("bvn", "2212345678X").shape).toBe("unusual");
  });

  it("a Nigerian passport number is one letter then eight digits", () => {
    expect(idNumberShape("passport", "A12345678").shape).toBe("right");
    expect(idNumberShape("passport", "b 0123 4567").shape).toBe("right");
    expect(idNumberShape("passport", "123456789").shape).toBe("unusual");
    expect(idNumberShape("passport", "AB1234567").shape).toBe("unusual");
    expect(idNumberShape("passport", "A1234567").reason).toBe("a Nigerian passport number is 9 characters, and this has 8");
  });

  it("is conservative about a driver's licence: length and kind of character only", () => {
    expect(idNumberShape("drivers_licence", "ABC12345AA12").shape).toBe("right");
    expect(idNumberShape("drivers_licence", "ABC-12345-AA-1").shape).toBe("right");
    expect(idNumberShape("drivers_licence", "123456789012").shape).toBe("unusual");
    expect(idNumberShape("drivers_licence", "ABCDEFGHIJKL").shape).toBe("unusual");
    expect(idNumberShape("drivers_licence", "ABC123").shape).toBe("unusual");
    expect(idNumberShape("drivers_licence", "ABC12345AA12345").shape).toBe("unusual");
    expect(idNumberShape("drivers_licence", "ABC12345*A12").shape).toBe("unusual");
  });

  it("is conservative about a voter's card: 19 letters and digits", () => {
    expect(idNumberShape("voters_card", "90F5 B0E6 0A29 5417 439").shape).toBe("right");
    expect(idNumberShape("voters_card", "90F5B0E60A29541743").shape).toBe("unusual");
    expect(idNumberShape("voters_card", "ABCDEFGHIJKLMNOPQRS").shape).toBe("unusual");
    expect(idNumberShape("voters_card", "90F5B0E60A2954174_9").shape).toBe("unusual");
  });

  it("says nothing was typed for an empty box, and gives no finding for it", () => {
    for (const kind of ID_NUMBER_KINDS) {
      expect(idNumberShape(kind, "  - ").shape).toBe("empty");
      expect(idNumberShapeFinding(kind, "")).toBeNull();
    }
  });

  it("never says valid, never repeats the number, and says a right shape proves nothing", () => {
    for (const kind of ID_NUMBER_KINDS) {
      const good = { nin: "12345678901", bvn: "22123456789", passport: "A12345678", drivers_licence: "ABC12345AA12", voters_card: "90F5B0E60A295417439" }[kind];
      const right = idNumberShapeFinding(kind, good)!;
      expect(right.level).toBe("ok");
      expect(right.title).toBe(`${ID_NUMBER_KIND_LABEL[kind]}: the shape looks right`);
      expect(right.detail).toContain("A right shape proves nothing");
      const wrong = idNumberShapeFinding(kind, "12")!;
      expect(wrong.level).toBe("look");
      expect(wrong.title).toBe(`${ID_NUMBER_KIND_LABEL[kind]}: the shape is unusual`);
      expect(wrong.detail).toContain(ID_NUMBER_KIND_SHAPE[kind]);
      for (const item of [right, wrong]) {
        expect(`${item.title} ${item.detail}`).not.toMatch(/\bvalid\b/i);
        expect(`${item.title} ${item.detail}`).not.toContain(good);
      }
    }
  });

  it("knows which number a Nigerian document carries, and claims no shape for another country's", () => {
    expect(idNumberKindFor("nin_card", "NG")).toBe("nin");
    expect(idNumberKindFor("passport", null)).toBe("passport");
    expect(idNumberKindFor("drivers_licence")).toBe("drivers_licence");
    expect(idNumberKindFor("voters_card", "ng")).toBe("voters_card");
    expect(idNumberKindFor("passport", "GH")).toBeNull();
    expect(idNumberKindFor("national_id", "GH")).toBeNull();
    expect(idNumberKindFor(null)).toBeNull();
    expect(isIdNumberKind("nin")).toBe(true);
    expect(isIdNumberKind("ssn")).toBe(false);
  });
});
