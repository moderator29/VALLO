import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY CURVE IS A NAMED CURVE (MOTION_SYSTEM section 0, "five eases, named",
 * plus `whip`; CRAFT_DOCTRINE 5, "easing that is not the browser default";
 * CRAFT-PRINCIPLES 2.1; Session 3 round 5, W1).
 *
 * Held here, for every stylesheet under `src` (tokens.css is where the curves
 * are defined, so it is the one file not read):
 *
 *   1. no bare `ease`, `ease-in`, `ease-out` or `ease-in-out`;
 *   2. no timed transition or animation without a curve, which is `ease` by
 *      default (a `0s` flip and a discrete property have no curve to choose);
 *   3. no `cubic-bezier()` literal: a curve is a token;
 *   4. `linear` only where linear is the truth, each file named with why
 *      (honest progress, a constant rotation, a sweep, a scroll-driven
 *      timeline where the finger is the easing);
 *
 * and for every component: no Tailwind `ease-*` or numeric `duration-*`
 * utility (Tailwind's own curves and numbers, not ours) and no WAAPI
 * `easing` keyword. The Tailwind theme's own `ease-*` and default transition
 * are pointed at the tokens (theme.css), so a plain `transition` utility is
 * on the ladder too.
 */
const SRC = join(__dirname, "..", "..");

/** `linear` may stay here, and only here. Count per file. */
const LINEAR: Record<string, [number, string]> = {
  "app/css/animation.css": [1, "the undo window drains at the speed of the real clock (honest progress)"],
  "app/css/controls.css": [1, "the skeleton's sweep crosses at one speed (four passes, then still)"],
  "app/social.css": [1, "the social slab's skeleton sweep, the same as controls.css"],
  "app/css/detail-m.css": [3, "scroll-driven timelines: scroll is the clock and the finger is the easing"],
  "app/css/feed-m.css": [3, "scroll-driven timelines (the post, its parts, the parallax), as detail-m.css"],
  "app/css/chrome.css": [1, "the large title's fold is a scroll-driven timeline over the first 56px"],
  "app/css/landing.css": [1, "the hero parallax is a scroll-driven timeline"],
  "app/css/landing-rooms.css": [3, "the steps' draw is a view timeline (scroll is the clock)"],
  "app/css/landing-3d.css": [2, "the object's pop rides the steps' view timeline; the hero objects' drift is a scroll timeline"],
  "app/css/landing-plasma.css": [4, "the deal story's stack (P7): the covered card sinks and dims and the fragment breaks out on view and scroll timelines (scroll is the clock)"],
  "app/css/motion.css": [1, "the card entry is a view timeline (scroll is the clock)"],
  "app/css/edge-m.css": [3, "the edge light's runners travel the rim at constant speed (two laps)"],
  "app/css/light.css": [1, "the logo's rim light turns at constant speed (two laps)"],
  "app/css/shell-m.css": [1, "the dock plus's rim light turns at constant speed (two laps)"],
  "app/css/site.css": [1, "the edge lap's light turns at constant speed (two laps)"],
  "app/css/symbols.css": [1, "the opt-in symbol loop turns at constant speed (three turns)"],
  "app/css/member-kit.css": [1, "the story progress fill tracks the real duration (MOTION_SYSTEM: story progress is linear)"],
};

const DISCRETE = /^(visibility|content-visibility|display|white-space|overlay|--[a-z0-9-]+)\b/;
const CURVE = /cubic-bezier|steps\(|\blinear\b|(?<![-\w])ease(?:-in|-out|-in-out)?(?![-\w])|step-(?:start|end)|var\(--[a-z0-9-]*(?:ease|curve|spring)[a-z0-9-]*/;
const TIME = /(?:^|\s)(?:-?[\d.]+m?s|var\(--[a-z0-9-]*(?:duration|lap|window|speed)[^)]*\)\)?)/;

/* A 0s flip held to the end of a delay, or the 1ms snap reduced motion uses: no curve to choose. */
const INSTANT = /^\S+\s+(?:0m?s|1ms)\b/;

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "");
const items = (value: string) => {
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

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, out);
    else if (entry.name.endsWith(ext) && !entry.name.includes(".test.")) out.push(full);
  }
  return out;
}

type Finding = { kind: "bare-ease" | "no-curve" | "bezier" | "linear"; item: string };

function audit(css: string): Finding[] {
  const found: Finding[] = [];
  const body = strip(css);
  for (const m of body.matchAll(/(?:^|[;{\s])(transition|animation|transition-timing-function|animation-timing-function)\s*:\s*([^;{}]+)/g)) {
    const prop = m[1]!;
    for (const item of items(m[2]!)) {
      if (/^(?:none|inherit|initial|unset)$/.test(item) || /^var\([^()]*\)$/.test(item)) continue;
      if (/(?<![-\w])ease(?:-in|-out|-in-out)?(?![-\w])/.test(item)) found.push({ kind: "bare-ease", item });
      if (/cubic-bezier\(/.test(item)) found.push({ kind: "bezier", item });
      if (/(?<![-\w])linear(?![-\w(])/.test(item) && !INSTANT.test(item)) found.push({ kind: "linear", item });
      if (prop.endsWith("timing-function")) continue;
      const flip = INSTANT.test(item) || /allow-discrete/.test(item) || (prop === "transition" && DISCRETE.test(item));
      if (!flip && TIME.test(item) && !CURVE.test(item)) found.push({ kind: "no-curve", item });
    }
  }
  return found;
}

/* The founder asked (7 October 2026) for the pre-redesign login, sign-up,
   passcode and welcome screens back exactly as they were; these sheets are
   that restoration and keep their own curves. */
const RESTORED_SHEETS = new Set(["app/welcome/onboarding-motion.css"]);

describe("the curves in the stylesheets", () => {
  const sheets = walk(SRC, ".css").map((file) => [relative(SRC, file), audit(readFileSync(file, "utf8"))] as const);

  it("never fall back to the browser's ease, written or by default", () => {
    const wrong = sheets.flatMap(([file, found]) =>
      RESTORED_SHEETS.has(file)
        ? []
        : found.filter((f) => f.kind === "bare-ease" || f.kind === "no-curve").map((f) => `${file}: ${f.item}`),
    );
    expect(wrong).toEqual([]);
  });

  it("never write a cubic-bezier by hand: the curve is a token", () => {
    const wrong = sheets.flatMap(([file, found]) => found.filter((f) => f.kind === "bezier").map((f) => `${file}: ${f.item}`));
    expect(wrong).toEqual([]);
  });

  it("move linearly only where linear is the truth", () => {
    const counts: Record<string, number> = {};
    for (const [file, found] of sheets) {
      const n = found.filter((f) => f.kind === "linear").length;
      if (n) counts[file] = n;
    }
    for (const [file, n] of Object.entries(counts)) {
      expect(LINEAR[file], `${file} moves linearly; use a named curve, or list it with its reason`).toBeDefined();
      expect(n, `${file}: more linear motion than its listed reason covers`).toBeLessThanOrEqual(LINEAR[file]![0]);
    }
  });

  it("the audit sees what it is meant to see", () => {
    const kinds = (css: string) => audit(css).map((f) => f.kind);
    expect(kinds(".a { transition: opacity 160ms ease; }")).toEqual(["bare-ease"]);
    expect(kinds(".a { transition: opacity 160ms; }")).toEqual(["no-curve"]);
    expect(kinds(".a { transition: opacity var(--nf-duration-fast); }")).toEqual(["no-curve"]);
    expect(kinds(".a { animation: nf-x 300ms both; }")).toEqual(["no-curve"]);
    expect(kinds(".a { transition: opacity var(--nf-duration-fast) var(--nf-ease-standard); }")).toEqual([]);
    expect(kinds(".a { transition: visibility 0s linear 240ms, --nf-x 380ms var(--nf-ease-exit); }")).toEqual([]);
    expect(kinds(".a { transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1); }")).toEqual(["bezier"]);
    expect(kinds(".a { transition: opacity var(--nf-duration-fast) linear; }")).toEqual(["linear"]);
    expect(kinds(".a { transition-timing-function: ease-out; }")).toEqual(["bare-ease"]);
  });
});

describe("the curves in the components", () => {
  /* Comments stripped: a sentence about `ease-out` is not a use of it. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  const files = [...walk(SRC, ".tsx"), ...walk(SRC, ".ts")].map((file) => [relative(SRC, file), code(readFileSync(file, "utf8"))] as const);

  it("use no Tailwind ease-* or numeric duration-* utility (Tailwind's numbers, not ours)", () => {
    const wrong = files
      .flatMap(([file, text]) => [...text.matchAll(/(?<![\w[-])(?:ease-(?:in|out|in-out|linear)|duration-\d+)(?![\w-])/g)].map((m) => `${file}: ${m[0]}`));
    expect(wrong).toEqual([]);
  });

  it("give WAAPI and inline transitions a token curve, never a keyword", () => {
    const wrong = files.flatMap(([file, text]) => [
      ...[...text.matchAll(/easing:\s*["'`](?:ease|ease-in|ease-out|ease-in-out)["'`]/g)].map((m) => `${file}: ${m[0]}`),
      ...[...text.matchAll(/\|\|\s*["'`](?:ease|ease-in|ease-out|ease-in-out|linear)["'`]/g)].map((m) => `${file}: ${m[0]}`),
      ...[...text.matchAll(/transition\s*=\s*["'`][^"'`]*cubic-bezier\(/g)].map((m) => `${file}: ${m[0]}`),
    ]);
    expect(wrong).toEqual([]);
  });

  it("linear in script is a real clock, and only there", () => {
    const linear = files.filter(([, text]) => /easing:\s*["'`]linear["'`]/.test(text)).map(([file]) => file);
    /* No script moves linearly: the resend countdown that did was part of
       the redesigned sign-in, which the founder rolled back (7 October). */
    expect(linear).toEqual([]);
  });
});

describe("the Tailwind theme speaks the ladder", () => {
  const theme = strip(readFileSync(join(SRC, "app", "css", "theme.css"), "utf8"));

  it("points Tailwind's curves and its default transition at the tokens", () => {
    expect(theme).toContain("--ease-in: var(--nf-ease-exit);");
    expect(theme).toContain("--ease-out: var(--nf-ease-entrance);");
    expect(theme).toContain("--ease-in-out: var(--nf-ease-standard);");
    expect(theme).toContain("--default-transition-duration: var(--nf-duration-fast);");
    expect(theme).toContain("--default-transition-timing-function: var(--nf-ease-standard);");
  });
});
