import { describe, expect, it } from "vitest";
import { PHOTO_STEP_PATH, photoStepHref, photoStepOnward } from "./photo-step";

/** The photo step's address and where it goes afterwards: a same-site path only, never itself. */
describe("the photo step at the end of sign-up", () => {
  it("carries where the person was going", () => {
    expect(photoStepHref("/listing/abc?from=share")).toBe(`${PHOTO_STEP_PATH}?next=${encodeURIComponent("/listing/abc?from=share")}`);
    expect(photoStepHref("/home")).toBe(`${PHOTO_STEP_PATH}?next=%2Fhome`);
  });
  it("never carries another site, or itself", () => {
    expect(photoStepHref("//evil.example")).toBe(PHOTO_STEP_PATH);
    expect(photoStepHref("https://evil.example/x")).toBe(PHOTO_STEP_PATH);
    expect(photoStepHref(PHOTO_STEP_PATH)).toBe(PHOTO_STEP_PATH);
    expect(photoStepHref(`${PHOTO_STEP_PATH}?next=%2Fhome`)).toBe(PHOTO_STEP_PATH);
    expect(photoStepHref(null)).toBe(PHOTO_STEP_PATH);
  });
  it("goes on to a safe next, or home", () => {
    expect(photoStepOnward("/listing/abc")).toBe("/listing/abc");
    expect(photoStepOnward(undefined)).toBe("/home");
    expect(photoStepOnward("//evil.example")).toBe("/home");
    expect(photoStepOnward(PHOTO_STEP_PATH)).toBe("/home");
    expect(photoStepOnward(["/a", "/b"])).toBe("/home");
  });
});
