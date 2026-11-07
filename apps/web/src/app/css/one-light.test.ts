import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ONE LIGHT (CRAFT_DOCTRINE 3, "shadows from ONE consistent light source";
 * north star 4, "a component picks a level; it never writes a shadow";
 * CRAFT-PRINCIPLES 2.3; Session 3 round 5, W1).
 *
 * The shadows already agreed on direction. They did not agree on ink: Paper
 * lit its cards in about ten shadow colours from two parallel ladders. Held
 * here:
 *
 *   1. the old `--nf-elev-1..5` rungs are names for the four elevation levels
 *      (`raised`, `floating`, `overlay`, `dialog`), defined once;
 *   2. every outer shadow layer written in a Paper block of tokens.css is in
 *      one of Paper's two inks, the blue `0 95 232` or the contact `1 1 24`
 *      (a colour-mixed brand bloom on the one primary is its own light);
 *   3. outside tokens.css nobody writes an elevation by hand: an outer shadow
 *      layer with an offset and a blur is listed below with its reason (a
 *      glow in the element's own hue, or work pending in another agent's
 *      file), or it fails. A 1px offset with no blur is a hairline, not a
 *      light, and is not counted.
 */
const SRC = join(__dirname, "..", "..");
const TOKENS = readFileSync(join(SRC, "..", "..", "..", "packages", "design-tokens", "src", "tokens.css"), "utf8");

/** Hand-written offset shadows that may stay, per file: how many, and why. */
const ALLOWED: Record<string, [number, string]> = {
  "app/admin/_review/review.css": [1, "glow: the review button's bloom in its own action colour (`--rv-btn`)"],
  "app/css/auth.css": [5, "the founder's restoration (7 October 2026): the login, sign-up and passcode screens back exactly as they were before the redesign: the focused field's halo and the slate's own glows, as drawn then"],
  "app/css/brand-glass.css": [1, "a night island's lift on its own artwork ink; on Paper a rung would resolve to the island's night value, so it waits for a Paper rung a dark scope can read"],
  "app/css/chips.css": [1, "glow: the lit pinned bar casts upward into the content above it (it stands on the bottom edge, as a sheet does)"],
  "app/css/chrome.css": [1, "glow: the legacy dock capsule's blue under-light"],
  "app/css/landing-rooms.css": [1, "glow: the landing stack's brand light"],
  "app/css/landing-plasma.css": [4, "glows (P7, the Plasma pass): the white capsule's own light at rest and on hover, the deal story phone's brand under-light, and the close mark's brand bloom"],
  "app/css/landing.css": [2, "glow: the landing's lit primary, rest and hover (the view's one primary)"],
  "app/css/light.css": [9, "glows on Paper in brand ink (the lit chip, tiles, the profile ring and its contact, the hero chips) and the two night islands on Paper (home top, hero band), which wait for a Paper rung a dark scope can read"],
  "app/css/money-surface.css": [1, "glow: the processor's brand mark lit in its own blue"],
  "app/css/money-wallet.css": [2, "glows (the founder's Wallet ruling, 8 October 2026): the wallet card's tight contact shadow in its own navy (no spreading glow), and the Withdraw capsule's bloom in its own blue; everything else reads the elevation rungs"],
  "app/css/shell-m.css": [3, "glows: the side rail's sideways edge light, the dock plus's brand bloom and its rim"],
  "app/css/site.css": [2, "glow: the site's lit primary and its chip in brand ink"],
  "components/social/circle/circle-visuals.css": [1, "the Circle mark's brand bloom on the banner (a glow, the banner's one coloured light)"],
  /* PENDING: files that carry another agent's uncommitted work right now. */
  "app/social-feed.css": [3, "PENDING: two photo-overlay lifts (onto `--nf-elevation-floating`) and a brand bloom"],
  "app/social.css": [2, "PENDING: a photo-overlay lift and a glow"],
  "app/social.shared.css": [1, "PENDING: the avatar's lift (onto `--nf-elevation-raised`)"],
};

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "");
const layers = (value: string) => {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
};
const COLOUR = /(rgba?\([^)]*\)|hsla?\([^)]*\)|color-mix\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)|var\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b|\btransparent\b|\bcurrentcolor\b|\bblack\b|\bwhite\b)/gi;

/** The outer shadow layers with an offset and a blur, i.e. a light falling somewhere. */
function castLayers(value: string): string[] {
  return layers(value).filter((layer) => {
    if (/\binset\b/i.test(layer) || /^var\([^()]*\)$/.test(layer) || /^none$/i.test(layer)) return false;
    const nums = [...layer.replace(COLOUR, " ").matchAll(/(-?[\d.]+)(px|rem|em)?/g)].map((m) => parseFloat(m[1]!));
    if (nums.length < 3) return false;
    const [x, y, blur] = nums as [number, number, number];
    return (x !== 0 || y !== 0) && blur > 0;
  });
}

/** Every declaration of a shadow in a stylesheet: `box-shadow`, and custom properties that hold one. */
function shadowValues(css: string): string[] {
  const out: string[] = [];
  for (const m of strip(css).matchAll(/(?:^|[;{\s])(box-shadow|--[a-z0-9-]*(?:shadow|drop|lift|elev|bloom)[a-z0-9-]*)\s*:\s*([^;{}]+)/gi)) {
    if (m[1]!.startsWith("--") && !/\d(?:px|rem)/.test(m[2]!)) continue;
    out.push(m[2]!);
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

/** The bodies of the Paper blocks: every rule whose selector list opens with `:root[data-theme="light"]`. */
function paperBlocks(css: string): string[] {
  const body = strip(css);
  const out: string[] = [];
  for (const m of body.matchAll(/(^|\n):root\[data-theme="light"\],[^{]*\{([^{}]*)\}/g)) out.push(m[2]!);
  return out;
}

describe("one elevation scale", () => {
  const body = strip(TOKENS);

  it("the old rungs are names for the four levels, defined once", () => {
    const want: Record<string, string> = {
      "--nf-elev-1": "raised",
      "--nf-elev-2": "floating",
      "--nf-elev-3": "floating",
      "--nf-elev-4": "dialog",
      "--nf-elev-5": "dialog",
    };
    for (const [name, level] of Object.entries(want)) {
      const defs = [...body.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "g"))].map((m) => m[1]!.trim());
      expect(defs, name).toEqual([`var(--nf-elevation-${level})`]);
    }
  });

  it("the glass, the float and the secondary's shadow read a level", () => {
    expect(body).toContain("--nf-glass-shadow-thin: var(--nf-elevation-raised);");
    expect(body).toContain("--nf-glass-shadow: var(--nf-elevation-raised);");
    expect(body).toContain("--nf-glass-shadow-lifted: var(--nf-elevation-dialog);");
    expect(body.match(/--nf-float-shadow: var\(--nf-elevation-raised\);/g)).toHaveLength(2);
    expect(body).toContain("--nf-btn-glass-shadow: var(--nf-elevation-raised);");
  });
});

describe("one ink per theme", () => {
  it("every outer shadow on Paper is the blue ink or the contact ink", () => {
    const blocks = paperBlocks(TOKENS);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const inks = new Set<string>();
    for (const block of blocks) {
      for (const value of shadowValues(block)) {
        for (const layer of castLayers(value)) {
          for (const m of layer.matchAll(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/g)) inks.add(`${m[1]} ${m[2]} ${m[3]}`);
        }
      }
    }
    expect([...inks].sort()).toEqual(["0 95 232", "1 1 24"]);
  });
});

describe("nobody writes an elevation by hand", () => {
  it("outside tokens.css every cast shadow is a listed glow or listed pending work", () => {
    const counts: Record<string, number> = {};
    for (const file of walk(SRC)) {
      const n = shadowValues(readFileSync(file, "utf8")).reduce((sum, value) => sum + castLayers(value).length, 0);
      if (n) counts[relative(SRC, file)] = n;
    }
    const over = Object.entries(counts)
      .filter(([file, n]) => n > (ALLOWED[file]?.[0] ?? 0))
      .map(([file, n]) => `${file}: ${n} cast shadow layer(s), ${ALLOWED[file]?.[0] ?? 0} allowed`);
    expect(over, "pick an elevation rung (`var(--nf-elevation-raised)` and the rest), or list a glow here with its reason").toEqual([]);
  });

  it("the detector counts a light, not a hairline, a ring or a rim", () => {
    expect(castLayers("0 8px 24px -8px var(--nf-shade-3), 0 1px 0 var(--nf-divider)")).toHaveLength(1);
    expect(castLayers("inset 0 1px 0 var(--nf-glass-rim), 0 0 0 1px var(--nf-glow-2), 0 0 18px var(--nf-glow-3)")).toHaveLength(0);
    expect(castLayers("var(--nf-elevation-raised)")).toHaveLength(0);
    expect(shadowValues(".a { --nf-dock-drop: 0 14px 34px -14px var(--nf-shade-3); }")).toHaveLength(1);
  });
});
