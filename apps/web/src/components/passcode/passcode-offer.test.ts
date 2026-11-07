import { describe, expect, it } from "vitest";
import { passcodeOfferCookieString, passcodeOfferShows, PASSCODE_OFFER_SNOOZE_SECONDS } from "./passcode-offer";

describe("the passcode offer (P0.1, 6 November 2026)", () => {
  it("shows only to a signed-in member with no passcode who has not closed it", () => {
    expect(passcodeOfferShows({ gate: "unset", snoozed: false })).toBe(true);
    expect(passcodeOfferShows({ gate: "unset", snoozed: true })).toBe(false);
    for (const gate of ["open", "unlocked", "locked", "setup"]) {
      expect(passcodeOfferShows({ gate, snoozed: false })).toBe(false);
    }
  });

  it("remembers a Not now for 60 days, on the whole site", () => {
    expect(PASSCODE_OFFER_SNOOZE_SECONDS).toBe(5_184_000);
    const cookie = passcodeOfferCookieString(true);
    expect(cookie).toContain("vallo_pc_offer=1");
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("max-age=5184000");
    expect(cookie).toContain("secure");
    expect(passcodeOfferCookieString(false)).not.toContain("secure");
  });
});
