import { describe, expect, it } from "vitest";

import { cleanKindFor, cleanPasted, spliceText } from "./field-paste";

describe("which fields clean a paste", () => {
  it("a phone field, by its type, its keyboard or its autocomplete", () => {
    expect(cleanKindFor({ type: "tel" })).toBe("tel");
    expect(cleanKindFor({ type: "text", inputMode: "tel" })).toBe("tel");
    expect(cleanKindFor({ autoComplete: "tel-national" })).toBe("tel");
  });

  it("an email field, the same three ways", () => {
    expect(cleanKindFor({ type: "email" })).toBe("email");
    expect(cleanKindFor({ inputMode: "email" })).toBe("email");
    expect(cleanKindFor({ autoComplete: "email" })).toBe("email");
  });

  it("nothing else: a name, a search or a message is pasted as it is", () => {
    expect(cleanKindFor({ type: "text" })).toBeNull();
    expect(cleanKindFor({ type: "search", autoComplete: "off" })).toBeNull();
    expect(cleanKindFor({})).toBeNull();
  });
});

describe("what lands in the field", () => {
  it("is the cleaned paste", () => {
    expect(cleanPasted("tel", "+234 (803) 123-4567")).toBe("+2348031234567");
    expect(cleanPasted("email", " Seyi <Seyi@Example.com> ")).toBe("seyi@example.com");
  });

  it("replaces the selection and keeps what was either side of it", () => {
    expect(spliceText("0803", "1234567", 4, 4)).toBe("08031234567");
    expect(spliceText("0000000", "0803", 0, 7)).toBe("0803");
    /* No selection to read (an email field): it goes at the end. */
    expect(spliceText("", "a@b.co", null, null)).toBe("a@b.co");
  });
});
