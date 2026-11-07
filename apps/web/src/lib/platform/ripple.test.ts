import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rippleGeometry, spreadMs } from "./ripple";

const PHONE = { width: 360, height: 800 };

describe("the Android ripple's geometry", () => {
  it("spreads from under the finger far enough to reach the farthest corner", () => {
    const g = rippleGeometry({ left: 16, top: 200, width: 328, height: 56 }, { x: 40, y: 220 }, PHONE);
    expect(g).not.toBeNull();
    expect(g!.round).toBe(false);
    expect(g!.host).toEqual({ left: 16, top: 200, width: 328, height: 56 });
    expect(g!.ink.x).toBe(24);
    expect(g!.ink.y).toBe(20);
    /* Farthest corner is the bottom right: (328-24, 56-20). */
    expect(g!.ink.size).toBe(Math.ceil(Math.hypot(304, 36) * 2));
  });

  it("draws a round, centred ink on an icon button wherever the finger landed", () => {
    const g = rippleGeometry({ left: 300, top: 10, width: 44, height: 44 }, { x: 305, y: 50 }, PHONE)!;
    expect(g.round).toBe(true);
    expect(g.ink).toEqual({ x: 22, y: 22, size: 44 });
  });

  it("cuts the layer to what is on screen and keeps the finger inside it", () => {
    const g = rippleGeometry({ left: 16, top: -30, width: 328, height: 120 }, { x: 100, y: -10 }, PHONE)!;
    expect(g.host.top).toBe(0);
    expect(g.host.height).toBe(90);
    expect(g.ink.y).toBe(0);
  });

  it("draws nothing for an empty box, a box off screen or a whole-screen surface", () => {
    expect(rippleGeometry({ left: 0, top: 0, width: 0, height: 40 }, { x: 0, y: 0 }, PHONE)).toBeNull();
    expect(rippleGeometry({ left: 0, top: 900, width: 200, height: 60 }, { x: 10, y: 910 }, PHONE)).toBeNull();
    expect(rippleGeometry({ left: 0, top: 0, width: 360, height: 700 }, { x: 10, y: 10 }, PHONE)).toBeNull();
  });

  it("spreads a little longer across a wide card than a chip, inside 260 to 480ms", () => {
    expect(spreadMs(40)).toBe(260);
    expect(spreadMs(400)).toBe(360);
    expect(spreadMs(2000)).toBe(480);
  });
});

describe("the ripple stays an Android-shell feature", () => {
  it("is started only from the native runtime, for Android, behind a dynamic import", () => {
    const boot = readFileSync(join(process.cwd(), "src/lib/native/boot.ts"), "utf8");
    expect(boot).toMatch(/if \(platform === "android"\) \{[\s\S]*?await import\("@\/lib\/platform\/ripple"\)/);
    const importers = ["src/components/app/NativeRuntime.tsx", "src/app/layout.tsx"].map((f) => readFileSync(join(process.cwd(), f), "utf8"));
    for (const source of importers) expect(source).not.toContain("platform/ripple");
  });

  it("animates transform and opacity only", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/platform/ripple.ts"), "utf8");
    const keyframes = source.match(/animate\(\[[^\]]*\]/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) {
      const props = [...k.matchAll(/\{\s*(\w+):/g)].map((m) => m[1]);
      for (const p of props) expect(["transform", "opacity"]).toContain(p);
    }
  });
});
