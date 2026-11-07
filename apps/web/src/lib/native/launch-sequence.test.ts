import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE OPENING, ON BOTH PHONES (founder's ruling, 7 November 2026, replacing
 * D68c): the exact mark draws itself in on the iPhone, the wordmark slides
 * out from behind it on both, never longer than about 2.2 s, never taking a
 * touch, a plain fade under Reduce Motion. Read from the sources the two
 * binaries are built from; nothing here runs Xcode or the Android SDK.
 */
const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (p: string) => readFileSync(`${root}${p}`, "utf8");
const swift = read("ios/App/App/ValloShell.swift").replace(/\/\/.*$/gm, "");
const java = read("android/app/src/main/java/com/vallospaces/app/LaunchMark.java");
const num = (src: string, re: RegExp) => Number(src.match(re)?.[1]);

describe("the iPhone's drawn opening", () => {
  it("draws the ring along a centre line of 48 points inside the mark's box", () => {
    const body = swift.match(/static let ringLine: \[CGFloat\] = \[([\s\S]*?)\]/)?.[1] ?? "";
    const values = body.split(",").map((v) => v.trim()).filter(Boolean).map(Number);
    expect(values).toHaveLength(96);
    for (const v of values) expect(v >= 0 && v <= 1).toBe(true);
    expect(swift).toMatch(/ringMask\.path = line\.cgPath/);
    expect(swift).toMatch(/animate\(ringMask, "strokeEnd", from: 0, to: 1/);
  });

  it("raises four towers and slides five letters, then lands and hands over inside 2.2 s", () => {
    expect(swift).toMatch(/\(1\.\.\.4\)\.map \{ imageLayer\("LaunchTower/);
    expect(swift).toMatch(/\["V", "A", "L1", "L2", "O"\]\.map \{ imageLayer\("LaunchLetter/);
    const end = num(swift, /static let sequenceEnd: CFTimeInterval = ([\d.]+)/);
    const ceiling = num(swift, /static let ceiling: CFTimeInterval = ([\d.]+)/);
    const fade = num(swift, /static let fadeDuration: TimeInterval = ([\d.]+)/);
    const lastLetter = 0.74 + 0.06 * 4 + 0.42;
    expect(swift).toContain("delay: 0.74 + 0.06 * Double(i), duration: 0.42");
    expect(lastLetter).toBeLessThanOrEqual(end);
    expect(ceiling + fade).toBeLessThanOrEqual(2.2);
  });

  it("never takes a touch and honours Reduce Motion", () => {
    expect(swift).toMatch(/ground\.isUserInteractionEnabled = false/);
    expect(swift).toMatch(/quiet = UIAccessibility\.isReduceMotionEnabled[\s\S]*if quiet \{[\s\S]*UIView\.animate\(withDuration: 0\.2\)/);
  });

  it("reads its version line from the bundle", () => {
    expect(swift).toContain('Bundle.main.infoDictionary?["CFBundleShortVersionString"]');
  });
});

describe("Android's opening", () => {
  it("shows the exact mark, still, on the system splash and below Android 12, at the overlay's size", () => {
    const icon = read("android/app/src/main/res/drawable/splash_icon.xml");
    const legacy = read("android/app/src/main/res/drawable/splash_launch.xml");
    for (const xml of [icon, legacy]) {
      expect(xml).toContain('android:drawable="@drawable/launch_mark"');
      expect(xml).toContain('android:width="76dp"');
      expect(xml).toContain('android:height="65dp"');
    }
    expect(read("android/app/src/main/res/values/styles.xml")).toContain("@drawable/splash_icon");
    expect(read("capacitor.config.ts")).toContain('androidSplashResourceName: "splash_launch"');
    for (const f of ["launch_mark", "launch_letter_v", "launch_letter_a", "launch_letter_l1", "launch_letter_l2", "launch_letter_o"]) {
      expect(existsSync(`${root}android/app/src/main/res/drawable-nodpi/${f}.png`), f).toBe(true);
    }
  });

  it("slides the letters on the iPhone's timings and is gone about a second after the hand-over", () => {
    expect(num(java, /LETTER_STEP_MS = (\d+)/)).toBe(60);
    expect(num(java, /LETTER_MS = (\d+)/)).toBe(420);
    const landed = 4 * 60 + 420 + num(java, /HOLD_MS = (\d+)/);
    expect(landed + num(java, /FADE_MS = (\d+)/)).toBeLessThanOrEqual(1200);
  });

  it("never takes a touch, steps aside when animations are off, and is shown and handed over from the shell", () => {
    expect(java).toContain("g.setClickable(false)");
    expect(java).toContain("IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS");
    expect(java).toMatch(/if \(!animatorsOn\(\)\) \{\s*remove\(g\);/);
    expect(read("android/app/src/main/java/com/vallospaces/app/MainActivity.java")).toContain("LaunchMark.show(this)");
    expect(read("android/app/src/main/java/com/vallospaces/app/ValloShellPlugin.java")).toContain("runOnUiThread(LaunchMark::handOff)");
  });
});
