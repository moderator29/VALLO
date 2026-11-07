import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO BLACK BUTTONS (founder, 7 November 2026). A selected chip, tab or
 * segment is Vallo blue (the primary button's fill and ink), an unselected
 * one the soft surface; a text button is never filled with the ink. The feed's
 * live "For you" chip was the ink fill (`--nf-content-primary`), which reads
 * as a black slab in light mode and a white one in dark.
 *
 * This reads every stylesheet under `src`, and for every rule whose selector
 * names a control (chip, tab, segment, pill, button, toggle, option, choice)
 * it refuses a fill made of the ink, the inverse surface, or a raw black or
 * near-black colour. A tint mixed with transparent (a hover wash) is not a
 * fill and passes.
 */
const SRC = join(process.cwd(), "src");
function sheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sheets(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

const CONTROL = /(chip|tab(?!le)|seg|pill|btn|button|toggle|option|choice)(?![\w-]*(thumb|dot|track|tip|count|badge|icon|plate|glyph|readout))[\w-]*\s*(?:[:[.,{]|$)/i;
const INK_FILL =
  /^(var\(--nf-(content-primary|surface-inverse|content-inverse)\)|#0{3}\b|#000000|black|rgb\(0[ ,]+0[ ,]+0\)|#0[0-9a-f]{5}\b|#1[0-2][0-9a-f]{4}\b)/i;

/* Not controls: the connection strip is a status line (Agent NATIVE's,
   `components/app/offline`), read only, with no tap. */
const ALLOWED = [".nf-connection__pill"];

export function blackControlFills(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  for (const rule of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].replace(/\s+/g, " ").trim();
    if (selector.startsWith("@")) continue;
    const last = selector.split(",").map((part) => part.trim().split(/\s|>/).pop() ?? "");
    const stateful = /\[aria-(current|selected|pressed|checked)/.test(selector);
    if (!stateful && !last.some((part) => CONTROL.test(part + " "))) continue;
    if (ALLOWED.some((name) => selector.includes(name))) continue;
    for (const decl of rule[2].matchAll(/background(?:-color)?\s*:\s*([^;]+);?/g)) {
      if (INK_FILL.test(decl[1].trim())) found.push(`${selector} -> ${decl[1].trim()}`);
    }
  }
  return found;
}

describe("no black buttons", () => {
  it("knows an ink fill on a chip when it sees one", () => {
    expect(blackControlFills('.nf-chip[aria-current="page"] { background: var(--nf-content-primary); }')).toHaveLength(1);
    expect(blackControlFills(".nf-btn--dark { background: #0B0D14; }")).toHaveLength(1);
    expect(blackControlFills('.nf-feed-cat[aria-current="page"] { background: var(--nf-content-primary); }')).toHaveLength(1);
    expect(blackControlFills(".nf-chip:hover { background: color-mix(in oklab, var(--nf-content-primary) 8%, transparent); }")).toEqual([]);
    expect(blackControlFills(".nf-chip[aria-current] { background: var(--nf-act-fill); }")).toEqual([]);
  });

  it("finds no control in any stylesheet filled with the ink or near black", () => {
    const offenders = sheets(SRC).flatMap((file) =>
      blackControlFills(readFileSync(file, "utf8")).map((hit) => `${file.slice(SRC.length + 1)}: ${hit}`),
    );
    expect(offenders).toEqual([]);
  });
});
