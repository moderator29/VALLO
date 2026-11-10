import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";
import CookieConsent from "./CookieConsent";

afterAll(closeAxe);

const copy = getDictionary("en").cookies;
const bar = () => renderToStaticMarkup(<CookieConsent copy={copy} start="bar" onDone={() => undefined} />);

/**
 * NO DARK PATTERNS (founder, 10 November 2026): the three first-visit choices
 * are the same kind of button in the same size, in a labelled region that does
 * not trap focus or hide the page, with a link to the policy.
 */
describe("the cookie bar", () => {
  it("offers Accept all, Only necessary and Choose as equal buttons", () => {
    const html = bar();
    const buttons = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>(.*?)<\/button>/g)];
    const labels = buttons.map((m) => m[2]!.replace(/<[^>]+>/g, "").trim());
    expect(labels).toEqual([copy.banner.acceptAll, copy.banner.onlyNecessary, copy.banner.choose]);
    expect(new Set(buttons.map((m) => m[1])).size, "one class list for all three").toBe(1);
    expect(html).toContain('role="region"');
    expect(html).not.toContain("aria-modal");
    expect(html).toContain('href="/cookies"');
  });

  it("says nothing optional is used until the person chooses", () => {
    expect(copy.banner.body).toMatch(/Nothing from the last two is used until you choose/);
  });

});

describe.skipIf(!hasBrowser && !process.env.CI)("the cookie bar (axe)", () => {
  it("has no axe violations", async () => {
    expect(await axe(`<h1>Vallo</h1>${bar()}`)).toEqual([]);
  });
});
