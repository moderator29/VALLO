import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOC_SLUGS } from "@/app/(site)/docs/slugs";
import { GUIDE_SLUGS } from "@/lib/guides/slugs";
import { DOC_DESTINATIONS } from "./destinations";
import { COVERAGE, MAX_KNOWN_GAPS, RETIRED_IN_LEDGER, findStale, findUncovered, hrefResolves, manifestRoutes } from "./coverage";

/**
 * THE DOCUMENTATION CANNOT ROT (Agent DOCS, 11 November 2026).
 *
 * Fails when:
 *   1. a page exists in the app (or the page ledger) that the manifest does not name;
 *   2. the manifest names a page that no longer exists;
 *   3. a documentation entry points at a page that does not exist;
 *   4. a document button points at a route that does not exist;
 *   5. there are more known gaps than the cap, or a gap has no reason.
 *
 * The route table is read from the file system (`page.tsx` under `src/app`,
 * development previews excluded), the same rule `scripts/page-ledger.py` uses,
 * so it cannot disagree with the app. It is also checked against the ledger.
 */
const SRC = join(process.cwd(), "src");
const APP = join(SRC, "app");

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) pages(path, out);
    else if (name === "page.tsx") out.push(path);
  }
  return out;
}

function routeOf(file: string): string | null {
  const rel = file.slice(APP.length + 1).split("/").slice(0, -1);
  if (rel[0] === "(dev)" || rel[0] === "api") return null;
  const segs = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segs.join("/");
}

const ROUTES = [...new Set(pages(APP).map(routeOf).filter((r): r is string => r !== null))].sort();

function ledgerRoutes(): string[] {
  const text = readFileSync(join(process.cwd(), "..", "..", "docs", "handoff", "PAGE_LEDGER.md"), "utf8");
  return [...text.matchAll(/^\| `(\/[^`]*)` \|/gm)].map((m) => m[1] as string);
}

describe("documentation coverage", () => {
  it("names every page the app serves", () => {
    expect(findUncovered(ROUTES), "pages with no documentation entry (add them to lib/docs/coverage.ts)").toEqual([]);
  });

  it("names every page in the page ledger", () => {
    const ledger = ledgerRoutes();
    expect(findUncovered(ledger).filter((route) => !RETIRED_IN_LEDGER.includes(route)), "ledger pages with no documentation entry").toEqual([]);
    for (const route of RETIRED_IN_LEDGER) expect(ROUTES.includes(route), `${route} is back in the app: drop it from RETIRED_IN_LEDGER`).toBe(false);
  });

  it("names no page that has gone", () => {
    expect(findStale(ROUTES), "manifest lines for pages that no longer exist").toEqual([]);
  });

  it("names each page once", () => {
    const all = manifestRoutes();
    const dupes = all.filter((route, i) => all.indexOf(route) !== i);
    expect(dupes).toEqual([]);
  });

  it("points every documentation entry at a page that exists", () => {
    const manualSlugs = [...readFileSync(join(APP, "admin", "handbook", "manual", "manual-content.tsx"), "utf8").matchAll(/^ {2}slug: "([a-z0-9-]+)",/gm)].map((m) => m[1]);
    const docs = new Set<string>([
      ...DOC_SLUGS.map((s) => `/docs/${s}`),
      ...GUIDE_SLUGS.map((s) => `/guides/${s}`),
      ...manualSlugs.map((s) => `/admin/handbook/manual/${s}`),
    ]);
    for (const group of COVERAGE) {
      if ("doc" in group) expect(docs.has(group.doc), `${group.doc} is not a documentation page`).toBe(true);
    }
  });

  it("gives every exemption and gap a reason, and caps the gaps", () => {
    let gaps = 0;
    for (const group of COVERAGE) {
      if ("needsNone" in group) expect(group.needsNone.length).toBeGreaterThan(20);
      if ("gap" in group) {
        gaps += group.routes.length;
        expect(group.gap.length).toBeGreaterThan(20);
      }
    }
    expect(gaps).toBeLessThanOrEqual(MAX_KNOWN_GAPS);
  });

  it("sends every document button to a route that exists", () => {
    for (const [id, dest] of Object.entries(DOC_DESTINATIONS)) {
      expect(hrefResolves(dest.href, ROUTES), `button ${id} -> ${dest.href}`).toBe(true);
    }
  });

  it("sends every staff manual desk link to a route that exists", () => {
    const source = readFileSync(join(APP, "admin", "handbook", "manual", "manual-content.tsx"), "utf8");
    const hrefs = [...source.matchAll(/\{ href: "(\/admin[^"]*)", label:/g)].map((m) => m[1] as string);
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) expect(hrefResolves(href, ROUTES), href).toBe(true);
  });

  it("sends every /docs, /guides and /admin link written in the docs sources to a page that exists", () => {
    const files = ["chapters.tsx", "chapters-more.tsx", "chapters-guide.tsx", "chapters-people.tsx", "chapters-platform.tsx", "chapters-offers.tsx"].map((f) =>
      readFileSync(join(APP, "(site)", "docs", f), "utf8"),
    );
    const source = files.join("\n");
    const hrefs = [...source.matchAll(/href="(\/[a-z0-9/_\-[\].]*)(?:[#?][^"]*)?"/gi)].map((m) => m[1] as string);
    const missing = [...new Set(hrefs)].filter((h) => h !== "/" && !hrefResolves(h, ROUTES));
    expect(missing, "links in the docs to pages that do not exist").toEqual([]);
  });

  it("detects a page that is added without documentation (the fixture)", () => {
    expect(findUncovered([...ROUTES, "/fake-feature"])).toEqual(["/fake-feature"]);
    expect(findStale([...ROUTES.filter((r) => r !== "/about")])).toEqual(["/about"]);
    expect(hrefResolves("/offers/does-not-exist/deep/path", ROUTES)).toBe(false);
  });
});
