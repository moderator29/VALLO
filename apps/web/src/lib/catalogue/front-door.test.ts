import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { websiteFrontDoor } from "./public-access";

/**
 * THE WEBSITE HAS NO LANDING PAGE (founder, 14 November 2026). A browser that
 * asks for the root is sent to the listings, or to its own home when it
 * carries a session; while the public catalogue is closed the old front page
 * is served instead of a sign-in wall.
 */
const OPEN = { VALLO_PUBLIC_CATALOGUE: "1" };
const SRC = join(__dirname, "..", "..");

describe("the website's front door", () => {
  it("sends a stranger to the listings, and a browser with a session to its own home", () => {
    expect(websiteFrontDoor({ carriesSession: false }, OPEN)).toBe("/search");
    expect(websiteFrontDoor({ carriesSession: true }, OPEN)).toBe("/home-or-landing");
  });

  it("keeps the old front page while the public catalogue is closed", () => {
    for (const env of [{}, { VALLO_PUBLIC_CATALOGUE: "" }, { VALLO_PUBLIC_CATALOGUE: "0" }]) {
      expect(websiteFrontDoor({ carriesSession: false }, env)).toBeNull();
      expect(websiteFrontDoor({ carriesSession: true }, env)).toBeNull();
    }
  });

  it("carries marketing tags and nothing else from the query", () => {
    const search = new URLSearchParams("utm_source=ig&utm_campaign=launch&ref=ada&q=lekki&code=abc&next=https://evil.example&utm_Bad=1");
    expect(websiteFrontDoor({ carriesSession: false, search }, OPEN)).toBe("/search?utm_source=ig&utm_campaign=launch&ref=ada");
    /* A value too long to be a tag is dropped, and a session never carries any. */
    expect(websiteFrontDoor({ carriesSession: false, search: new URLSearchParams(`utm_source=${"x".repeat(200)}`) }, OPEN)).toBe("/search");
    expect(websiteFrontDoor({ carriesSession: true, search }, OPEN)).toBe("/home-or-landing");
  });

  it("is decided in the proxy, before anything renders, as a 307 on the root only", () => {
    const proxy = readFileSync(join(SRC, "proxy.ts"), "utf8");
    const at = proxy.indexOf("const door = websiteFrontDoor(");
    expect(at).toBeGreaterThan(-1);
    const rule = proxy.slice(proxy.lastIndexOf("if (", at), proxy.indexOf("}\n", at) + 2);
    expect(rule).toContain('pathname === "/"');
    expect(rule).toContain("carriesSessionCookie(request)");
    expect(rule).toContain("307");
    expect(rule).not.toContain("308");
    /* After the store shell's own rule, so the app is never sent to the website's door. */
    expect(at).toBeGreaterThan(proxy.indexOf("new URL(SHELL_START, request.url), 307"));
  });

  it("does not loop: a session that turned out to be spent is sent to the listings, not back to the root", () => {
    const route = readFileSync(join(SRC, "app", "home-or-landing", "route.ts"), "utf8");
    expect(route).toContain('const target = signedIn ? "/home" : publicCatalogueEnabled() ? "/search" : "/";');
  });

  it("draws the website's foot for a guest in a browser, and for nobody else", () => {
    const layout = readFileSync(join(SRC, "app", "(app)", "layout.tsx"), "utf8");
    expect(layout).toContain('const web = !signedIn && (await requestSurface()) === "web";');
    expect(layout).toContain('foot={!signedIn && web ? <SiteFooter t={t} variant="app" /> : null}');
    const shell = readFileSync(join(SRC, "components", "app", "AppShell.tsx"), "utf8");
    expect(shell).toContain('{!immersive && foot && showsSiteFoot(active, searchParams?.get("view")) ? foot : null}');
  });
});
