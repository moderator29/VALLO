import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A TEXT FIELD NEVER DRAWS ITS OWN SQUARE RING (the founder, 25 October 2026).
 *
 * The generic focus ring in `base.css` is unlayered, so it outranks every
 * component. A search bar is a rounded shell around a bare input whose own
 * `outline: none` sits in `@layer components` and therefore lost, which drew a
 * second square ring and two vertical lines inside the shell. The fix is one
 * unlayered rule, after the ring, that takes the generic outline off
 * text-entry controls only. Read as source so the order and the scope hold.
 */
const base = readFileSync(join(__dirname, "base.css"), "utf8");

describe("text fields and the generic focus ring", () => {
  const ringAt = base.indexOf('[contenteditable]\n  ):focus-visible {');
  const textAt = base.indexOf("A TEXT FIELD NEVER DRAWS ITS OWN SQUARE RING");
  const ruleAt = base.indexOf("textarea\n  ):focus-visible {\n  outline: none;", textAt);

  it("has the text-field rule, after the ring, at the same level", () => {
    expect(ringAt).toBeGreaterThan(-1);
    expect(textAt).toBeGreaterThan(ringAt);
    expect(ruleAt).toBeGreaterThan(textAt);
  });

  it("is not inside a layer, because a layered rule would lose to the ring", () => {
    const before = base.slice(0, ruleAt);
    const opens = (before.match(/@layer base \{/g) ?? []).length;
    /* The one `@layer base { ... }` block is closed well before the ring. */
    const layerStart = before.indexOf("@layer base {");
    const layerEnd = layerStart === -1 ? -1 : (() => {
      let depth = 0;
      for (let i = layerStart; i < before.length; i++) {
        if (before[i] === "{") depth++;
        else if (before[i] === "}" && --depth === 0) return i;
      }
      return -1;
    })();
    expect(opens).toBeLessThanOrEqual(1);
    expect(layerEnd).toBeGreaterThan(-1);
    expect(layerEnd).toBeLessThan(ringAt);
  });

  it("covers typing controls and leaves checkboxes, radios, buttons and ranges alone", () => {
    const rule = base.slice(textAt, ruleAt + 60);
    for (const kept of ["checkbox", "radio", "range", "file", "button", "submit"]) {
      expect(rule).toContain(`[type="${kept}"]`);
    }
    expect(rule).toContain("textarea");
  });
});

describe("a search field draws no focus ring of its own", () => {
  const controls = readFileSync(join(__dirname, "controls.css"), "utf8");
  it("the shared field's focus halo skips search inputs", () => {
    expect(controls).toContain('.nf-field:not([type="search"]):focus {');
    expect(controls).toContain('.nf-field--glass:not([type="search"]):focus {');
  });
});
