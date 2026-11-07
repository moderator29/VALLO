import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The navigation upgraded in place (Session 3, Stage 2; north star sections
 * 6 and 15.5). The dock and the rail keep their slots and structure; these
 * pin the upgrade: the Island material, the spring, 12px/600 labels, cyan
 * counts, the round "+" at the right end turning a quarter into its own
 * close (it was the capsule's centre until the 13 October 2026 swap), the
 * current row's bar-and-tint (never a glow) and the collapsed 72px rail.
 */
const APP = join(__dirname, "../../app");
const css = readFileSync(join(APP, "css/nav-island.css"), "utf8");
const globals = readFileSync(join(APP, "globals.css"), "utf8");
const rail = readFileSync(join(__dirname, "AppRail.tsx"), "utf8");
const tree = readFileSync(join(__dirname, "NavTree.tsx"), "utf8");
const dock = readFileSync(join(__dirname, "CreateDock.tsx"), "utf8");
const bar = readFileSync(join(__dirname, "MobileTabBar.tsx"), "utf8");
const shell = readFileSync(join(APP, "css/shell-m.css"), "utf8");

const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
};

describe("the navigation partial", () => {
  it("loads after the partials it answers and before data saver", () => {
    const order = ["./css/shell-m.css", "./css/light.css", "./css/brand-glass.css", "./css/nav-island.css", "./css/data-saver.css"];
    const at = order.map((f) => globals.indexOf(`@import "${f}"`));
    for (const i of at) expect(i).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("never drops below 12px or uses a weight off the scale", () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(body).not.toMatch(/font-weight:\s*(?:650|700|750|800)/);
    expect(body).not.toMatch(/font-size:\s*0\.6/);
  });
});

describe("the dock", () => {
  it("is an Island on the 16px blur, and one edge by day", () => {
    expect(css).toContain("backdrop-filter: blur(var(--nf-tier-island-blur))");
    expect(css).toMatch(/border-color: transparent;\s*box-shadow: var\(--nf-tier-island-shadow\);/);
  });

  it("springs the pill on drift 240ms and sets the chosen word at 12px/600", () => {
    expect(rule(".nf-tabbar .nf-tab")).toContain("flex-grow var(--nf-duration-base) var(--nf-ease-spring)");
    const label = rule(".nf-tabbar .nf-tab__label");
    expect(label).toContain("font-size: var(--nf-text-overline)");
    expect(label).toContain("font-weight: 600");
  });

  it("draws the round \"+\" at the right end, 60px, that turns a quarter into its own close", () => {
    /* It fills the round button, which is `--nf-dock-round` (60px; 52px under 380px). */
    expect(rule(".nf-dock-plus")).toMatch(/width: var\(--nf-dock-round, 3\.75rem\);\s*height: var\(--nf-dock-round, 3\.75rem\);/);
    expect(shell).toMatch(/\.nf-dockrow \{\s*--nf-dock-round: 3\.75rem;/);
    expect(shell).toMatch(/max-width: 379\.98px\) \{\s*\.nf-dockrow \{\s*--nf-dock-round: 3\.25rem;/);
    expect(css).toMatch(/\.nf-dock-create\[aria-expanded="true"\] \.nf-dock-plus \{\s*transform: rotate\(90deg\);/);
    expect(dock).toContain("nf-dock-plus__glyph--close");
    expect(dock).toContain('className="nf-dock-create"');
  });

  it("puts Vallo Circle in the capsule's centre slot, with the + after the capsule", () => {
    /* The centre slot was the grid menu (13 October 2026); since 7 November
       2026 it is the Circle tab, a link in the soft round plate. */
    expect(bar).toMatch(/<li key="circle" className="nf-tab nf-tab--switch nf-tab--circle">\s*<HoldTabLink/);
    expect(bar).toContain("href={CIRCLE_ROUTE}");
    expect(bar).not.toContain("<DockMore");
    expect(bar.indexOf("</ul>")).toBeLessThan(bar.indexOf('className="nf-dockcreate"'));
    expect(shell).toMatch(/\.nf-tab-circle__plate \{[^}]*border-radius: var\(--nf-radius-circle\);/);
  });

  it("counts in cyan, never red or orange", () => {
    const unread = rule(".nf-dockmore__unread");
    expect(unread).toContain("var(--nf-count-fill)");
    expect(unread).not.toMatch(/spark|error|rose/);
  });
});

describe("the side navigation", () => {
  it("marks the current row with a 3px bar and a tint, and no glow", () => {
    expect(css).toMatch(/\.nf-nav \.nf-nav__row--on::before \{[^}]*width: 3px;/);
    const on = rule(".nf-nav .nf-nav__row--on,\n  .nf-nav--drawer .nf-nav__row--on");
    expect(on).toContain("box-shadow: none");
    expect(on).toContain("var(--nf-brand-tint-2)");
  });

  it("collapses to 72px on the desktop rail, remembered on the device in try/catch", () => {
    expect(css).toMatch(/\.nf-nav--rail\[data-collapsed\] \{\s*width: 4\.5rem;/);
    /* Scoped to the member shell, never the whole root: the consoles' own
       sidebars read the same variable and must not collapse with it. */
    expect(css).toMatch(/:root\[data-rail="collapsed"\] \.nf-app-shell \{\s*--nf-rail-width: 4\.5rem;/);
    expect(css).not.toMatch(/:root\[data-rail="collapsed"\] \{/);
    expect(rail).toMatch(/return \(\) => \{\s*delete root\.dataset\.rail;/);
    expect(rail).toMatch(/try \{\s*return window\.localStorage\.getItem/);
    expect(tree).toContain("title={collapsed ? item.label : undefined}");
  });

  it("draws only the bare icon for the workspace coin by day", () => {
    expect(css).toMatch(/:root\[data-theme="light"\] \.nf-nav \.nf-side-switch__coin \{\s*background: none;/);
  });
});
