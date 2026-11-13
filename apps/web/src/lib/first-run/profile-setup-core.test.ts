import { describe, expect, it } from "vitest";
import * as core from "./profile-setup-core";
import { SKIP_QUIET_DAYS, readSkipCookie, setupDecision } from "./profile-setup-core";

const NOW = Date.parse("2026-11-10T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const base = { needPhoto: true, skippedAt: null, shownThisSession: false, now: NOW };

describe("setupDecision", () => {
  it("asks for a photo, and only a photo", () => {
    expect(setupDecision(base)).toEqual({ show: true, steps: ["photo"] });
  });
  it("shows nothing when the photo is set", () => {
    expect(setupDecision({ ...base, needPhoto: false })).toEqual({ show: false });
  });
  it("shows at most once per session", () => {
    expect(setupDecision({ ...base, shownThisSession: true })).toEqual({ show: false });
  });
  it("stays quiet for the quiet days after a skip, then asks again", () => {
    expect(setupDecision({ ...base, skippedAt: NOW - DAY })).toEqual({ show: false });
    expect(setupDecision({ ...base, skippedAt: NOW - (SKIP_QUIET_DAYS * DAY - 1) })).toEqual({ show: false });
    expect(setupDecision({ ...base, skippedAt: NOW - SKIP_QUIET_DAYS * DAY })).toEqual({ show: true, steps: ["photo"] });
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

/*
 * "CONFIRM YOUR INFORMATION" IS GONE (13 November 2026, the founder): the name
 * is given at sign-up on every path that makes an account. Nothing of the name
 * step is left to ask with.
 */
describe("the name step", () => {
  it("no longer exists: no name key, no splitter, no name step in any decision", () => {
    expect("NAME_CONFIRMED_FEATURE" in core).toBe(false);
    expect("splitFullName" in core).toBe(false);
    for (const skippedAt of [null, NOW - 10 * DAY]) {
      const decision = setupDecision({ ...base, skippedAt });
      expect(decision.show && decision.steps).toEqual(["photo"]);
    }
  });
});
