import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * WALKING THE SOURCE FOR FIELDS THAT TELL THE KEYBOARD NOTHING.
 *
 * Shared with the guard test (`keyboard-hints.guard.test.ts`), in the shape
 * of `components/ui/hand-rolled-sheets.test.ts`: a list that may only shrink.
 *
 * A tag is read with a brace-aware scan rather than a regular expression,
 * because `onChange={(e) => ...}` holds a `>` and a naive pattern cuts the
 * tag in half there (it did, on 14 November 2026, and wrote attributes into
 * the middle of an arrow function in 62 files).
 */

export const KEYBOARD_ATTRS = [
  "inputMode",
  "enterKeyHint",
  "autoComplete",
  "autoCapitalize",
  "autoCorrect",
  "spellCheck",
] as const;

/**
 * Types that carry their own control and need none of the above: a date
 * picker, a file picker, a checkbox, a button. A `type` given as an
 * expression is not read here, so such a field is simply not counted.
 */
const OWN_CONTROL =
  /type=\{?["']?(hidden|file|checkbox|radio|range|color|date|time|datetime-local|month|week|submit|button|image)/;

/** The index of the `>` that closes the tag opened at `from`, or -1. */
export function tagEnd(code: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  return -1;
}

export function filesWithFields(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      /* The preview harness draws fixtures, and the console is dark-only
         staff software with its own owner. */
      if (name !== "(dev)" && name !== "admin") filesWithFields(path, out);
    } else if (path.endsWith(".tsx") && !path.includes(".test.")) out.push(path);
  }
  return out;
}

/** Every file holding a field that sets none of the keyboard attributes. */
export function filesWithSilentFields(src: string): string[] {
  const found = new Set<string>();
  for (const path of filesWithFields(src)) {
    const code = readFileSync(path, "utf8");
    const open = /<(input|textarea)(?=[\s/>])/g;
    let m: RegExpExecArray | null;
    while ((m = open.exec(code))) {
      const end = tagEnd(code, m.index + m[0].length);
      if (end < 0) continue;
      open.lastIndex = end;
      const attrs = code.slice(m.index + m[0].length, code[end - 1] === "/" ? end - 1 : end);
      if (OWN_CONTROL.test(attrs)) continue;
      /* A spread is NOT an excuse: `{...rest}` may carry the hints and may
         not, and the one field that legitimately computes them (the shared
         `Field`) is named in the test's list instead, where it can be read. */
      if (KEYBOARD_ATTRS.some((attr) => new RegExp(`\\b${attr}\\s*=`).test(attrs))) continue;
      found.add(relative(src, path).split("\\").join("/"));
    }
  }
  return [...found].sort();
}
