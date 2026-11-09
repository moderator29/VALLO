import { describe, expect, it } from "vitest";
import { withFreshMedia } from "./media-refresh";

describe("fresh media links", () => {
  const items = [
    { id: "p1", imageUrl: "https://x/old-photo", body: "" },
    { id: "v1", imageUrl: null, audio: { url: "https://x/old-voice", durationMs: 4000, peaks: null } },
    { id: "local", imageUrl: "blob:abc" },
    { id: "t1", imageUrl: null },
  ];

  it("swaps a photo's and a note's link in place, never one made on this device", () => {
    const next = withFreshMedia(items, {
      p1: { kind: "image", url: "https://x/new-photo" },
      v1: { kind: "audio", url: "https://x/new-voice" },
      local: { kind: "image", url: "https://x/server" },
      t1: { kind: "image", url: "https://x/stray" },
    });
    expect(next[0]!.imageUrl).toBe("https://x/new-photo");
    expect(next[1]!.audio).toEqual({ url: "https://x/new-voice", durationMs: 4000, peaks: null });
    expect(next[2]!.imageUrl).toBe("blob:abc");
    expect(next[3]!.imageUrl).toBeNull();
  });

  it("returns the same list when nothing changed", () => {
    expect(withFreshMedia(items, {})).toBe(items);
  });
});
