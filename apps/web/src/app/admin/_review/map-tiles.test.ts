import { describe, expect, it } from "vitest";
import { tileMosaic } from "./map-tiles";

describe("tileMosaic", () => {
  it("puts the point inside the centre tile", () => {
    const mosaic = tileMosaic(6.4474, 3.47, "https://t/{z}/{x}/{y}{r}.png");
    expect(mosaic).not.toBeNull();
    expect(mosaic?.urls).toHaveLength(9);
    expect(mosaic?.urls[4]).toBe("https://t/15/16699/15795.png");
    expect(mosaic?.pointX).toBeGreaterThanOrEqual(256);
    expect(mosaic?.pointX).toBeLessThanOrEqual(512);
    expect(mosaic?.pointY).toBeGreaterThanOrEqual(256);
    expect(mosaic?.pointY).toBeLessThanOrEqual(512);
  });

  it("refuses a point that is not on the map", () => {
    expect(tileMosaic(Number.NaN, 3, "{z}")).toBeNull();
    expect(tileMosaic(89, 3, "{z}")).toBeNull();
  });

  it("has no tiles to lay out for a vector-only provider, and still places the point", () => {
    const mosaic = tileMosaic(6.4474, 3.47, "");
    expect(mosaic?.urls).toEqual([]);
    expect(mosaic?.pointX).toBeGreaterThanOrEqual(256);
    expect(mosaic?.pointY).toBeLessThanOrEqual(512);
  });
});
