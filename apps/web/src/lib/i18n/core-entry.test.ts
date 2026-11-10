import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDictionary,
  LOCALES,
  suppliedKeys,
  type Locale,
  type UnitNoun,
} from "@vallo/i18n";
import { countOf, formatNumber, rulesFor } from "@vallo/i18n/core";
import { clientCopyOf } from "./client-copy-of";

/**
 * THE DICTIONARIES STAY ON THE SERVER (Track M performance).
 *
 * `@vallo/i18n` imports all four dictionaries; `@vallo/i18n/core` imports
 * none. Client code that reached the full entry shipped a 717 KB chunk
 * (222 KB gzipped) to every route, the landing page included. These tests
 * hold the line where it matters most: the light entry itself, and the
 * client code the root and in-app layouts mount on every screen.
 */

const SRC = join(__dirname, "..", "..");
const PKG = join(SRC, "..", "..", "..", "packages", "i18n", "src");

function resolve(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else return null;
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"])
    if (existsSync(base + ext)) return base + ext;
  return null;
}

const VALUE_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g;
const FULL_ENTRY =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^;]*?from\s*["']@vallo\/i18n["']/;

/** Every module a client file pulls into the browser, following value imports only. */
function clientGraph(root: string): string[] {
  const seen = new Set<string>();
  const queue = [root];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    /* A server action module is a reference in the browser, not code. */
    if (file !== root && /^\s*["']use server["']/.test(source)) continue;
    for (const m of source.matchAll(VALUE_IMPORT)) {
      const next = resolve(m[1]!, file);
      if (next) queue.push(next);
    }
  }
  /* Server action modules stay on the server: only a reference to them is sent. */
  return [...seen].filter(
    (file) =>
      file === root ||
      !/^\s*["']use server["']/.test(readFileSync(file, "utf8"))
  );
}

/** The client components a layout renders directly. */
function clientChildrenOf(layout: string): string[] {
  const file = join(SRC, layout);
  const out: string[] = [];
  for (const m of readFileSync(file, "utf8").matchAll(VALUE_IMPORT)) {
    const next = resolve(m[1]!, file);
    if (next && /^\s*["']use client["']/.test(readFileSync(next, "utf8")))
      out.push(next);
  }
  return out;
}

describe("the light entry", () => {
  it("imports no dictionary", () => {
    const source = readFileSync(join(PKG, "core.ts"), "utf8");
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
      (m) => m[1]
    );
    const valueImports = [...source.matchAll(VALUE_IMPORT)].map((m) => m[1]);
    expect(
      valueImports.every((spec) =>
        ["./negotiate", "./locales/units"].includes(spec!)
      )
    ).toBe(true);
    /* The only other import is a type, which is erased. */
    expect(imports.filter((spec) => !valueImports.includes(spec))).toEqual([
      "./plural",
      "./locales/en",
    ]);
  });
});

describe("client code on every screen never reaches the full entry", () => {
  const roots = [
    ...clientChildrenOf("app/layout.tsx"),
    ...clientChildrenOf("app/(app)/layout.tsx"),
    join(SRC, "app/(app)/error.tsx"),
    join(SRC, "app/error.tsx"),
    join(SRC, "components/site/BackButton.tsx"),
    join(SRC, "components/app/PageHeader.tsx"),
  ];

  it("finds the layouts' client components", () => {
    expect(roots.map((file) => relative(SRC, file))).toEqual(
      expect.arrayContaining([
        "components/app/AppShell.tsx",
        "components/app/OfflineTray.tsx",
        "lib/i18n/client-copy.tsx",
      ])
    );
  });

  it.each(roots.map((file) => relative(SRC, file)))("%s", (root) => {
    const offenders = clientGraph(join(SRC, root))
      .filter((file) => FULL_ENTRY.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});

describe("countOf in the light entry says exactly what it said with the dictionaries", () => {
  /* The rule as it was written against the whole dictionary, kept here as
     the reference the light version must match. */
  function reference(count: number, noun: UnitNoun, locale: Locale): string {
    const dictionary = getDictionary(locale);
    const translated =
      locale === "en" || suppliedKeys(dictionary).has(`units.${noun}.other`);
    const forms = dictionary.units[noun];
    const template =
      forms[rulesFor(translated ? locale : "en").select(count)] ?? forms.other;
    return template.replace(/\{count\}/g, formatNumber(count, locale));
  }

  const nouns = Object.keys(getDictionary("en").units) as UnitNoun[];

  it.each(LOCALES)(
    "%s, every noun, the counts that change a form",
    (locale) => {
      for (const noun of nouns) {
        for (const count of [0, 1, 2, 3, 5, 11, 21, 101, 1000]) {
          expect(countOf(count, noun, locale)).toBe(
            reference(count, noun, locale)
          );
        }
      }
    }
  );
});

describe("the words carried to client code stay few", () => {
  /* 12.5 KB to 13 KB (10 Nov 2026): four account banners (signed out, profile
     confirmed, photo added, check your email) and "Add your photo" are said on
     every screen by the root host, in every language. */
  it.each(LOCALES)("%s is under 13 KB", (locale) => {
    expect(
      JSON.stringify(clientCopyOf(getDictionary(locale))).length
    ).toBeLessThan(13_000);
  });
});
