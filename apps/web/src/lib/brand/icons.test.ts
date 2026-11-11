import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import manifest from "@/app/manifest";
import { ICON_VERSION, versioned } from "@/lib/theme/brand-assets";
import { LAUNCH_IMAGES } from "./launch-images";

/**
 * EVERY ICON THE MANIFEST AND THE HEAD NAME EXISTS, AT THE SIZE IT SAYS (10
 * November 2026, brand refresh). Read from the PNG header, not trusted from
 * the file name, and the maskable icon is checked for its safe zone.
 */
const WEB_ROOT = join(__dirname, "..", "..", "..");
const PUBLIC = join(WEB_ROOT, "public");
const onDisk = (url: string) => join(PUBLIC, url.split("?")[0]!);

function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  expect(b.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(b.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("the manifest's icons", () => {
  const icons = manifest().icons ?? [];
  it("names three icons and each carries the cache-busting version", () => {
    expect(icons).toHaveLength(3);
    for (const icon of icons) expect(icon.src).toContain(`?v=${ICON_VERSION}`);
  });
  it("each exists and is exactly the size it states", () => {
    for (const icon of icons) {
      const file = onDisk(icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = (icon.sizes ?? "").split("x").map(Number);
      expect(pngSize(file)).toEqual({ w, h });
    }
  });
  it("has a maskable 512 and a 192 and a 512 for any", () => {
    expect(icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
    expect(icons.some((i) => i.purpose === "any" && i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.purpose === "any" && i.sizes === "512x512")).toBe(true);
  });
  it("shortcut icons exist", () => {
    for (const s of manifest().shortcuts ?? []) for (const i of s.icons ?? []) expect(existsSync(onDisk(i.src))).toBe(true);
  });
});

describe("the head's icons", () => {
  const fixed: [string, number][] = [
    ["/pwa/apple-touch-icon.png", 180],
    ["/pwa/icon-16.png", 16],
    ["/pwa/icon-32.png", 32],
    ["/pwa/icon-48.png", 48],
    ["/pwa/icon-64.png", 64],
    ["/pwa/icon-192.png", 192],
    ["/pwa/icon-512.png", 512],
    ["/pwa/icon-maskable-512.png", 512],
    ["/brand/vallo-icon.png", 1024],
  ];
  it.each(fixed)("%s is %i square", (url, size) => {
    expect(pngSize(onDisk(url))).toEqual({ w: size, h: size });
  });
  it("favicon.ico holds 16, 32 and 48 images", () => {
    const b = readFileSync(join(PUBLIC, "favicon.ico"));
    expect(b.readUInt16LE(2)).toBe(1);
    const n = b.readUInt16LE(4);
    const sizes = Array.from({ length: n }, (_, i) => b[6 + i * 16]);
    expect(sizes).toEqual([16, 32, 48]);
  });
  it("the layout links the versioned icons and the launch images", () => {
    const layout = readFileSync(join(__dirname, "..", "..", "app", "layout.tsx"), "utf8");
    expect(layout).toContain('versioned("/pwa/apple-touch-icon.png")');
    expect(layout).toContain("startupImage: LAUNCH_IMAGES.map");
    expect(versioned("/x.png")).toBe(`/x.png?v=${ICON_VERSION}`);
  });
});

describe("the iOS launch images", () => {
  it("cover the common iPhones, including the 1320 x 2868 device", () => {
    const sizes = LAUNCH_IMAGES.map((i) => `${i.width}x${i.height}`);
    for (const s of ["1170x2532", "1179x2556", "1206x2622", "1290x2796", "1320x2868"]) expect(sizes).toContain(s);
  });
  it.each(LAUNCH_IMAGES.map((i) => [i.url, i.width, i.height, i.media] as const))("%s exists at %i x %i and its media query matches", (url, w, h, media) => {
    expect(pngSize(onDisk(url))).toEqual({ w, h });
    const m = /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\)/.exec(media)!;
    expect([Number(m[1]) * Number(m[3]), Number(m[2]) * Number(m[3])]).toEqual([w, h]);
  });
});

describe("the maskable icon's safe zone", () => {
  it("keeps everything that is not the background inside the middle 80 per cent circle", async () => {
    /* The ground is a RADIAL navy gradient, so it cannot be read from a row's
       edge: at the same y it is lighter near the centre. Compare instead
       against the ground layer the same generator emits with no mark on it
       (`assets/icon-background.png`, the identical radial at 1024), scaled to
       match. Whatever differs from that is the mark. */
    const size = 512;
    const ground = await sharp(join(WEB_ROOT, "assets", "icon-background.png")).resize(size, size).removeAlpha().raw().toBuffer();
    const { data, info } = await sharp(join(PUBLIC, "pwa", "icon-maskable-512.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(size);
    const centre = size / 2;
    const limit = size * 0.4;
    let outside = 0;
    let inside = 0;
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const i = (y * size + x) * 3;
        const differs =
          Math.abs(data[i]! - ground[i]!) + Math.abs(data[i + 1]! - ground[i + 1]!) + Math.abs(data[i + 2]! - ground[i + 2]!) > 40;
        if (!differs) continue;
        const d = Math.hypot(x - centre, y - centre);
        if (d > limit) outside++;
        else inside++;
      }
    }
    expect(inside).toBeGreaterThan(1000);
    expect(outside).toBe(0);
  });
  it("the home screen icon is dark: its ground is the brand navy", async () => {
    const { data } = await sharp(join(PUBLIC, "pwa", "icon-512.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const corner = [data[0]!, data[1]!, data[2]!];
    /* `#010118` at the corner, where the radial lift has fallen away. */
    expect(Math.max(...corner)).toBeLessThan(40);
    expect(corner[2]!).toBeGreaterThanOrEqual(corner[0]!);
  });
});
