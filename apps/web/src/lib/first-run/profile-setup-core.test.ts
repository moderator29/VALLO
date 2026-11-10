import { describe, expect, it } from "vitest";
import { SKIP_QUIET_DAYS, readSkipCookie, setupDecision, splitFullName } from "./profile-setup-core";

const NOW = Date.parse("2026-11-10T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const base = { needName: true, needPhoto: true, skippedAt: null, shownThisSession: false, now: NOW };

describe("setupDecision", () => {
  it("asks for the name first, then the photo", () => {
    expect(setupDecision(base)).toEqual({ show: true, steps: ["name", "photo"] });
  });
  it("asks only for what is missing", () => {
    expect(setupDecision({ ...base, needName: false })).toEqual({ show: true, steps: ["photo"] });
    expect(setupDecision({ ...base, needPhoto: false })).toEqual({ show: true, steps: ["name"] });
  });
  it("shows nothing when the name is confirmed and the photo is set", () => {
    expect(setupDecision({ ...base, needName: false, needPhoto: false })).toEqual({ show: false });
  });
  it("shows at most once per session", () => {
    expect(setupDecision({ ...base, shownThisSession: true })).toEqual({ show: false });
  });
  it("stays quiet for the quiet days after a skip, then asks again", () => {
    expect(setupDecision({ ...base, skippedAt: NOW - DAY })).toEqual({ show: false });
    expect(setupDecision({ ...base, skippedAt: NOW - (SKIP_QUIET_DAYS * DAY - 1) })).toEqual({ show: false });
    expect(setupDecision({ ...base, skippedAt: NOW - SKIP_QUIET_DAYS * DAY })).toEqual({ show: true, steps: ["name", "photo"] });
  });
  it("treats a skip dated in the future as just now", () => {
    expect(setupDecision({ ...base, skippedAt: NOW + 5 * DAY })).toEqual({ show: false });
  });
});

describe("readSkipCookie", () => {
  it("reads epoch milliseconds only", () => {
    expect(readSkipCookie("1789000000000")).toBe(1789000000000);
    expect(readSkipCookie("yesterday")).toBeNull();
    expect(readSkipCookie(undefined)).toBeNull();
  });
});

describe("splitFullName", () => {
  it("splits the first word from the surname", () => {
    expect(splitFullName("  Ada   Grace Okafor ")).toEqual({ firstName: "Ada", surname: "Grace Okafor" });
  });
  it("needs two names to match an ID", () => {
    expect(splitFullName("PHANTOM")).toBeNull();
    expect(splitFullName("   ")).toBeNull();
  });
});
