import { describe, expect, it } from "vitest";

import {
  androidNeedsPrompt,
  MAX_DECLINES,
  NO_MEMORY,
  offerVerdict,
  RE_ASK_AFTER_DAYS,
  rememberDecline,
  type PromptMemory,
} from "./moments";

/**
 * The rules that decide whether this product ever gets to notify anybody.
 *
 * The expensive mistakes are all in one direction: asking when the answer can
 * only be no, and asking again after somebody has already said no twice. Both
 * spend something that cannot be got back.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("never spend the system prompt", () => {
  it("does not offer when the permission is already granted", () => {
    const verdict = offerVerdict({
      moment: "listing_published",
      permission: "granted",
      memory: NO_MEMORY,
      now: NOW,
    });
    expect(verdict).toEqual({ show: false, because: "granted" });
  });

  it("does not offer once the system prompt has been spent on a no", () => {
    /* THE IMPORTANT ONE. After `denied` there is nowhere for a Yes to go:
       the system will not ask again and the page cannot make it. Offering
       here produces a person who agreed and got nothing. */
    const verdict = offerVerdict({
      moment: "conversation_active",
      permission: "denied",
      memory: NO_MEMORY,
      now: NOW,
    });
    expect(verdict).toEqual({ show: false, because: "denied" });
  });

  it("does not offer where push does not exist", () => {
    const verdict = offerVerdict({
      moment: "booking_requested",
      permission: "unsupported",
      memory: NO_MEMORY,
      now: NOW,
    });
    expect(verdict).toEqual({ show: false, because: "unsupported" });
  });
});

describe("asking at a moment of success", () => {
  it("offers at each of the four moments, in the words for that moment", () => {
    const moments = ["listing_published", "booking_requested", "conversation_active", "settings_opened", "joined"] as const;
    const offers = moments.map((moment) => {
      const verdict = offerVerdict({ moment, permission: "default", memory: NO_MEMORY, now: NOW });
      expect(verdict.show).toBe(true);
      return verdict.show ? verdict.offer : "";
    });
    /* Each moment names the specific thing that will not be missed, so no
       two are the same sentence. */
    expect(new Set(offers).size).toBe(moments.length);
    expect(offers[0]).toContain("asks about it");
    expect(offers[1]).toContain("host answers");
  });
});

describe("re-asking, which is where pestering starts", () => {
  it("says nothing for thirty days after a no", () => {
    const declined = rememberDecline(NO_MEMORY, NOW);
    const nextDay = offerVerdict({
      moment: "conversation_active",
      permission: "default",
      memory: declined,
      now: NOW + DAY,
    });
    expect(nextDay).toEqual({ show: false, because: "too_soon" });

    const almost = offerVerdict({
      moment: "conversation_active",
      permission: "default",
      memory: declined,
      now: NOW + (RE_ASK_AFTER_DAYS * DAY - 1),
    });
    expect(almost).toEqual({ show: false, because: "too_soon" });
  });

  it("may offer once more after thirty days and a fresh moment", () => {
    const declined = rememberDecline(NO_MEMORY, NOW);
    const later = offerVerdict({
      moment: "listing_published",
      permission: "default",
      memory: declined,
      now: NOW + RE_ASK_AFTER_DAYS * DAY,
    });
    expect(later.show).toBe(true);
  });

  it("never offers a third time, however long it has been", () => {
    let memory: PromptMemory = NO_MEMORY;
    memory = rememberDecline(memory, NOW);
    memory = rememberDecline(memory, NOW + RE_ASK_AFTER_DAYS * DAY);
    expect(memory.declines).toBe(MAX_DECLINES);

    const muchLater = offerVerdict({
      moment: "listing_published",
      permission: "default",
      memory,
      now: NOW + 365 * DAY,
    });
    expect(muchLater).toEqual({ show: false, because: "asked_enough" });
  });

  it("a no on our own screen is not a no to the system, and is counted separately", () => {
    const declined = rememberDecline(NO_MEMORY, NOW);
    expect(declined.systemAsked).toBe(false);
    expect(declined.declines).toBe(1);
  });
});

describe("Android below 13 has no prompt to explain", () => {
  it("skips the explanation where the permission is granted at install", () => {
    expect(androidNeedsPrompt(32)).toBe(false);
    expect(androidNeedsPrompt(30)).toBe(false);
  });

  it("shows it on Android 13 and above, where it is a runtime request", () => {
    expect(androidNeedsPrompt(33)).toBe(true);
    expect(androidNeedsPrompt(34)).toBe(true);
  });

  it("errs towards showing it when the version cannot be read", () => {
    expect(androidNeedsPrompt(null)).toBe(true);
  });
});
