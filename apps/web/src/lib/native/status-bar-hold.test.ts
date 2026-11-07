import { describe, expect, it } from "vitest";
import { heldGlyphs, holdStatusBar } from "./status-bar-hold";

describe("status bar holds", () => {
  it("follows the theme with no hold, the newest hold wins, release hands back", () => {
    expect(heldGlyphs()).toBeNull();
    const viewer = holdStatusBar("light");
    expect(heldGlyphs()).toBe("light");
    const sheet = holdStatusBar("dark");
    expect(heldGlyphs()).toBe("dark");
    sheet();
    expect(heldGlyphs()).toBe("light");
    viewer();
    viewer();
    expect(heldGlyphs()).toBeNull();
  });
});
