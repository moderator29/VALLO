import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CORNERS THAT AGREE (CRAFT_DOCTRINE 3, "corner radii that agree"; north star
 * 4 and 5A; CRAFT-PRINCIPLES 1.4 and 2.4; Session 3 round 5, W1).
 *
 * The product had 100 distinct radius values and 40 radius token names for
 * about nine real corners. Held here:
 *
 *   1. every radius token in tokens.css, followed through its aliases, lands
 *      on the scale: 0, 6, 10, 14, 18, 22, 28 (the Island, now named), 32,
 *      the pill, the circle, and the icon tile's 26% superellipse;
 *   2. the nested rule is a token: `--nf-radius-inner`, stated by a container
 *      for the children it holds (inner = outer less the inset);
 *   3. outside tokens.css no corner is written as a raw length, in a
 *      stylesheet or in a Tailwind `rounded-[...]`, except a SHAPE (the bowl,
 *      the door's arch) or work listed as pending in another agent's file;
 *      a `var()` fallback counts, because a stale fallback is a raw corner
 *      waiting for a typo in the name (one was: `--nf-radius-plate-lg`).
 */
const SRC = join(__dirname, "..", "..");
const TOKENS = readFileSync(join(SRC, "..", "..", "..", "packages", "design-tokens", "src", "tokens.css"), "utf8");

const SCALE = new Set(["0", "6px", "10px", "14px", "18px", "22px", "28px", "32px", "999px", "50%", "26%"]);

/** Raw corners that may stay, per file: how many, and why. */
const ALLOWED: Record<string, [number, string]> = {
  "app/css/auth.css": [2, "the bowl is a shape (an ellipse on its lower edge), not a corner; the field halo is the control's corner plus the halo's 4px gap (the nested rule, outward)"],
  "app/css/threshold.css": [1, "the door's arch is a shape that scales with the viewport"],
  "app/css/passcode.css": [1, "the founder's restoration (7 October 2026): the login, sign-up and passcode screens back exactly as they were before the redesign: the dome across the top is a shape (an ellipse on its lower edge), not a corner"],
};
const ALLOWED_TSX: Record<string, [number, string]> = {
  "components/verification/SelfieCapture.tsx": [1, "the oval face guide over the camera is a shape (an ellipse the face fits inside), not a corner"],
  "components/ui/charts/Bars.tsx": [2, "a 2px corner on an 8px bar: the smallest rung would make it a pill, and the component refuses a pill on purpose (a pill reads as a control)"],
};

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "");
const px = (value: string) => {
  const m = value.trim().match(/^(-?[\d.]+)(px|rem|%)?$/);
  if (!m) return null;
  if (m[2] === "%") return `${m[1]}%`;
  const n = parseFloat(m[1]!) * (m[2] === "rem" ? 16 : 1);
  return n === 0 ? "0" : `${n}px`;
};
const RAW = /(?<![\w-])-?[\d.]+(?:px|rem|em|%|vw|vh|svh|dvh)(?![\w-])/;

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, out);
    else if (entry.name.endsWith(ext) && !entry.name.includes(".test.")) out.push(full);
  }
  return out;
}

/** Every corner declaration in a stylesheet whose value carries a raw length. */
function rawCorners(css: string): string[] {
  const out: string[] = [];
  for (const m of strip(css).matchAll(/(?:^|[;{\s])((?:border(?:-[a-z]+){0,2}-radius)|--[a-z0-9-]*radius[a-z0-9-]*)\s*:\s*([^;{}]+)/g)) {
    if (RAW.test(m[2]!)) out.push(`${m[1]}: ${m[2]!.trim()}`);
  }
  return out;
}

describe("the radius scale", () => {
  const body = strip(TOKENS);
  const defs = new Map<string, string>();
  for (const m of body.matchAll(/(--nf-[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) if (!defs.has(m[1]!)) defs.set(m[1]!, m[2]!.trim());
  const resolve = (value: string, depth = 0): string | null => {
    const alias = value.match(/^var\((--[a-z0-9-]+)\)$/);
    if (alias) return depth > 8 || !defs.has(alias[1]!) ? null : resolve(defs.get(alias[1]!)!, depth + 1);
    return px(value);
  };

  it("every radius token lands on a rung", () => {
    const off: string[] = [];
    for (const [name, value] of defs) {
      if (!/radius/.test(name) || name === "--nf-radius-inner") continue;
      const corners = value.split(/\s+(?![^(]*\))/);
      for (const corner of corners) {
        const r = resolve(corner);
        if (r === null || !SCALE.has(r)) off.push(`${name}: ${value}`);
      }
    }
    expect(off).toEqual([]);
  });

  it("names the Island rung and states the nested rule", () => {
    expect(body).toContain("--nf-radius-island: 28px;");
    expect(body).toContain("--nf-tier-island-radius: var(--nf-radius-island);");
    expect(body).toContain("--nf-radius-inner: var(--nf-radius-xs);");
    /* Applied where a track holds a segment: the option is the track less its inset. */
    const theme = strip(readFileSync(join(SRC, "app", "css", "theme-control.css"), "utf8"));
    expect(theme).toContain("--nf-radius-inner: max(var(--nf-radius-xs), calc(var(--nf-radius-control) - var(--nf-space-3xs)));");
    expect(theme).toContain("border-radius: var(--nf-radius-inner);");
  });
});

describe("no raw corner outside the scale", () => {
  it("in any stylesheet", () => {
    const over: string[] = [];
    for (const file of walk(SRC, ".css")) {
      const rel = relative(SRC, file);
      const found = rawCorners(readFileSync(file, "utf8"));
      if (found.length > (ALLOWED[rel]?.[0] ?? 0)) over.push(`${rel}: ${found.join(" | ")}`);
    }
    expect(over, "use a rung (`var(--nf-radius-xs)` and the rest) or `var(--nf-radius-inner)`").toEqual([]);
  });

  it("in any component's Tailwind corner", () => {
    const over: string[] = [];
    for (const file of walk(SRC, ".tsx")) {
      const rel = relative(SRC, file);
      const found = [...readFileSync(file, "utf8").matchAll(/\brounded(?:-[a-z]{1,2})?-\[([^\]]+)\]/g)].filter((m) => RAW.test(m[1]!.replace(/var\([^)]*\)/g, "")));
      if (found.length > (ALLOWED_TSX[rel]?.[0] ?? 0)) over.push(`${rel}: ${found.map((m) => m[0]).join(" ")}`);
    }
    expect(over).toEqual([]);
  });

  it("the detector sees what it is meant to see", () => {
    expect(rawCorners(".a { border-radius: 3px; }")).toHaveLength(1);
    expect(rawCorners(".a { border-radius: var(--nf-radius-sm, 10px); }")).toHaveLength(1);
    expect(rawCorners(".a { border-top-left-radius: 0.375rem; --nf-x-radius: 20px; }")).toHaveLength(2);
    expect(rawCorners(".a { border-radius: var(--nf-radius-xs) var(--nf-radius-xs) 0 0; }")).toHaveLength(0);
    expect(rawCorners(".a { border-radius: var(--nf-radius-inner); }")).toHaveLength(0);
  });
});
