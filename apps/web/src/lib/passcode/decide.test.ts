import { describe, expect, it } from "vitest";
import { decideGate, moneyAllowed, parseStatus, parseVerify, type GateFacts } from "./decide";

/**
 * The gate's decisions (docs/PASSCODE.md). The line that matters most: no
 * failure ever falls through to the page. An unreadable passcode is the lock
 * with a password fallback, and only a valid unlock or a fresh full sign-in
 * gets past it.
 */
const SET = { state: "set" as const, length: 6 as const, failedCount: 0, lockedUntil: null };
const base: GateFacts = {
  signedIn: true,
  status: SET,
  unlockCookieValid: false,
  freshUnlock: false,
  freshReset: false,
  resetIntent: false,
};

describe("decideGate", () => {
  it("never locks a signed-out visitor (the open catalogue, the public site)", () => {
    expect(decideGate({ ...base, signedIn: false })).toEqual({ kind: "open" });
  });

  it("lets a member with no passcode straight in: the passcode is optional (6 November 2026)", () => {
    expect(decideGate({ ...base, status: { state: "unset" } })).toEqual({ kind: "unset" });
    expect(decideGate({ ...base, status: { state: "unset" }, unlockCookieValid: true })).toEqual({ kind: "unset" });
  });

  it("locks a set passcode with no unlock", () => {
    expect(decideGate(base)).toEqual({ kind: "locked", mode: "code", length: 6, failedCount: 0, lockedUntil: null });
  });

  it("lets a valid unlock through, and asks a fresh sign-in to mint one", () => {
    expect(decideGate({ ...base, unlockCookieValid: true })).toEqual({ kind: "unlocked", mint: false, length: 6 });
    expect(decideGate({ ...base, freshUnlock: true })).toEqual({ kind: "unlocked", mint: true, length: 6 });
  });

  it("carries the cooldown and the length to the lock screen", () => {
    const status = { state: "set" as const, length: 4 as const, failedCount: 5, lockedUntil: "2026-09-29T10:00:30Z" };
    expect(decideGate({ ...base, status })).toEqual({ kind: "locked", mode: "code", length: 4, failedCount: 5, lockedUntil: "2026-09-29T10:00:30Z" });
  });

  it("after ten wrong tries, offers only a full sign-in, then a new code", () => {
    const status = { state: "reset_required" as const, length: 6 as const, failedCount: 10, lockedUntil: null };
    expect(decideGate({ ...base, status, unlockCookieValid: true })).toMatchObject({ kind: "locked", mode: "password-only" });
    expect(decideGate({ ...base, status, freshUnlock: true, freshReset: true })).toEqual({ kind: "setup", mode: "reset" });
  });

  it("after 'Use your password instead' and a fresh sign-in, offers a new code", () => {
    expect(decideGate({ ...base, resetIntent: true, freshReset: true, freshUnlock: true })).toEqual({ kind: "setup", mode: "reset" });
    expect(decideGate({ ...base, resetIntent: true })).toMatchObject({ kind: "locked", mode: "code" });
  });

  it("FAILS TO THE PASSWORD, NEVER TO THE PAGE, when the passcode cannot be read", () => {
    expect(decideGate({ ...base, status: { state: "error" } })).toMatchObject({ kind: "locked", mode: "unavailable" });
    expect(decideGate({ ...base, status: { state: "error" }, resetIntent: true })).toMatchObject({ kind: "locked" });
    /* The fallback is the password: a full sign-in moments ago lets the member in. */
    expect(decideGate({ ...base, status: { state: "error" }, freshUnlock: true })).toEqual({ kind: "unlocked", mint: true, length: 6 });
  });
});

describe("moneyAllowed", () => {
  it("allows money only when unlocked, or before any passcode exists", () => {
    expect(moneyAllowed({ kind: "unlocked", mint: false, length: 6 })).toBe(true);
    expect(moneyAllowed({ kind: "setup", mode: "first" })).toBe(true);
    expect(moneyAllowed({ kind: "unset" })).toBe(true);
    expect(moneyAllowed({ kind: "setup", mode: "reset" })).toBe(false);
    expect(moneyAllowed({ kind: "locked", mode: "code", length: 6, failedCount: 0, lockedUntil: null })).toBe(false);
    expect(moneyAllowed({ kind: "locked", mode: "unavailable", length: 6, failedCount: 0, lockedUntil: null })).toBe(false);
    expect(moneyAllowed({ kind: "open" })).toBe(false);
  });
});

describe("reading the database's answers", () => {
  it("reads a status, and treats anything odd as an error rather than unset", () => {
    expect(parseStatus({ state: "unset" })).toEqual({ state: "unset" });
    expect(parseStatus({ state: "set", length: 4, failed_count: 2, locked_until: null })).toEqual({ state: "set", length: 4, failedCount: 2, lockedUntil: null });
    expect(parseStatus({ state: "set", length: 5 })).toEqual({ state: "error" });
    expect(parseStatus({ state: "nope" })).toEqual({ state: "error" });
    expect(parseStatus(null)).toEqual({ state: "error" });
    expect(parseStatus({ state: "set", length: 6, hash: "$2a$10$x" })).not.toHaveProperty("hash");
  });

  it("reads a verify answer", () => {
    expect(parseVerify({ status: "ok", length: 6 })).toEqual({ status: "ok" });
    expect(parseVerify({ status: "wrong", failed_count: 3 })).toEqual({ status: "wrong", failedCount: 3 });
    expect(parseVerify({ status: "cooldown", retry_after_seconds: 30, failed_count: 5 })).toEqual({ status: "cooldown", retryAfterSeconds: 30, failedCount: 5 });
    expect(parseVerify({ status: "reset_required" })).toEqual({ status: "reset_required" });
    expect(parseVerify({ status: "weird" })).toEqual({ status: "error" });
    expect(parseVerify(undefined)).toEqual({ status: "error" });
  });
});
