import { describe, expect, it } from "vitest";
import { inListingFolder } from "./media-path";

const UID = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
const LISTING = "3b0f1b0e-6f5a-4d1e-9b77-1c2d3e4f5a6b";
const OTHER = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

describe("a listing's media path", () => {
  it("accepts the one shape the wizard writes", () => {
    expect(inListingFolder(`${UID}/${LISTING}/a1b2.jpg`, UID, LISTING)).toBe(true);
  });

  it("refuses traversal, empty and dot segments", () => {
    for (const path of [
      `${UID}/../${OTHER}/x.jpg`,
      `${UID}/${LISTING}/..`,
      `${UID}/${LISTING}/.`,
      `${UID}/${LISTING}/`,
      `${UID}//${LISTING}/x.jpg`,
      `${UID}/${LISTING}/x/../y.jpg`,
    ]) {
      expect(inListingFolder(path, UID, LISTING)).toBe(false);
    }
  });

  it("refuses somebody else's folder and another of the caller's listings", () => {
    expect(inListingFolder(`${OTHER}/${LISTING}/x.jpg`, UID, LISTING)).toBe(false);
    expect(inListingFolder(`${UID}/${OTHER}/x.jpg`, UID, LISTING)).toBe(false);
  });

  it("refuses a backslash, a control character and a path out of bounds", () => {
    expect(inListingFolder(`${UID}/${LISTING}/x\\y.jpg`, UID, LISTING)).toBe(false);
    expect(inListingFolder(`${UID}/${LISTING}/x\u0000.jpg`, UID, LISTING)).toBe(false);
    expect(inListingFolder(`${UID}/${LISTING}/${"a".repeat(400)}`, UID, LISTING)).toBe(false);
    expect(inListingFolder("a/b", UID, LISTING)).toBe(false);
  });
});
