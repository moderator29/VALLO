import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ONE TAB IS LIT AT A TIME (the founder, 25 October 2026).
 *
 * While a tapped tab loads, the old current tab used to lose only its link
 * colour: its glyph ink, its bloom and its spark dot stayed, so two tabs read
 * as chosen on a slow network. The rule that steps it back must take off every
 * mark, and the dock must give the bar back its truth when a tap never lands.
 */
const css = readFileSync(join(__dirname, "shell-m.css"), "utf8");
const dock = readFileSync(join(__dirname, "..", "..", "components", "app", "AutoHideDock.tsx"), "utf8");

describe("the old tab steps fully back while a new one loads", () => {
  const sel = '.nf-dockrow[data-dock-pending] .nf-tabbar .nf-tab__link[aria-current="page"]:not([data-on])';
  it("clears the glyph ink, the bloom and the animation", () => {
    expect(css).toContain(`:root ${sel} .nf-tab__icon {`);
    const at = css.indexOf(`:root ${sel},`);
    const block = css.slice(at, css.indexOf("}", at));
    expect(block).toContain("filter: none");
    expect(block).toContain("animation: none");
    expect(block).toContain("color: var(--nf-dock-glyph)");
  });
  it("hides its pill and its spark dot", () => {
    expect(css).toContain(`:root ${sel}::before {`);
    expect(css).toContain(`:root ${sel}::after {`);
    const at = css.indexOf(`:root ${sel}::after {`);
    expect(css.slice(at, css.indexOf("}", at))).toContain("content: none");
  });
});

describe("a tap that never lands", () => {
  it("reverts the dock to the real route after a timeout", () => {
    expect(dock).toContain("PENDING_REVERT_MS");
    expect(dock).toMatch(/setPendingOn\(null\)/);
    expect(dock).toMatch(/removeAttribute\("data-on"\)/);
  });
});
