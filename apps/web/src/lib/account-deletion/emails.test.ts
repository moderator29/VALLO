import { describe, expect, it } from "vitest";
import { deletionCompleted, deletionStarted } from "./emails";
import { hashRestoreCode, looksLikeRestoreCode, newRestoreCode } from "./restore-code";
import { daysLeft } from "./constants";

/**
 * The two emails and the code they carry.
 *
 * What is pinned: both renderings exist and say the same things; the first one
 * carries the date and the code, because a banned account has no other way
 * back; neither carries an em dash, which rule 1 forbids everywhere; neither
 * carries a telephone number, an address or anything else rule 16 forbids; and
 * the restore code survives a person retyping it in the wrong case and without
 * the dash.
 */

const STARTED = deletionStarted({
  name: "Ada",
  purgeAfter: "2026-10-19T09:00:00.000Z",
  restoreCode: "K4M9P-2XQ7R",
});

const COMPLETED = deletionCompleted({ name: "Ada" });

describe("the two emails", () => {
  it("render twice from one description", () => {
    for (const email of [STARTED, COMPLETED]) {
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html).toContain("<!doctype html>");
      expect(email.text.length).toBeGreaterThan(0);
    }
  });

  it("puts the date and the code in the first one, where the way back is", () => {
    expect(STARTED.text).toContain("K4M9P-2XQ7R");
    expect(STARTED.subject).toContain("19 Oct 2026");
    expect(STARTED.text.toLowerCase()).toContain("change your mind");
  });

  it("says what is kept and why in both, so the retention is never a surprise", () => {
    for (const email of [STARTED, COMPLETED]) {
      expect(email.text.toLowerCase()).toContain("anti-money-laundering");
    }
  });

  it("carries no em dash anywhere", () => {
    // Built rather than typed, so that enforcing rule 1 does not itself put an
    // em dash into the repository.
    const emDash = String.fromCharCode(8212);
    for (const email of [STARTED, COMPLETED]) {
      expect(email.subject).not.toContain(emDash);
      expect(email.text).not.toContain(emDash);
      expect(email.html).not.toContain(emDash);
    }
  });

  it("greets by first name and carries no other personal detail", () => {
    expect(STARTED.text).toContain("Ada");
    for (const email of [STARTED, COMPLETED]) {
      expect(email.text).not.toMatch(/\+?234\d{6,}/);
      expect(email.text.replace(/https?:\/\/\S+/g, "")).not.toMatch(/\b\d{10,}\b/);
    }
  });

  it("does not produce a bare greeting when there is no name", () => {
    const anonymous = deletionCompleted({ name: null });
    expect(anonymous.text).not.toContain("Hello ,");
  });
});

describe("the restore code", () => {
  it("is ten readable characters in two groups", () => {
    const code = newRestoreCode();
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    expect(looksLikeRestoreCode(code)).toBe(true);
  });

  it("uses no character a reader confuses with a digit", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(newRestoreCode()).not.toMatch(/[01ILOU]/);
    }
  });

  it("forgives the case and the dash, because a person retypes it from an email", () => {
    const canonical = hashRestoreCode("K4M9P-2XQ7R");
    expect(hashRestoreCode("k4m9p2xq7r")).toBe(canonical);
    expect(hashRestoreCode(" K4M9P 2XQ7R ")).toBe(canonical);
  });

  it("stores a hash and never the code", () => {
    const hash = hashRestoreCode("K4M9P-2XQ7R");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("K4M9P");
  });

  it("refuses something that is not a code before the database is asked", () => {
    expect(looksLikeRestoreCode("")).toBe(false);
    expect(looksLikeRestoreCode("short")).toBe(false);
    expect(looksLikeRestoreCode("waytoolongforacode")).toBe(false);
  });
});

describe("the countdown", () => {
  const NOW = Date.parse("2026-09-19T12:00:00.000Z");

  it("counts whole days left", () => {
    expect(daysLeft("2026-10-19T12:00:00.000Z", NOW)).toBe(30);
    expect(daysLeft("2026-09-20T12:00:00.000Z", NOW)).toBe(1);
  });

  it("never goes negative once the clock has run out", () => {
    expect(daysLeft("2026-09-01T12:00:00.000Z", NOW)).toBe(0);
  });

  it("reads a malformed date as no days left rather than NaN on a screen", () => {
    expect(daysLeft("not a date", NOW)).toBe(0);
  });
});
