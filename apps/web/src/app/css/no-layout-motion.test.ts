import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NOTHING ANIMATES LAYOUT (MOTION_SYSTEM principle 6; CRAFT-PRINCIPLES 2.2;
 * Session 3 round 5, W1). A transition or an animation on width, height, top,
 * left, margin, padding or font-size re-lays out the page on every frame it
 * runs, which on a budget Android is the stutter the founder named. Transform
 * and opacity reach the same look on the compositor.
 *
 * This reads every stylesheet under `src` and the tokens, and every `.tsx`
 * for Tailwind's `transition-[...]` and inline transition strings. A layout
 * property that moves fails here unless it is listed below with its reason.
 * A `0s` item is a discrete flip held to the end of a delay (one layout, not
 * one per frame), so it is not motion and is not counted.
 */
const SRC = join(__dirname, "..", "..");
const TOKENS = join(SRC, "..", "..", "..", "packages", "design-tokens", "src", "tokens.css");

const LAYOUT =
  /^(?:(?:min-|max-)?(?:width|height|inline-size|block-size)|top|left|right|bottom|inset(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|font-size|all)$/;

/** Each entry: `file property` (file relative to src) and why it may move. */
const ALLOWED: Record<string, string> = {
  "app/css/motion-kit.css height":
    "`::details-content` with interpolate-size: a disclosure the reader opened, once per tap, where the content below must move; never on a list or a scroll",
  "app/css/list-group.css block-size": "the same disclosure technique on `.nf-disclosure` (settings and help rows), once per tap",
  "app/css/auth.css height": "the founder's restoration (7 October 2026): the login, sign-up and passcode screens back exactly as they were before the redesign",
  "app/css/auth.css margin-top": "the founder's restoration (7 October 2026): the login, sign-up and passcode screens back exactly as they were before the redesign",
  "app/css/auth.css font-size": "the founder's restoration (7 October 2026): the login, sign-up and passcode screens back exactly as they were before the redesign",
  "app/welcome/onboarding-motion.css width":
    "the onboarding upgrade (8-9 November 2026): the iOS-style page-indicator dot morphs its width into a short pill, and the thin step progress bar fills by width; both are tiny, isolated pieces off any list or scroll, and both go still under reduced motion, Calm and Off",
};

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
/** The first time in a transition item is its duration; `0s` or `0ms` is a held flip. */
const isFlip = (item: string) => /^\S+\s+0m?s\b/.test(item);

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, out);
    else if (entry.name.endsWith(ext) && !entry.name.includes(".test.")) out.push(full);
  }
  return out;
}

/** Every `file property` pair where a layout property moves. */
export function layoutMotion(css: string): string[] {
  const body = strip(css);
  const found: string[] = [];
  for (const m of body.matchAll(/(?:^|[;{\s])(transition|transition-property)\s*:\s*([^;{}]+)/g)) {
    for (const item of items(m[2]!)) {
      const prop = item.split(/\s+/)[0]!.toLowerCase();
      if (m[1] === "transition" && isFlip(item)) continue;
      if (LAYOUT.test(prop)) found.push(prop);
    }
  }
  for (const m of body.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) {
    for (const d of m[1]!.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:/g)) {
      if (LAYOUT.test(d[1]!) && d[1] !== "all") found.push(`@keyframes ${d[1]}`);
    }
  }
  return found;
}

export function layoutMotionTsx(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/\btransition-\[([^\]]+)\]/g)) {
    for (const prop of m[1]!.split(",")) if (LAYOUT.test(prop.trim())) found.push(prop.trim());
  }
  if (/\btransition-all\b/.test(source)) found.push("all");
  for (const m of source.matchAll(/transition(?:Property)?\s*[:=]\s*["'`]([^"'`]+)["'`]/g)) {
    for (const item of items(m[1]!)) {
      const prop = item.split(/\s+/)[0]!.toLowerCase();
      if (!isFlip(item) && LAYOUT.test(prop)) found.push(prop);
    }
  }
  return found;
}

describe("no layout property is animated", () => {
  it("in any stylesheet, except the listed disclosures", () => {
    const found = new Set<string>();
    for (const file of [...walk(SRC, ".css"), TOKENS]) {
      const rel = file === TOKENS ? "tokens.css" : relative(SRC, file);
      for (const prop of layoutMotion(readFileSync(file, "utf8"))) found.add(`${rel} ${prop}`);
    }
    const unlisted = [...found].filter((key) => !(key in ALLOWED));
    expect(unlisted, "a layout property moves; animate transform or opacity instead, or list it here with its reason").toEqual([]);
  });

  it("in any component's Tailwind utilities or inline transitions", () => {
    const found: string[] = [];
    for (const file of walk(SRC, ".tsx")) {
      for (const prop of layoutMotionTsx(readFileSync(file, "utf8"))) found.push(`${relative(SRC, file)} ${prop}`);
    }
    expect(found).toEqual([]);
  });

  it("the detector sees what it is meant to see", () => {
    expect(layoutMotion(".a { transition: max-width 240ms ease, opacity 160ms ease; }")).toEqual(["max-width"]);
    expect(layoutMotion(".a { transition: max-width 0s linear 240ms, opacity 160ms ease; }")).toEqual([]);
    expect(layoutMotion(".a { transition-property: top, left; }")).toEqual(["top", "left"]);
    expect(layoutMotion("@keyframes x { from { height: 0; } to { height: 10px; } }")).toEqual(["@keyframes height", "@keyframes height"]);
    expect(layoutMotion(".a { transition: --nf-cap-now 380ms ease, translate 380ms ease; }")).toEqual([]);
    expect(layoutMotionTsx('<i className="transition-[width] duration-300" />')).toEqual(["width"]);
    expect(layoutMotionTsx('<i className="transition-[left] transition-transform" />')).toEqual(["left"]);
  });
});
