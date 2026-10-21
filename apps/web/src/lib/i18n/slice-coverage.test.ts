import { describe, expect, it } from "vitest";
import { getDictionary, type Locale } from "@vallo/i18n";
import { NARROW, SLICES } from "./slice";
import { dictionaryKeyReads, missingSegment, reachableNamespaces, reachableSubKeys } from "./reachable-namespaces";

/*
 * THE SLICES MUST COVER EVERYTHING THEIR COMPONENT CAN REACH.
 *
 * A client component hands its `t` to helpers and children that read it under
 * other names (`dictionary.units`, `copy.catalogue`), so reading the
 * component's own file is not enough: the listing card reached `units` through
 * a helper and a smoke run caught it where this test, as first written, did
 * not. So this walks the component's WHOLE local import graph and counts any
 * `.name` or `["name"]` that is a top-level dictionary namespace, anywhere in
 * it. That over-approximates on purpose: a slice that carries one namespace
 * too many costs a few kilobytes, one that carries one too few is a crash.
 */
const ROOTS: Record<keyof typeof SLICES, string> = {
  listingCard: "components/app/ListingCard.tsx",
  stayCard: "components/app/stays/StayCard.tsx",
  stayFilterSheet: "components/app/stays/StayFilterSheet.tsx",
  priceCheck: "components/app/price/PriceCheckScreen.tsx",
  proofStrip: "components/app/listing/ProofStrip.tsx",
  settingsHub: "app/(app)/settings/SettingsHub.tsx",
};

describe("every dictionary slice carries what its component can reach", () => {
  for (const [name, root] of Object.entries(ROOTS)) {
    it(name, () => {
      const carried = new Set<string>(SLICES[name as keyof typeof SLICES] as readonly string[]);
      const missing = [...reachableNamespaces(root)].filter((ns) => !carried.has(ns)).sort();
      expect(missing, `${name} slice is missing namespaces its import graph reads`).toEqual([]);
    });
  }
});

/*
 * THE NARROWED NAMESPACES MUST COVER EVERY KEY THEIR GRAPH READS, AND NOTHING
 * MAY READ THEM WHOLE. `unit-shape.ts` is the one false positive: it reads
 * `unit.shape`, the unit's own field, which is not a dictionary at all.
 */
describe("narrowed namespaces carry every key their component can reach", () => {
  for (const [name, narrow] of Object.entries(NARROW)) {
    for (const [namespace, carried] of Object.entries(narrow)) {
      it(`${name}.${namespace}`, () => {
        const { keys, whole } = reachableSubKeys(ROOTS[name as keyof typeof ROOTS], namespace);
        const missing = [...keys].filter((key) => !(carried as readonly string[]).includes(key)).sort();
        expect(missing, `${name} narrows ${namespace} but its graph reads these keys`).toEqual([]);
        const wholeReads = whole.filter((line) => !line.startsWith("lib/listings/unit-shape.ts"));
        expect(wholeReads, `${name} reads ${namespace} as a whole, so it cannot be narrowed`).toEqual([]);
      });
    }
  }
});

/*
 * THE THREE WAYS MOVING HUNDREDS OF STRINGS BREAKS SILENTLY (D61, section 6).
 *
 * A slice can carry every namespace and the screen can still print nothing:
 * the code names a key English never had (a cast or a `Record<string, ...>`
 * view hides it from tsc and the reader sees `undefined`), a value is the empty
 * string (the reader sees a gap where a word was), or a translation drops or
 * renames a placeholder (the reader sees "{count}" or loses the number). One
 * assertion each.
 */
const LOCALES: Locale[] = ["en", "ha", "ig", "yo"];

/** Every string in a dictionary, by dotted path; array items as `path[i]`. */
function strings(value: unknown, path = "", out = new Map<string, string>()): Map<string, string> {
  if (typeof value === "string") out.set(path, value);
  else if (Array.isArray(value)) value.forEach((item, i) => strings(item, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) strings(child, path ? `${path}.${key}` : key, out);
  }
  return out;
}

/** The placeholders in a line, sorted, repeats kept: "{count} of {total}" is ["count", "total"]. */
function placeholders(line: string): string[] {
  return [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}

describe("the dictionary itself (D61)", () => {
  it("has every key the code names, in English", () => {
    const en = getDictionary("en");
    const reads = dictionaryKeyReads();
    const missing = reads
      .filter((read) => read.paths.every((path) => missingSegment(en, path) !== null))
      .map((read) => {
        const path = read.paths[0]!;
        return `${read.file}:${read.line} ${path.slice(0, missingSegment(en, path)! + 1).join(".")}`;
      });
    /* The scan has to find something to be worth trusting. */
    expect(reads.length).toBeGreaterThan(5000);
    expect([...new Set(missing)].sort(), "keys named in code that English does not have").toEqual([]);
  });

  it("has no empty value in any locale", () => {
    const empty = LOCALES.flatMap((locale) =>
      [...strings(getDictionary(locale))].filter(([, line]) => line.trim() === "").map(([path]) => `${locale} ${path}`),
    );
    expect(empty, "an empty string prints as a gap where a word was").toEqual([]);
  });

  it("says the same placeholders in every translation as in English", () => {
    const en = strings(getDictionary("en"));
    const wrong = (["ha", "ig", "yo"] as const).flatMap((locale) =>
      [...strings(getDictionary(locale))]
        .filter(([path, line]) => en.has(path) && en.get(path) !== line)
        .filter(([path, line]) => placeholders(line).join(",") !== placeholders(en.get(path)!).join(","))
        .map(([path, line]) => `${locale} ${path}: {${placeholders(line).join("},{")}} where English has {${placeholders(en.get(path)!).join("},{")}}`),
    );
    expect(wrong, "a translation that drops or renames a placeholder").toEqual([]);
  });

  /*
   * The check above compares a translated line with the English line at the
   * same path, so a line English does not have is never read: a plural
   * category a locale adds that English does not use (`few`, `many`, `two`,
   * `zero`) slipped past it. Such a line answers to English's `other`, which
   * is the form the count falls back to, so it must say the same
   * placeholders. Anything else a locale declares beyond English is refused
   * by the `Translation` type at compile time, which this also pins: no
   * locale carries a path English lacks except a plural category.
   */
  it("says English's placeholders in a plural category English does not use, and adds no other path", () => {
    const en = strings(getDictionary("en"));
    const CATEGORY = /\.(zero|one|two|few|many)$/;
    const extra: string[] = [];
    const wrong: string[] = [];
    for (const locale of ["ha", "ig", "yo"] as const) {
      for (const [path, line] of strings(getDictionary(locale))) {
        if (en.has(path)) continue;
        if (!CATEGORY.test(path)) {
          extra.push(`${locale} ${path}`);
          continue;
        }
        const other = en.get(path.replace(CATEGORY, ".other"));
        if (other === undefined) {
          extra.push(`${locale} ${path}`);
          continue;
        }
        if (placeholders(line).join(",") !== placeholders(other).join(",")) {
          wrong.push(`${locale} ${path}: {${placeholders(line).join("},{")}} where English's other has {${placeholders(other).join("},{")}}`);
        }
      }
    }
    expect(extra, "a path no English line has").toEqual([]);
    expect(wrong, "a plural category that drops or renames a placeholder").toEqual([]);
  });
});
