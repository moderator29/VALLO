import { describe, expect, it } from "vitest";

import { buildSitemap, PUBLIC_PAGES } from "@/lib/listings/sitemap";
import robots from "./robots";
import sitemap from "./sitemap";
import { isPublicPath } from "../proxy";

/**
 * THE SITEMAP HAS TO TELL THE TRUTH ABOUT WHAT IS PUBLIC.
 *
 * ===========================================================================
 * WHAT THIS FILE USED TO BE, AND WHY IT IS A DIFFERENT TEST NOW
 * ===========================================================================
 *
 * It used to hold a fake database against the route and check that an example
 * listing could not reach a crawler through the sitemap, which was surface one
 * of the four the syndication gate governs. That test was right and it is now
 * about nothing: the route reads no database, because after the founder's item
 * 8 there is no public inventory surface for a row to point at. The other
 * three surfaces (JSON-LD, the Open Graph card, email) still go through
 * `lib/listings/syndication.ts` and still have their own tests.
 *
 * ===========================================================================
 * WHAT IT ASSERTS INSTEAD, AND WHY THIS IS THE STRONGER CHECK
 * ===========================================================================
 *
 * A sitemap that advertises pages a crawler is then refused at is worse than
 * no sitemap: Search Console reads every row as a redirect and the one honest
 * public surface is buried under the queue of bounces. The failure is not that
 * a bad row gets in; it is that the sitemap and the gate DISAGREE.
 *
 * So every URL the route emits is put through `isPublicPath`, which is the
 * function the running middleware itself calls. Not a copy of the list, not a
 * restatement: the live rule. The two cannot drift, in either direction,
 * without this going red and naming the path.
 *
 * `robots.txt` is held to the same answer, because it is the third statement
 * of the same decision and the one most likely to be forgotten.
 *
 * WHAT THIS WOULD REPORT ON AN EMPTY SITEMAP, asked before it was written:
 * "every URL is public" is trivially true of no URLs, so the count and the
 * landing page are checked first and the file refuses rather than passes.
 */

const ORIGIN = "https://vallospaces.com";

/** The path part of an entry, as the gate would see it. */
function pathOf(url: string): string {
  const path = new URL(url).pathname.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

describe("the sitemap and the gate agree about what is public", () => {
  it("emits a sitemap worth asserting about", async () => {
    /* THE BLIND-LIGHT GUARD. Every assertion below passes over an empty
       array, and an empty sitemap is a plausible accident. */
    const entries = await sitemap();
    expect(entries.length, "an empty sitemap makes every check below vacuous").toBeGreaterThan(5);
    expect(entries.map((entry) => pathOf(entry.url))).toContain("/");
  });

  it("names only addresses a signed-out crawler can actually fetch", () => {
    const refused = buildSitemap(ORIGIN)
      .map((entry) => pathOf(entry.url))
      .filter((path) => !isPublicPath(path));
    expect(
      refused,
      "the sitemap invites a crawler to pages the gate then bounces to /sign-in",
    ).toEqual([]);
  });

  it("publishes no listing, stay or restaurant address", () => {
    /* The founder's accepted consequence, asserted rather than trusted: "No
       listing will be indexed by Google, so the landing page becomes our only
       public surface." A row reappearing here without the gate reopening
       first is the mistake this names. */
    const inventory = buildSitemap(ORIGIN)
      .map((entry) => pathOf(entry.url))
      .filter((path) => /^\/(listing|stay|restaurant|search|around|rent|stays)(\/|$)/.test(path));
    expect(inventory, "item 8 closed these, so a crawler cannot fetch one").toEqual([]);
  });

  it("does not quietly drop the compliance pages a reviewer has to find", () => {
    const paths = buildSitemap(ORIGIN).map((entry) => pathOf(entry.url));
    for (const required of ["/privacy", "/terms", "/delete-account"]) {
      expect(paths, `${required} must be discoverable, not merely reachable`).toContain(required);
    }
  });

  it("keeps robots.txt saying the same thing as the gate", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const disallowed = list
      .flatMap((rule) => (Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow ?? ""]))
      .filter((path) => path.length > 0);

    /* Shape first: a robots file that stopped listing anything would pass the
       next two assertions for the wrong reason. */
    expect(disallowed.length).toBeGreaterThan(10);

    /* Nothing public is told not to crawl. This is the direction that costs
       us the landing page, and it is the one nobody checks. */
    const shutOut = disallowed
      .map((entry) => entry.replace(/\/$/, "") || "/")
      .filter((path) => path !== "/" && PUBLIC_PAGES.some((page) => page.path === path));
    expect(shutOut, "robots.txt disallows a page the sitemap advertises").toEqual([]);

    /* And the browsing surfaces item 8 closed are named, because a crawl of a
       redirect is a wasted fetch with our name on it. */
    for (const closed of ["/search", "/listing/", "/around/", "/stays", "/stay/", "/price"]) {
      expect(
        disallowed,
        `${closed} is behind the gate now and robots.txt should say so`,
      ).toContain(closed);
    }
  });

  it("lists an area price page only as an aggregate address, and only when handed one", () => {
    /* V-82. Today the list is empty because every listing is an example, and
       the sitemap must say nothing about areas at all. */
    const today = buildSitemap(ORIGIN, []).map((entry) => pathOf(entry.url));
    expect(today.filter((path) => path.startsWith("/areas"))).toEqual([]);
    /* When an area earns a page, it is public through the gate, and nothing
       shaped like inventory can ride in on the same list. */
    const later = buildSitemap(ORIGIN, [
      { path: "/areas/lagos/yaba", lastModified: "2026-09-01T00:00:00Z" },
      { path: "/listing/abc" },
      { path: "/areas/lagos" },
    ]).map((entry) => pathOf(entry.url));
    expect(later).toContain("/areas/lagos/yaba");
    expect(later).not.toContain("/listing/abc");
    expect(later).not.toContain("/areas/lagos");
    expect(later.filter((path) => !isPublicPath(path))).toEqual([]);
  });

  it("lists a language address only where the page body is in that language", () => {
    /* "Duplicate, Google chose different canonical than user": /ha/terms,
       /yo/terms and /ig/terms were listed beside /terms with an identical
       English body. They are canonical at /terms and left out. */
    const entries = buildSitemap(ORIGIN, [], ["viewings"]);
    const paths = entries.map((entry) => pathOf(entry.url));
    for (const copy of ["/ha/terms", "/yo/privacy", "/ig/about", "/ha/docs/viewings", "/yo/guides"]) {
      expect(paths, copy).not.toContain(copy);
    }
    expect(paths).toContain("/terms");
    expect(paths).toContain("/docs/viewings");
    const terms = entries.find((entry) => pathOf(entry.url) === "/terms");
    expect(terms?.alternates).toBeUndefined();
    /* The pages that really are written in four languages keep all four. */
    for (const translated of ["/ha", "/yo", "/ig", "/ha/check", "/ig/r"]) {
      expect(paths, translated).toContain(translated);
    }
    const landing = entries.find((entry) => pathOf(entry.url) === "/ha");
    expect(landing?.alternates?.languages).toMatchObject({ en: `${ORIGIN}/`, yo: `${ORIGIN}/yo` });
    /* No address is listed twice. */
    expect(new Set(paths).size).toBe(paths.length);
  });
});
