import { describe, expect, it } from "vitest";
import { parseInviteInput } from "./code";

describe("parseInviteInput", () => {
  it("takes a bare code in any case with spaces", () => {
    expect(parseInviteInput(" abc234 ")).toBe("ABC234");
  });
  it("takes an invite link with or without the host", () => {
    expect(parseInviteInput("https://vallo.ng/join/ABC234")).toBe("ABC234");
    expect(parseInviteInput("/join/abc234?utm=x")).toBe("ABC234");
    expect(parseInviteInput("vallo.ng/join/ABC234/")).toBe("ABC234");
  });
  it("takes a ref query parameter", () => {
    expect(parseInviteInput("https://vallo.ng/sign-up?ref=abc234&x=1")).toBe("ABC234");
  });
  it("refuses anything that is not a code", () => {
    for (const bad of ["", "   ", "ABC", "ABC10O", "https://vallo.ng/join/short", "hello world", null, undefined]) {
      expect(parseInviteInput(bad)).toBeNull();
    }
  });
});
