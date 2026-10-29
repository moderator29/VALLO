import { describe, expect, it } from "vitest";
import { clipPath, elapsedText, isShowMeItem, playLabel, readShowMeResult, showMeState, sizeText } from "./show-me";

const copy = {
  minutes: { one: "{count} minute", other: "{count} minutes" },
  hours: { one: "{count} hour", other: "{count} hours" },
  days: { one: "{count} day", other: "{count} days" },
};

describe("Show me (V-69)", () => {
  it("knows the items and the database's words", () => {
    expect(isShowMeItem("meter")).toBe(true);
    expect(isShowMeItem("pool")).toBe(false);
    expect(readShowMeResult("too-long")).toBe("too-long");
    expect(readShowMeResult("too-big")).toBe("too-big");
    expect(readShowMeResult("nope")).toBe("failed");
  });

  it("says whether a request waits, is answered or ran out", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(showMeState({ status: "open", expiresAt: "2026-09-25T12:00:00Z" }, now)).toBe("open");
    expect(showMeState({ status: "open", expiresAt: "2026-09-24T11:00:00Z" }, now)).toBe("expired");
    expect(showMeState({ status: "answered", expiresAt: "2026-09-24T11:00:00Z" }, now)).toBe("answered");
  });

  it("says how long after the ask a clip came, never a claim about where it was filmed", () => {
    expect(elapsedText("2026-09-24T10:00:00Z", "2026-09-24T10:25:00Z", copy, "en")).toBe("25 minutes");
    expect(elapsedText("2026-09-24T10:00:00Z", "2026-09-24T13:10:00Z", copy, "en")).toBe("3 hours");
    expect(elapsedText("2026-09-24T10:00:00Z", "2026-09-24T11:00:00Z", copy, "en")).toBe("1 hour");
    expect(elapsedText("2026-09-22T10:00:00Z", "2026-09-24T10:00:00Z", copy, "en")).toBe("2 days");
  });

  it("keeps a clip inside its request's folder", () => {
    expect(clipPath("r1", "f1", "IMG_1.MOV")).toBe("r1/f1.mov");
    expect(clipPath("r1", "f1", "clip")).toBe("r1/f1.mp4");
  });
});

describe("sizeText", () => {
  it("says a clip's weight for the data saver", () => {
    expect(sizeText(2_400_000)).toBe("2.4 MB");
    expect(sizeText(640_000)).toBe("640 KB");
    expect(sizeText(12)).toBe("1 KB");
    expect(sizeText(999_999)).toBe("1.0 MB");
  });
  it("builds the play label from what is known, never the claimed length", () => {
    const copy = { play: "Play the clip", playWithSize: "Play the clip, {size}" };
    expect(playLabel(2_400_000, copy)).toBe("Play the clip, 2.4 MB");
    expect(playLabel(null, copy)).toBe("Play the clip");
    expect(playLabel(0, copy)).toBe("Play the clip");
  });
});
