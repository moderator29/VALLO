import { describe, expect, it } from "vitest";
import { openFailureKind } from "./funds";

describe("openFailureKind", () => {
  it("reads a phone already on another provider account as phone_taken", () => {
    expect(openFailureKind("The phone number is already registered to your own merchant account (merchant_super_admin)")).toBe("phone_taken");
    expect(openFailureKind("Phone number already exists")).toBe("phone_taken");
  });
  it("reads anything else as a details refusal", () => {
    expect(openFailureKind("Invalid email address")).toBe("details");
    expect(openFailureKind(null)).toBe("details");
    expect(openFailureKind("")).toBe("details");
  });
});
