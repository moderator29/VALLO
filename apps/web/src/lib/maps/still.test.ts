import { describe, expect, it } from "vitest";
import { projectPx, tilesForFrame } from "./still";
import { sourceTileFor } from "./vector-source";

describe("the still map's geometry", () => {
  it("projects like the live map: the equator and meridian sit mid-world", () => {
    const p = projectPx(0, 0, 0);
    expect(p.x).toBeCloseTo(128);
    expect(p.y).toBeCloseTo(128);
  });

  it("asks for the vector tiles a frame covers, and no more", () => {
    /* Yaba, Lagos at zoom 14 in a 68 px Home tile: one or two 512 px tiles. */
    const small = tilesForFrame(6.5095, 3.3711, 14, 68, 68);
    expect(small.level).toBe(13);
    expect(small.tiles.length).toBeGreaterThanOrEqual(1);
    expect(small.tiles.length).toBeLessThanOrEqual(4);
    /* A 360 by 200 Map tab never needs more than four. */
    const wide = tilesForFrame(6.5095, 3.3711, 14, 360, 200);
    expect(wide.tiles.length).toBeLessThanOrEqual(4);
    /* The frame's centre is the point. */
    const p = projectPx(6.5095, 3.3711, 14);
    expect(wide.left + 180).toBeCloseTo(p.x);
    expect(wide.top + 100).toBeCloseTo(p.y);
  });

  it("draws past the source's deepest zoom from the ancestor tile, scaled", () => {
    expect(sourceTileFor(13, 4174, 3948, 14)).toEqual({ z: 13, x: 4174, y: 3948, scale: 1, col: 0, row: 0 });
    /* Level 16 is level 14 drawn four times larger; this tile is its 3rd column, 2nd row. */
    expect(sourceTileFor(16, 4 * 8349 + 2, 4 * 7897 + 1, 14)).toEqual({ z: 14, x: 8349, y: 7897, scale: 4, col: 2, row: 1 });
    /* Columns wrap around the world. */
    expect(sourceTileFor(2, -1, 1, 14).x).toBe(3);
  });
});
