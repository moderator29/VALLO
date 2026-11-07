import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The four container tiers and the five elevation levels (Session 3; north
 * star section 4, directive D28). `Panel` is the Card tier, so the material
 * rules it depends on are pinned here, beside it.
 *
 * What is checked is source text, which is the honest limit of a unit test
 * on CSS: that every tier and level is named in both themes, that the Paper
 * card carries exactly one edge (the blue-tinted shadow, no hairline), that
 * the document sheet tokens are theme-independent, and that the Sheet reads
 * its tier rather than restating four edges.
 */
const ROOT = join(__dirname, "../../../../..");
const tokens = readFileSync(join(ROOT, "packages/design-tokens/src/tokens.css"), "utf8");
const glass = readFileSync(join(ROOT, "apps/web/src/app/css/glass.css"), "utf8");
const overlays = readFileSync(join(ROOT, "apps/web/src/app/css/overlays.css"), "utf8");

const foundations = tokens.slice(tokens.indexOf("SESSION 3 FOUNDATIONS (6 October 2026)"));
const nightOpen = foundations.indexOf(":root,\n[data-theme=\"dark\"],");
const lightOpen = foundations.indexOf(':root[data-theme="light"],', nightOpen);
const night = foundations.slice(foundations.indexOf("{", nightOpen), lightOpen);
const light = foundations.slice(foundations.indexOf("{", lightOpen), foundations.indexOf("}", lightOpen));

const LEVELS = ["flat", "raised", "floating", "overlay", "dialog"];

describe("elevation", () => {
  it("names all five levels in both themes", () => {
    for (const level of LEVELS) {
      expect(night, `night ${level}`).toContain(`--nf-elevation-${level}:`);
      expect(light, `paper ${level}`).toContain(`--nf-elevation-${level}:`);
    }
  });

  /* The north star's rung was "0 1px 2px rgb(1 1 24 / 0.04), 0 8px 24px -10px
     rgb(0 95 232 / 0.16)". The light mode pass of 7 November 2026 (Agent FE,
     the founder's "shadows that read on white") kept its two inks and its
     long blue ambient and gave the contact real weight, so a white card on
     paper is held up by a shadow the eye can see. What the north star asks
     for is what is pinned: blue tinted, the contact ink and the blue ink
     only, the long blue ambient last. */
  it("gives Paper the blue-tinted card shadow the north star describes", () => {
    const raised = light.match(/--nf-elevation-raised:([^;]+);/)?.[1] ?? "";
    const layers = raised.split(/,(?![^(]*\))/).map((layer) => layer.trim());
    expect(layers.length).toBeGreaterThanOrEqual(2);
    for (const layer of layers) expect(layer).toMatch(/rgb\((1 1 24|0 95 232) \/ 0\.\d+\)$/);
    expect(layers.at(-1)).toMatch(/^0 \d+px \d+px -\d+px rgb\(0 95 232 \/ 0\.\d+\)$/);
    expect(layers.filter((layer) => layer.includes("0 95 232"))).toHaveLength(1);
  });

  it("casts the Paper overlay shadow upwards, because a sheet sits on the bottom edge", () => {
    const overlay = light.match(/--nf-elevation-overlay:([^;]+);/)?.[1] ?? "";
    for (const layer of overlay.split(/,(?![^(]*\))/)) expect(layer.trim()).toMatch(/^0 -\d/);
  });
});

describe("the Card tier on Paper", () => {
  it("has one edge: the shadow, with the hairline made transparent", () => {
    expect(light).toMatch(/--nf-tier-card-edge: transparent;/);
    expect(light).toMatch(/--nf-tier-card-shadow: var\(--nf-elevation-raised\);/);
    expect(tokens).toMatch(/--nf-panel-edge: var\(--nf-tier-card-edge\);/);
    expect(tokens).toMatch(/--nf-panel-glow: var\(--nf-tier-card-shadow\);/);
    expect(tokens).toMatch(/--nf-card-shadow: var\(--nf-elevation-raised\);/);
  });

  it("offers the 22px corner for a card that carries a figure", () => {
    expect(glass).toMatch(/\.nf-panel--figure \{\s*border-radius: var\(--nf-tier-card-radius-figure\);/);
  });
});

describe("the Island tier", () => {
  it("is one class reading only tier tokens, with a 16px blur at night", () => {
    const rule = glass.slice(glass.indexOf("  .nf-island {"), glass.indexOf("}", glass.indexOf("  .nf-island {")));
    expect(rule).toContain("border-radius: var(--nf-tier-island-radius)");
    expect(rule).toContain("backdrop-filter: blur(var(--nf-tier-island-blur))");
    expect(rule).toContain("box-shadow: var(--nf-tier-island-shadow)");
    expect(night).toContain("--nf-tier-island-blur: 16px;");
  });

  it("drops the blur under data saver", () => {
    const saver = foundations.slice(foundations.indexOf('[data-save-data="on"], [data-motion-lite="on"]) [data-theme="dark"] {'));
    expect(saver).toContain("--nf-tier-island-blur: 0px;");
    expect(saver).toContain("--nf-tier-sheet-blur: 0px;");
  });
});

describe("the Sheet tier", () => {
  it("rounds 32 on the leading corners and carries one edge", () => {
    const rule = overlays.slice(overlays.indexOf("  .nf-sheet {"), overlays.indexOf("  .nf-sheet[data-open"));
    expect(rule).toContain("border-radius: var(--nf-tier-sheet-radius) var(--nf-tier-sheet-radius) 0 0;");
    expect(rule).toContain("box-shadow: var(--nf-tier-sheet-shadow);");
    expect(rule).not.toContain("--nf-panel-rim");
    expect(night).toContain("--nf-tier-sheet-grabber: 2.25rem;");
  });

  it("dims the page with the tier scrim and blurs it by 12", () => {
    expect(overlays).toContain("background: var(--nf-tier-sheet-scrim);");
    expect(night).toContain("--nf-tier-sheet-blur: 12px;");
  });
});

describe("the document sheet (D28.1)", () => {
  const DOC = ["bg", "bg-inset", "ink", "ink-muted", "ink-faint", "hairline", "shadow", "accent", "success", "error"];

  it("is defined once, in the block every theme reads, and never answered by Paper", () => {
    for (const name of DOC) {
      expect(night, name).toContain(`--nf-doc-${name}:`);
      expect(light, name).not.toContain(`--nf-doc-${name}:`);
    }
  });

  it("is light paper with near-black ink, whatever the canvas", () => {
    expect(night).toMatch(/--nf-doc-bg: #FFFFFF;/);
    expect(night).toMatch(/--nf-doc-ink: #010118;/);
    /* Raw values only: a reference to the palette would follow the theme. */
    for (const name of ["bg", "ink", "accent"]) {
      expect(night.match(new RegExp(`--nf-doc-${name}: ([^;]+);`))?.[1]).not.toMatch(/var\(/);
    }
  });
});
