import { describe, expect, it } from "vitest";

import { NO_MEMORY, offerVerdict, rememberDecline, rememberSystemAsked, type PromptMemory } from "./moments";

/**
 * The rules for the one notifications screen (the founder, 13 November 2026):
 * shown once, at the end of first run, and a No is final on this device.
 */

const NOW = 1_800_000_000_000;
const YEAR = 365 * 24 * 60 * 60 * 1000;

describe("the one ask", () => {
  it("is shown on a device that has never been asked and is not registered", () => {
    expect(offerVerdict({ permission: "default", registered: false, memory: NO_MEMORY })).toEqual({ show: true });
  });

  it("is shown where the permission is already granted but this device is not registered, so a tap registers it and turns everything on", () => {
    /* Android 12 and below grant the permission at install; a browser may
       have allowed Vallo before. Skipping them left the device silent. */
    expect(offerVerdict({ permission: "granted", registered: false, memory: NO_MEMORY })).toEqual({ show: true });
  });

  it("is not shown where this device is granted and registered: there is nothing to turn on", () => {
    expect(offerVerdict({ permission: "granted", registered: true, memory: NO_MEMORY })).toEqual({
      show: false,
      because: "registered",
    });
  });

  it("is never shown over a refused permission or where push does not exist", () => {
    expect(offerVerdict({ permission: "denied", registered: false, memory: NO_MEMORY })).toEqual({
      show: false,
      because: "denied",
    });
    expect(offerVerdict({ permission: "unsupported", registered: false, memory: NO_MEMORY })).toEqual({
      show: false,
      because: "unsupported",
    });
  });
});

describe("a No is final (never asked again from inside the product)", () => {
  it("Not now once means never again on this device, however long after", () => {
    const memory = rememberDecline(NO_MEMORY, NOW);
    for (const permission of ["default", "granted"] as const) {
      expect(offerVerdict({ permission, registered: false, memory })).toEqual({ show: false, because: "answered" });
    }
    /* No clock in the rule: a decline from years ago is still a No. */
    const longAgo = rememberDecline(NO_MEMORY, NOW - 3 * YEAR);
    expect(offerVerdict({ permission: "default", registered: false, memory: longAgo }).show).toBe(false);
  });

  it("a device that reached the system prompt is never shown the screen again, whatever it answered", () => {
    const memory = rememberSystemAsked(NO_MEMORY);
    expect(offerVerdict({ permission: "default", registered: false, memory })).toEqual({
      show: false,
      because: "answered",
    });
    expect(offerVerdict({ permission: "granted", registered: false, memory })).toEqual({
      show: false,
      because: "answered",
    });
  });

  it("reads a decline stored by the old rules as a decline", () => {
    const old: PromptMemory = { declinedAt: NOW - 40 * 24 * 60 * 60 * 1000, declines: 1, systemAsked: false };
    expect(offerVerdict({ permission: "default", registered: false, memory: old }).show).toBe(false);
  });
});
