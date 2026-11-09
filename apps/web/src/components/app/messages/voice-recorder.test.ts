import { describe, expect, it } from "vitest";
import { isAppleWebKit, levelOf, liveBars, recorderType, slideCancels, uploadType } from "./voice-recorder";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("recording a voice note", () => {
  it("tells iOS WebKit from the rest", () => {
    expect(isAppleWebKit(IPHONE)).toBe(true);
    expect(isAppleWebKit(ANDROID)).toBe(false);
    expect(isAppleWebKit("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", 5)).toBe(true);
  });

  it("asks iOS for audio/mp4 and everything else for webm opus", () => {
    const all = () => true;
    expect(recorderType(all, true)).toBe("audio/mp4");
    expect(recorderType(all, false)).toBe("audio/webm;codecs=opus");
    expect(recorderType((t) => t === "audio/mp4", false)).toBe("audio/mp4");
    expect(recorderType(() => false, false)).toBeUndefined();
  });

  it("stores what the recorder made under a type the bucket takes", () => {
    expect(uploadType("audio/webm;codecs=opus", false)).toEqual({ contentType: "audio/webm", ext: "webm" });
    expect(uploadType("audio/mp4", true)).toEqual({ contentType: "audio/mp4", ext: "m4a" });
    expect(uploadType("", true)).toEqual({ contentType: "audio/mp4", ext: "m4a" });
    expect(uploadType(undefined, false)).toEqual({ contentType: "audio/webm", ext: "webm" });
  });

  it("reads loudness, the live bars and the slide", () => {
    expect(levelOf([128, 128])).toBe(0);
    expect(levelOf([128, 0, 200])).toBe(1);
    expect(liveBars([0.5], 3)).toEqual([0, 0, 0.5]);
    expect(slideCancels(-95)).toBe(false);
    expect(slideCancels(-96)).toBe(true);
  });
});
