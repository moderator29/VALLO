import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE STORE BADGES BELONG TO EVERY PAGE OF THE WEBSITE, NOT JUST THE LANDING.
 *
 * The founder, 13 November 2026: "we are up and going on Play Store and App
 * Store now, so update the link on our websites so people can click from our
 * website and download, anywhere that says we are not live". Before that day
 * the badges were drawn in two bands of the landing page and nowhere else, so
 * a visitor reading About, Help, For hosts or any other public door was never
 * told the apps exist. The footer is the one surface all of them share.
 *
 * These are source assertions rather than a render, because what can regress
 * here is the WIRING: somebody removes the badges from the footer, or passes
 * `native: false` as a literal, or reads one store URL and forgets the other.
 * A render test would pass through all three.
 */

const SRC = join(__dirname, "..", "..");
const footer = readFileSync(join(SRC, "components", "site", "SiteFooter.tsx"), "utf8");

describe("the website footer carries the store badges", () => {
  it("draws them, through the one decider the landing also uses", () => {
    expect(footer).toContain("<StoreBadges");
    expect(footer).toContain("storeBadges({");
  });

  it("reads both store URLs, so one store cannot be wired and the other forgotten", () => {
    expect(footer).toContain("NEXT_PUBLIC_APP_STORE_URL");
    expect(footer).toContain("NEXT_PUBLIC_PLAY_STORE_URL");
  });

  it("asks the request which surface it is, never assuming the web", () => {
    /*
     * An install badge inside the native shell is noise at best: the person
     * holding the phone already has the app. `storeBadges()` returns an empty
     * list for a native request and the component draws nothing, but only if
     * it is TOLD. A hardcoded `native: false` would put a Play Store badge
     * inside the iOS app, which is also a review risk.
     */
    expect(footer).toContain("requestSurface()");
    expect(footer).toMatch(/native:\s*\(await requestSurface\(\)\) !== "web"/);
    expect(footer).not.toMatch(/native:\s*false/);
  });

  it("uses classes that the footer's own stylesheet declares", () => {
    /*
     * The badge family lives in site.css, the sheet this footer imports for
     * itself (14 November 2026). It used to live in landing-rooms.css, which
     * only the site and landing layouts load; the footer is now also drawn
     * under the listings a guest lands on, where that sheet is absent, and
     * the badges would have been unstyled artwork there.
     */
    expect(footer).toContain('import "@/app/css/site.css";');
    expect(footer).toContain("nf-site-footer__badges");
    const sheet = readFileSync(join(SRC, "app", "css", "site.css"), "utf8");
    for (const rule of [".nf-site-footer__badges", ".nf-store-badges {", ".nf-store-badge {", ".nf-store-badge--soon {", ".nf-store-badge:focus-visible"]) {
      expect(sheet, rule).toContain(rule);
    }
    /* Declared once: the old sheet no longer carries the family. */
    expect(readFileSync(join(SRC, "app", "css", "landing-rooms.css"), "utf8")).not.toContain(".nf-store-badge {");
  });
});
