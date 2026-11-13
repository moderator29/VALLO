import { describe, expect, it } from "vitest";

import { mergeSettings, parseSettings } from "./schema";

/**
 * SAVING ONE SETTING MUST NOT ERASE ANOTHER (13 November 2026).
 *
 * `mergeSettings` used to rebuild `profiles.settings` from the parsed
 * document alone, and the parse strips every key its schema does not name.
 * These pin the repair: the keys other modules keep in the same document
 * survive any save through here, and a malformed value under a KNOWN key is
 * still repaired rather than carried back in.
 */

const stored = {
  whatsappDoorbell: true,
  display: { currency: "GBP", areaUnit: "sqft" },
  locale: "yo",
  notifications: { bookings: false, wallet: false, payments: false, someLaterKey: "kept" },
  privacy: { showHomeTown: true, laterPrivacyKey: 3 },
};

describe("mergeSettings keeps what it does not know", () => {
  it("keeps whatsappDoorbell and display.currency when an unrelated setting is saved", () => {
    const merged = mergeSettings(stored, { interestsAsked: true }) as unknown as Record<string, unknown>;
    expect(merged.whatsappDoorbell).toBe(true);
    expect(merged.display).toEqual({ currency: "GBP", areaUnit: "sqft" });
    expect(merged.interestsAsked).toBe(true);
  });

  it("keeps them through a notification toggle, the AI consent and a language change too", () => {
    const patches = [
      { notifications: { marketing: false } },
      { aiConsent: { version: "v1", at: "2026-11-13T10:00:00.000Z" } },
      { locale: "en" as const },
      { notifications: { channels: { bookings: { push: false } } } },
    ];
    for (const patch of patches) {
      const merged = mergeSettings(stored, patch) as unknown as Record<string, unknown>;
      expect(merged.whatsappDoorbell, JSON.stringify(patch)).toBe(true);
      expect(merged.display, JSON.stringify(patch)).toEqual({ currency: "GBP", areaUnit: "sqft" });
    }
  });

  it("keeps unknown keys inside notifications and privacy, payments among them", () => {
    const merged = mergeSettings(stored, { notifications: { messages: false } }) as unknown as {
      notifications: Record<string, unknown>;
      privacy: Record<string, unknown>;
    };
    expect(merged.notifications.payments).toBe(false);
    expect(merged.notifications.someLaterKey).toBe("kept");
    expect(merged.notifications.bookings).toBe(false);
    expect(merged.notifications.messages).toBe(false);
    expect(merged.privacy.laterPrivacyKey).toBe(3);
    expect(merged.privacy.showHomeTown).toBe(true);
  });

  it("survives a round trip through several saves", () => {
    let doc: unknown = stored;
    doc = mergeSettings(doc, { welcomeSeen: true });
    doc = mergeSettings(doc, { dataSaver: true });
    doc = mergeSettings(doc, { privacy: { hideActivity: true } });
    const out = doc as Record<string, unknown>;
    expect(out.whatsappDoorbell).toBe(true);
    expect(out.display).toEqual({ currency: "GBP", areaUnit: "sqft" });
  });

  it("still lets a patch change a known key and still repairs a malformed known value", () => {
    const merged = mergeSettings(
      { locale: "not-a-language", notifications: { channels: "garbage", quiet_hours: 7 }, privacy: { hideActivity: "yes" } },
      { dataSaver: true },
    ) as unknown as { locale: string; notifications: Record<string, unknown>; privacy: Record<string, unknown> };
    expect(merged.locale).toBe(parseSettings({}).locale);
    expect(merged.notifications.channels).toBeUndefined();
    expect(merged.notifications.quiet_hours).toBeUndefined();
    expect(merged.privacy.hideActivity).toBe(parseSettings({}).privacy.hideActivity);
  });

  it("treats a stored document that is not an object as empty", () => {
    for (const raw of [null, undefined, "x", 4, [1, 2]]) {
      const merged = mergeSettings(raw, { welcomeSeen: true }) as unknown as Record<string, unknown>;
      expect(Object.keys(merged).sort()).toEqual(Object.keys(parseSettings({})).sort());
    }
  });
});
