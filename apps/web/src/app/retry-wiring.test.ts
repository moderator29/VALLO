import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY ERROR BOUNDARY'S TRY AGAIN RE-FETCHES (13 November 2026, the founder:
 * "all try again button don't use to work it's just like a dead button").
 *
 * In Next 16.3+ `reset()` only clears a boundary's error and redraws from what
 * the client already holds; it never asks the server again, so a Server
 * Component that failed stayed failed. `retry()` refreshes and then resets
 * (next/dist/client/components/error-boundary.js). Every Try again, every
 * `onRetry`, every `useSignalHold` (whose timed tries call it) and every way
 * home on a failure screen must therefore be handed `retry ?? reset`, named
 * `again` in every boundary, and never `reset` itself. The behaviour is proven
 * in a browser in `retry-boundaries.dom.test.tsx`; this is the gate that keeps
 * a new boundary, or an edit to an old one, from wiring `reset` again.
 *
 * It also keeps every way out of a failure screen alive: a link there goes
 * through `escapeTo(href, again)` (lib/offline/escape.ts), which tries the page
 * again when the link points at the page already on screen and does a full
 * load otherwise. `global-error.tsx` draws a plain `<a>`, which is already a
 * full load, and is checked for that instead.
 */
const APP = __dirname;
const SHARED = join(APP, "..", "components", "app", "inspections", "visit", "VisitStates.tsx");

function boundaries(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "(dev)") continue;
      out.push(...boundaries(path));
    } else if (name === "error.tsx" || name === "global-error.tsx") {
      out.push(path);
    }
  }
  return out;
}

/** The source with comments removed, so a comment that quotes old wiring is not a hit. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const FILES = boundaries(APP);

/** Where `reset` may legitimately appear: the props, their type, and `retry ?? reset`. */
function strayResets(source: string): string[] {
  const rest = source
    .replace(/\breset\s*:\s*\(\)\s*=>\s*void/g, "")
    .replace(/\bretry\s*\?\?\s*reset\b/g, "")
    .replace(/\{\s*error\s*,\s*reset\s*,\s*retry\s*\}/g, "")
    .replace(/^\s*reset,\s*$/gm, "");
  return rest.split("\n").filter((line) => /\breset\b/.test(line)).map((line) => line.trim());
}

describe("error boundaries wire Try again to retry, never to reset", () => {
  it("finds the boundaries", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(10);
    expect(FILES.some((f) => f.endsWith("global-error.tsx"))).toBe(true);
  });

  it.each(FILES.map((f) => [relative(APP, f), f]))("%s takes retry and hands on retry ?? reset", (_name, path) => {
    const source = code(path);
    if (/<VisitError \{\.\.\.props\} \/>/.test(source)) {
      /* Delegates to the shared visit failure; its props type must carry retry so it is not dropped. */
      expect(source).toMatch(/retry\?: \(\) => void/);
      return;
    }
    expect(source).toMatch(/\bretry\?: \(\) => void/);
    expect(source).toMatch(/const again = retry \?\? reset;/);
    expect(strayResets(source)).toEqual([]);
  });

  it("the shared visit failure does the same", () => {
    const source = code(SHARED);
    const fn = source.slice(source.indexOf("export function VisitError"));
    expect(fn).toMatch(/const again = retry \?\? reset;/);
    expect(strayResets(fn)).toEqual([]);
  });

  it("the gate catches the old wiring", () => {
    expect(strayResets(`const hold = useSignalHold(error, reset);`)).toHaveLength(1);
    expect(strayResets(`<Button onClick={reset}>Try again</Button>`)).toHaveLength(1);
    expect(strayResets(`<SignalHold tries={1} onRetry={reset} />`)).toHaveLength(1);
    expect(strayResets(`{ label: "Try again", onClick: reset, tone: "primary" }`)).toHaveLength(1);
    expect(strayResets(`const again = retry ?? reset;`)).toEqual([]);
  });
});

describe("a failure screen's way out is never a dead link", () => {
  /** Each link-shaped thing in a boundary, and whether it goes through escapeTo. */
  function exits(source: string): { what: string; ok: boolean }[] {
    const found: { what: string; ok: boolean }[] = [];
    for (const m of source.matchAll(/<(ButtonLink|Link)\b[^>]*>/g)) found.push({ what: m[0], ok: /escapeTo\(/.test(m[0]) });
    for (const m of source.matchAll(/\{[^{}]*\bhref:\s*[^{}]*\}/g)) found.push({ what: m[0], ok: /escapeTo\(/.test(m[0]) });
    for (const m of source.matchAll(/<(StateMoment|PlainSystemMoment|SystemMoment)\b[^>]*?\bhome=[^>]*>/g)) found.push({ what: m[0].slice(0, 80), ok: /onHome=\{escapeTo\(/.test(m[0]) });
    return found;
  }

  it.each(FILES.filter((f) => !f.endsWith("global-error.tsx")).map((f) => [relative(APP, f), f]))("%s", (_name, path) => {
    const bad = exits(code(path)).filter((e) => !e.ok);
    expect(bad.map((e) => e.what)).toEqual([]);
  });

  it("the shared visit failure", () => {
    const source = code(SHARED);
    const bad = exits(source.slice(source.indexOf("export function VisitError"))).filter((e) => !e.ok);
    expect(bad.map((e) => e.what)).toEqual([]);
  });

  it("global-error's way home is a plain anchor, a full load by construction", () => {
    const source = code(join(APP, "global-error.tsx"));
    expect(source).not.toMatch(/from "next\/link"/);
    expect(source).toMatch(/<a\s+href="\/home-or-landing"/);
  });
});
