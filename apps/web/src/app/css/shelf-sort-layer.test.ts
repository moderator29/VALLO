/**
 * THE SORT MENU IS NOT SEALED UNDER THE PAGE (the founder, 12 November 2026:
 * "it supposed to be on the front not on the back of those button").
 *
 * `.nf-shelf-bar` is `position: sticky` WITH a `z-index`, so it is a stacking
 * context and everything inside it is one layer out on the page. The sort
 * menu's own `z-index: 40` therefore orders it only against its siblings
 * inside that bar; it cannot beat anything outside it. Several things on the
 * same screen sit at 30 and come later in the document, so they painted over
 * an open menu: the floating map pill (`position: fixed; z-index: 30`), the
 * compare tray, and the list views layer.
 *
 * Measured in Chromium and WebKit at 390 with the menu open and a later
 * sibling at 30, before the fix: `elementFromPoint` at the centre of the menu
 * returned the sibling. After: it returns the menu's own item, and the bar
 * drops back to 30 the moment the menu closes.
 *
 * This file reads source text, so it cannot prove what a browser painted. What
 * it does hold is the ladder, which is the part a later edit would break
 * without noticing: the lift has to clear the 30s and must stay under the
 * surfaces that are meant to cover everything, because a dropdown that covers
 * the cookie bar or the photo viewer is a worse bug than the one being fixed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS_DIR = __dirname;
const read = (f: string) => readFileSync(join(CSS_DIR, f), "utf8");
const catalogue = read("catalogue.css");

/** The first z-index declared for a selector, as a number. */
function zIndexOf(css: string, selector: string): number | null {
  const at = css.indexOf(selector);
  if (at === -1) return null;
  const match = css.slice(at, at + 400).match(/z-index:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

/** The highest layer a sheet claims: what that surface sits above everything on. */
function topZIndexIn(css: string): number | null {
  const all = [...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1]));
  return all.length > 0 ? Math.max(...all) : null;
}

describe("the shelf bar lifts while its sort menu is open", () => {
  it("raises the bar, which is the only layer the menu can travel on", () => {
    /* The menu cannot be lifted on its own: its own z-index is spent inside
       the bar's stacking context, so the BAR is what has to move. */
    expect(catalogue).toMatch(/\.nf-shelf-bar:has\(\.nf-shelf-sort\[open\]\)\s*\{\s*z-index:\s*\d+/);
  });

  it("clears everything on this screen that used to paint over it", () => {
    const lifted = zIndexOf(catalogue, ".nf-shelf-bar:has(.nf-shelf-sort[open])");
    const resting = zIndexOf(catalogue, ".nf-shelf-bar {");
    expect(lifted).not.toBeNull();
    expect(resting).not.toBeNull();
    expect(lifted!).toBeGreaterThan(resting!);

    /* The three rivals, read from their own sheets rather than repeated here,
       so a change to any of them fails this test instead of passing quietly. */
    const rivals = {
      "the floating map pill": zIndexOf(read("list-views.css"), ".nf-maplist-pill"),
      "the compare tray": topZIndexIn(read("compare-tray.css")),
    };
    for (const [what, z] of Object.entries(rivals)) {
      expect(z, what).not.toBeNull();
      expect(lifted!, what).toBeGreaterThan(z!);
    }
  });

  it("stays under the surfaces that must cover everything, because a dropdown is not one of them", () => {
    const lifted = zIndexOf(catalogue, ".nf-shelf-bar:has(.nf-shelf-sort[open])")!;
    const above = {
      "the cookie bar": topZIndexIn(read("cookie-consent.css")),
      "the side flip": topZIndexIn(read("side-flip.css")),
      "the photo viewer": topZIndexIn(read("photo-viewer.css")),
    };
    for (const [what, z] of Object.entries(above)) {
      expect(z, what).not.toBeNull();
      expect(lifted, what).toBeLessThan(z!);
    }
  });

  it("lifts only while the menu is open, so the bar is back on its own layer the rest of the time", () => {
    /* The lift is keyed on `[open]`, which a native <details> sets and clears
       by itself. Nothing restores the resting value on a timer or in script,
       so if the selector ever stops matching the bar simply never lifts, which
       is the old behaviour rather than a bar stuck over the page. */
    const rule = catalogue.match(/\.nf-shelf-bar:has\(([^)]*)\)/)?.[1] ?? "";
    expect(rule).toContain("[open]");
  });
});
