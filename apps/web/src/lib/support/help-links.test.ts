import { describe, expect, it } from "vitest";
import { FAQS } from "./help-articles";

/**
 * A NAMED THING IS A LINK, AND THE LINK LANDS (the founder's pass, 10 November
 * 2026). Every `links` entry on a help answer names text the answer still
 * says, in order, and points at an internal address. Whether the address is a
 * real route is `app/static-hrefs.test.ts`'s job (it reads every literal
 * `href` in the source); a `/docs/<slug>#<section>` anchor is held by
 * `docs-links.dom.test.tsx`.
 */
describe("the help answers' links", () => {
  it("names text each answer still says, in order, and only internal addresses", () => {
    let count = 0;
    for (const faq of FAQS) {
      let from = 0;
      for (const link of faq.links ?? []) {
        const at = faq.a.indexOf(link.text, from);
        expect(at, `${faq.q}: "${link.text}"`).toBeGreaterThanOrEqual(0);
        from = at + link.text.length;
        expect(link.href, faq.q).toMatch(/^\/[a-z0-9/#-]*$/);
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(10);
  });
});
