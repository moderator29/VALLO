import { describe, expect, it } from "vitest";
import { signupPhoneOwed } from "./signup-gate";

const base = { createdAt: "2026-11-02T10:00:00Z", confirmed: false, flagOn: true, transportReady: true, qa: false };

describe("signupPhoneOwed", () => {
  it("is owed by a new account with no confirmed number while codes can arrive", () => {
    expect(signupPhoneOwed(base)).toBe(true);
  });

  it("is not owed by an account made before the rollout", () => {
    expect(signupPhoneOwed({ ...base, createdAt: "2026-10-01T10:00:00Z" })).toBe(false);
  });

  it("is never owed when no code can be sent, so nobody is locked out", () => {
    expect(signupPhoneOwed({ ...base, transportReady: false })).toBe(false);
    expect(signupPhoneOwed({ ...base, flagOn: false })).toBe(false);
  });

  it("is settled by a confirmed number and never asked of a tester", () => {
    expect(signupPhoneOwed({ ...base, confirmed: true })).toBe(false);
    expect(signupPhoneOwed({ ...base, qa: true })).toBe(false);
  });

  it("is not owed on an unreadable creation date", () => {
    expect(signupPhoneOwed({ ...base, createdAt: null })).toBe(false);
    expect(signupPhoneOwed({ ...base, createdAt: "nonsense" })).toBe(false);
  });
});
