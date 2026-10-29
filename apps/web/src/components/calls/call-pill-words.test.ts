import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { callMarkerView } from "@/lib/calls/screen";
import { callPillDuration, callPillSentence, callRowText } from "./call-pill-words";

/**
 * THE WORDS OF A CALL PILL: who called and what became of it, in plain
 * sentences, from the call's own recorded facts. No length is ever invented.
 */
const en = getDictionary("en").chatPolish.calls;
const say = (body: string, mine: boolean, name = "Nora") => {
  const view = callMarkerView({ body, mine });
  if (!view) throw new Error(`not a marker: ${body}`);
  return callPillSentence(view, name, en);
};

describe("the call pill sentence", () => {
  it("says a call you did not take, from them", () => {
    expect(say("Video call, missed", false)).toBe("Missed video call from Nora");
    expect(say("Voice call, missed", false)).toBe("Missed voice call from Nora");
  });

  it("treats a call they cancelled while it rang, or that found you busy, as missed too", () => {
    expect(say("Video call, cancelled", false)).toBe("Missed video call from Nora");
    expect(say("Voice call, missed (busy)", false)).toBe("Missed voice call from Nora");
  });

  it("says a call you placed and what became of it", () => {
    expect(say("Video call, cancelled", true)).toBe("You called Nora, cancelled");
    expect(say("Voice call, missed", true)).toBe("You called Nora, no answer");
    expect(say("Video call, declined", true)).toBe("You called Nora, declined");
    expect(say("Voice call, missed (busy)", true)).toBe("You called Nora, on another call");
    expect(say("Video call, could not connect", true)).toBe("You called Nora, could not connect");
    expect(say("Voice call, expired", true)).toBe("You called Nora, expired");
  });

  it("says a call you declined, and an incoming one that did not connect", () => {
    expect(say("Voice call, declined", false)).toBe("You declined a voice call from Nora");
    expect(say("Video call, could not connect", false)).toBe("Video call from Nora, could not connect");
  });

  it("says a call that was talked on, with the length the call recorded", () => {
    expect(say("Video call, 12 min 4 s", false)).toBe("Video call with Nora, 12 min");
    expect(say("Video call, 12 min 4 s", true)).toBe("Video call with Nora, 12 min");
    expect(say("Voice call, 45 s", true)).toBe("Voice call with Nora, 45 s");
  });

  it("never invents a length: an ended call with none recorded says none", () => {
    expect(say("Video call, ended", true)).toBe("Video call with Nora");
    expect(say("Voice call, ended", false)).toBe("Voice call with Nora");
  });

  it("takes the length from the call's snapshot when the history read has it", () => {
    const view = callMarkerView({
      body: "Video call, ended",
      mine: false,
      snapshot: { kind: "VIDEO", state: "ENDED", durationSeconds: 3725, isInitiator: false, connectedAt: "2026-10-09T19:00:00.000Z" },
    })!;
    expect(callPillSentence(view, "Nora", en)).toBe("Video call with Nora, 62 min");
    /* A snapshot that never connected has no talk time to say. */
    const never = callMarkerView({
      body: "Video call, ended",
      mine: false,
      snapshot: { kind: "VIDEO", state: "ENDED", durationSeconds: null, isInitiator: false, connectedAt: null },
    })!;
    expect(callPillSentence(never, "Nora", en)).toBe("Video call with Nora");
  });

  it("counts the length in whole minutes from a minute up, and in seconds below it", () => {
    expect(callPillDuration(59, en)).toBe("59 s");
    expect(callPillDuration(60, en)).toBe("1 min");
    expect(callPillDuration(719, en)).toBe("11 min");
    expect(callPillDuration(null, en)).toBe("");
    expect(callPillDuration(-3, en)).toBe("");
  });
});

describe("the one-line call row", () => {
  const row = (body: string, mine: boolean) => callRowText(callMarkerView({ body, mine })!, en);
  it("says the kind and what became of it, with no name", () => {
    expect(row("Voice call, missed", false)).toBe("Missed voice call");
    expect(row("Video call, cancelled", true)).toBe("Video call cancelled");
    expect(row("Video call, declined", true)).toBe("Video call declined");
    expect(row("Voice call, missed", true)).toBe("Voice call, no answer");
    expect(row("Voice call, ended", true)).toBe("Voice call ended");
    expect(row("Voice call, 21 min 9 s", false)).toBe("Voice call ended, 21 min");
  });
});

describe("the call pill in every language", () => {
  /* The one-line thread row's words are English until translated (other locales fall back). */
  const englishForNow = new Set(["rowMissed", "rowEnded", "rowEndedFor", "rowOutcome", "rowOutcomeSoft", "callBackShort"]);
  const keys = (Object.keys(en) as (keyof typeof en)[]).filter((k) => !englishForNow.has(k));

  it.each(["yo", "ha", "ig"] as const)("%s has every pill word, translated rather than copied from English", (locale) => {
    const words = getDictionary(locale).chatPolish.calls;
    for (const key of keys) {
      expect(words[key], `${locale}.${key}`).toBeTruthy();
      expect(words[key], `${locale}.${key} is still English`).not.toBe(en[key]);
    }
  });

  it.each(["en", "yo", "ha", "ig"] as const)("%s keeps every placeholder its sentences need", (locale) => {
    const words = getDictionary(locale).chatPolish.calls;
    expect(words.missedFrom).toMatch(/\{name\}/);
    expect(words.callWith).toMatch(/\{name\}/);
    expect(words.callWith).toMatch(/\{duration\}/);
    expect(words.youCalled).toMatch(/\{outcome\}/);
    expect(words.callBack).toMatch(/\{name\}/);
    const view = callMarkerView({ body: "Video call, 12 min 4 s", mine: false })!;
    expect(callPillSentence(view, "Nora", words)).toContain("Nora");
    expect(callPillSentence(view, "Nora", words)).not.toMatch(/[{}]/);
  });
});
