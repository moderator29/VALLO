import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* The map's controls sit at z-1000 and z-1100. Without its own stacking
   context they outrank the side drawer (z-60) and paint over its menu. */
describe("map stacking", () => {
  it("the map root isolates its layers so the drawer stays above them", () => {
    const src = readFileSync(join(__dirname, "MapCanvas.tsx"), "utf8");
    expect(src).toMatch(/className=\{`relative isolate w-full overflow-hidden/);
  });
});
