import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

/**
 * THE NATIVE LAUNCH IMAGE CARRIES NO MARK (D68c, 7 October 2026).
 *
 * The founder's rule is absolute: the logo never appears by itself on app
 * open. The launch image is the one frame whose duration the web layer cannot
 * bound, so it is a flat `#010118` field, identical to the app's background.
 * `scripts/build-native-icons.mjs` writes every one of these files; this test
 * fails if any of them carries a single pixel that is not that navy, which is
 * what a regeneration with the old tile composition would do.
 *
 * 7 NOVEMBER 2026: THE FOUNDER'S RULING REPLACES D68c FOR THE OPENING. The
 * mark now appears at app open, drawn by the shell on both phones (iOS
 * `LaunchMark` in ValloShell.swift, Android `LaunchMark.java`, held by
 * `launch-sequence.test.ts`). These bitmaps stay flat navy all the same:
 * they are the frame before the shell draws anything, and a mark baked into
 * them would sit in a different place from the drawn one.
 */

const WEB = path.resolve(__dirname, "../../..");
const ANDROID_RES = path.join(WEB, "android/app/src/main/res");
const IOS_SPLASH = path.join(WEB, "ios/App/App/Assets.xcassets/Splash.imageset");
const NAVY = [1, 1, 24];

function launchImages(): string[] {
  const files: string[] = [];
  for (const dir of readdirSync(ANDROID_RES)) {
    const file = path.join(ANDROID_RES, dir, "splash.png");
    if (dir.startsWith("drawable") && existsSync(file)) files.push(file);
  }
  for (const name of readdirSync(IOS_SPLASH)) {
    if (name.endsWith(".png")) files.push(path.join(IOS_SPLASH, name));
  }
  files.push(path.join(WEB, "assets/splash.png"), path.join(WEB, "assets/splash-dark.png"));
  return files;
}

describe("the native launch image", () => {
  const files = launchImages();

  it("exists on Android (day and night) and on iOS (light and dark)", () => {
    expect(files.some((f) => f.includes("drawable-port-night"))).toBe(true);
    expect(files.some((f) => f.includes("drawable-port-xxhdpi"))).toBe(true);
    expect(files.some((f) => f.endsWith("anyany-dark.png"))).toBe(true);
    expect(files.filter((f) => f.includes("Splash.imageset")).length).toBeGreaterThanOrEqual(6);
  });

  it.each(files.map((f) => [path.relative(WEB, f)]))("%s is a flat navy field (the chrome colour) with no mark", async (rel) => {
    const { channels } = await sharp(path.join(WEB, rel)).removeAlpha().stats();
    channels.forEach((channel, i) => {
      expect(channel.min).toBe(NAVY[i]);
      expect(channel.max).toBe(NAVY[i]);
    });
  });
});
