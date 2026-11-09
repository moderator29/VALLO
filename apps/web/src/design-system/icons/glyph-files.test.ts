import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GLYPHS, glyphMasterSrc, glyphSrc } from "./glyphs";

/**
 * Every glyph ships twice (performance audit, 8 November 2026): the full PNG
 * master for `Icon3D`'s optimiser, and a 192px WebP for the plain `<img>`
 * spots, which no optimiser resizes. A glyph added without its WebP would
 * draw nothing in an empty state, so both are checked here.
 */
const PUBLIC = join(__dirname, "../../../public");

/** The canvas of a WebP file, from its VP8X header (sharp writes one for any image with alpha). */
function webpSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  if (buf.toString("ascii", 12, 16) !== "VP8X") return null;
  return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
}

describe("glyph files", () => {
  it.each(GLYPHS)("%s has its PNG master and a 192px WebP under 32 KB", (name) => {
    expect(existsSync(join(PUBLIC, glyphMasterSrc(name)))).toBe(true);
    const file = join(PUBLIC, glyphSrc(name));
    expect(glyphSrc(name).endsWith(".webp")).toBe(true);
    const size = webpSize(readFileSync(file));
    expect(size).not.toBeNull();
    expect(size!.w).toBe(192);
    expect(statSync(file).size).toBeLessThan(32 * 1024);
  });
});
