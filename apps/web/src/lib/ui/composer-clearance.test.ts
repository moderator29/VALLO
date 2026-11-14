import { describe, expect, it } from "vitest";

import { composerClearancePx } from "./composer-clearance";

describe("how far the quick pill clears a composer", () => {
  it("is the distance from the composer's top edge to the bottom of what can be seen", () => {
    expect(composerClearancePx(844, 760)).toBe(84);
  });

  it("follows the keyboard: a shorter view with the composer on it gives the composer's own height", () => {
    expect(composerClearancePx(508, 440)).toBe(68);
  });

  it("rounds to a whole pixel and never goes negative for a composer scrolled out of view", () => {
    expect(composerClearancePx(844, 759.6)).toBe(84);
    expect(composerClearancePx(844, 900)).toBe(0);
  });
});
