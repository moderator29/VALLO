import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";

/**
 * D24 ON EVERY DISCOVERY CARD (the founder, 6 October 2026), GUARDED BY SOURCE.
 *
 * The instruction has two halves and this file holds both, for every surface
 * W2 owns that draws a listing as a card:
 *
 *   1. THE VISIBLE EXAMPLE LABEL IS OFF. No `nf-badge--example`, no
 *      `ExampleNotice`, no "Example" word read from the dictionary. The
 *      listings stay; the founder removes the rows at launch.
 *   2. NOTHING UNEARNED IS ON. Where a card draws the Verified mark or a
 *      rating, the same expression withholds it from an example (`isDemo`),
 *      so a mapper regression can never print a tick on an invented flat.
 *      The danger the directive names was never the missing word; it was
 *      fabricated trust.
 *
 * Read with comments stripped, so a comment explaining the rule can never be
 * what satisfies it.
 */
const SRC = join(process.cwd(), "src");
const read = (path: string) => withoutComments(readFileSync(join(SRC, path), "utf8"));

const CARD_RENDERERS = [
  "components/app/ListingCard.tsx",
  "components/app/stays/StayCard.tsx",
  "components/app/search/MapDock.tsx",
  "components/app/home/LookedAtRecently.tsx",
  "app/(app)/saved/SavedCompare.tsx",
  "components/app/compare/CompareBody.tsx",
] as const;

describe("D24: no example label on a discovery card", () => {
  it.each(CARD_RENDERERS)("%s draws no example mark", (path) => {
    const source = read(path);
    expect(source).not.toContain("nf-badge--example");
    expect(source).not.toContain("ExampleNotice");
    expect(source).not.toMatch(/card\.example|copy\.example/);
  });
});

describe("D24: no unearned trust signal on an example", () => {
  it("the listing card's Verified mark is withheld from an example", () => {
    expect(read("components/app/ListingCard.tsx")).toMatch(/listing\.verified\s*&&\s*!listing\.isDemo/);
  });

  it("the stay card's Verified mark and rating are withheld from an example", () => {
    const source = read("components/app/stays/StayCard.tsx");
    expect(source).toMatch(/stay\.verified\s*&&\s*!stay\.isDemo/);
    expect(source).toMatch(/stay\.rating\s*&&\s*!stay\.isDemo/);
  });

  it("the map's card and pins withhold the tick and the rating from an example", () => {
    const dock = read("components/app/search/MapDock.tsx");
    expect(dock).toMatch(/listing\.verified\s*&&\s*!listing\.isDemo/);
    expect(dock).toMatch(/!listing\.isDemo\s*&&\s*listing\.rating\s*>\s*0/);
    expect(read("components/app/search/MapCanvas.tsx")).toMatch(/pin\.verified\s*&&\s*!pin\.isDemo/);
  });

  it("the comparison draws only an earned Verified mark", () => {
    expect(read("components/app/compare/CompareBody.tsx")).toMatch(/column\.mark\s*===\s*"verified"/);
  });
});
