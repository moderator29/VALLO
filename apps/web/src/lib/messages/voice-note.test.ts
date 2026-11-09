import { describe, expect, it } from "vitest";
import { VOICE_MAX_MS, cleanDuration, cleanPeaks, extOf, isVoicePath } from "./voice-note";
import { attachVoiceSchema, setReactionSchema } from "./schema";

const CONV = "00000000-0000-4000-8000-00000000c001";
const FILE = "11111111-1111-4111-8111-111111111111";

describe("voice notes: the shape", () => {
  it("caps a note at two minutes (founder, 7 November 2026)", () => {
    expect(VOICE_MAX_MS).toBe(120_000);
  });

  it("knows the audio endings the bucket takes", () => {
    expect(extOf(`${CONV}/${FILE}.WEBM`)).toBe("webm");
    expect(isVoicePath(`${CONV}/${FILE}.m4a`)).toBe(true);
    expect(isVoicePath(`${CONV}/${FILE}.jpg`)).toBe(false);
  });

  it("draws only stored bars that are real numbers, clamped, at most 64", () => {
    expect(cleanPeaks([0.5, 2, -1])).toEqual([0.5, 1, 0]);
    expect(cleanPeaks(["a"])).toBeNull();
    expect(cleanPeaks(Array.from({ length: 65 }, () => 0.5))).toBeNull();
    expect(cleanPeaks(null)).toBeNull();
    expect(cleanDuration(1234.4)).toBe(1234);
    expect(cleanDuration(-1)).toBeNull();
    expect(cleanDuration("5")).toBeNull();
  });

  it("validates a voice note before any write", () => {
    const good = { conversationId: CONV, storagePath: `${CONV}/${FILE}.webm`, durationMs: 4200, peaks: [0.1, 0.9] };
    expect(attachVoiceSchema.safeParse(good).success).toBe(true);
    expect(attachVoiceSchema.safeParse({ ...good, storagePath: `${CONV}/${FILE}.jpg` }).success).toBe(false);
    expect(attachVoiceSchema.safeParse({ ...good, durationMs: 0 }).success).toBe(false);
    expect(attachVoiceSchema.safeParse({ ...good, durationMs: 10 * 60_000 }).success).toBe(false);
    expect(attachVoiceSchema.safeParse({ ...good, peaks: Array.from({ length: 65 }, () => 0.2) }).success).toBe(false);
    expect(attachVoiceSchema.safeParse({ ...good, peaks: [1.5] }).success).toBe(false);
  });

  it("takes a reaction only from the eight", () => {
    expect(setReactionSchema.safeParse({ messageId: FILE, emoji: "\u{1F525}" }).success).toBe(true);
    expect(setReactionSchema.safeParse({ messageId: FILE, emoji: "\u{1F4A9}" }).success).toBe(false);
  });
});
