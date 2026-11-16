import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNED_EVERYWHERE, SCHEDULE_PROMISES, firstBannedPhrase } from "@/lib/copy/banned-phrases";
import { MANUAL_AREA_LABEL, MANUAL_CHAPTERS, MANUAL_SLUGS, RETIRED_MANUAL_PAGES, isManualSlug, retiredManualTarget } from "@/lib/admin/manual/chapters";
import { STAFF_SCOPE_LABEL } from "@/lib/admin/guard";
import { CONTACT_EMAIL } from "@/lib/support-email";
import { unbackedClaim } from "@/lib/trust/claims";
import { renderClient } from "@/lib/testing/render-client";

/**
 * THE STAFF MANUAL, READ AS A READER READS IT.
 *
 * The console is outside the claims sweep (`lib/trust/claims.test.ts` skips
 * `app/admin`, whose readers look at the mechanism itself), but this manual
 * is prose for new staff and is held to the member documents' rules anyway.
 * So every page is rendered to HTML and its visible words are checked: no
 * dashes the founder ruled out, no schedule promise, no unbacked claim of
 * safety, no contact address but the one, and every link it prints opens a
 * page that exists.
 */

const APP = join(process.cwd(), "src", "app");

/** Every page route under `src/app`, as the URL pattern it serves. */
function pageRoutes(dir: string, segments: string[], out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("_")) continue;
      pageRoutes(full, /^\(.*\)$/.test(entry) ? segments : [...segments, entry], out);
    } else if (/^page\.tsx?$/.test(entry)) {
      out.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
    }
  }
  return out;
}

const ROUTES = pageRoutes(APP, [], []);

function served(path: string): boolean {
  const want = path.split(/[?#]/)[0]!.replace(/\/$/, "") || "/";
  if (ROUTES.includes(want)) return true;
  const parts = want.slice(1).split("/");
  return ROUTES.some((route) => {
    const have = route.slice(1).split("/");
    return have.length === parts.length && have.every((seg, i) => /^\[.+\]$/.test(seg) || seg === parts[i]);
  });
}

async function render(view: string): Promise<string> {
  return renderClient(`
    import { renderToStaticMarkup } from "react-dom/server";
    import { ManualChapterView, ManualIndexView } from "@/app/admin/manual/_chapters/views";
    export const html = () => renderToStaticMarkup(${view});
  `);
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const PAGES: { name: string; view: string }[] = [
  { name: "the index", view: "<ManualIndexView />" },
  ...MANUAL_SLUGS.map((slug) => ({ name: slug, view: `<ManualChapterView slug="${slug}" />` })),
];

describe("the staff manual", () => {
  /*
   * The guide and the onboarding chapter both say how many other currencies a
   * price can be read in. Nothing under `app/admin` may import the currency
   * guide, because admin is a money surface and a converted figure must never
   * reach one (`lib/currency/money-surfaces.test.ts`), so the number is
   * written in the chapter. This is what keeps it honest: add a currency and
   * this fails until both chapters move with it.
   */
  it("states the number of other currencies the product really carries", async () => {
    /* Read as source rather than imported: a chapter is a component module,
       and this suite aliases react to a file, so importing one throws. */
    const { FOREIGN_CURRENCIES } = await import("@/lib/currency/currencies");
    const chapters = join(APP, "admin", "manual", "_chapters");
    for (const file of ["product-guide.tsx", "onboarding-a-member.tsx"]) {
      const text = readFileSync(join(chapters, file), "utf8");
      expect(text, file).toMatch(/OTHER_CURRENCY_COUNT = (\d+);/);
      const stated = Number(/OTHER_CURRENCY_COUNT = (\d+);/.exec(text)![1]);
      expect(stated, file).toBe(FOREIGN_CURRENCIES.length);
      /* And no chapter IMPORTS the currency guide: admin is a money surface.
         The comment that explains why may name it; an import may not. */
      expect(text.replace(/\/\*[\s\S]*?\*\//g, ""), file).not.toMatch(/from "[^"]*lib\/currency/);
    }
  });

  it("lists every chapter once, numbered in order", () => {
    expect(MANUAL_CHAPTERS.map((c) => c.slug)).toEqual([...MANUAL_SLUGS]);
    expect(MANUAL_CHAPTERS.map((c) => c.number)).toEqual(MANUAL_SLUGS.map((_, i) => i + 1));
  });

  /*
   * The retired staff manual (`/admin/handbook/manual`, retired 16 November
   * 2026) redirects each of its nine pages into this one. Every target must be
   * a chapter that exists and, where it names one, a section that chapter has.
   */
  it("sends every page of the retired staff manual to a real chapter and section", async () => {
    expect(Object.keys(RETIRED_MANUAL_PAGES).sort()).toEqual(
      ["agreements-and-bookings", "cases-and-safety", "desks-and-access", "identity-and-applications", "listings-and-supply", "money-and-fees", "offers-and-deals-desk", "operations-and-tools", "support-desk"],
    );
    for (const [page, target] of Object.entries(RETIRED_MANUAL_PAGES)) {
      expect(retiredManualTarget(page)).toBe(target);
      const [path, section] = target.split("#") as [string, string | undefined];
      const slug = path.replace(/^\/admin\/manual\//, "");
      expect(isManualSlug(slug), target).toBe(true);
      if (section) {
        const html = await render(`<ManualChapterView slug="${slug}" />`);
        expect(html, target).toContain(`<section id="${section}"`);
      }
    }
    expect(retiredManualTarget("no-such-page")).toBe("/admin/manual");
    expect(retiredManualTarget("constructor")).toBe("/admin/manual");
  }, 120_000);

  it("names the access areas exactly as the console does", () => {
    expect(MANUAL_AREA_LABEL).toEqual(STAFF_SCOPE_LABEL);
  });

  it.each(PAGES)("$name reads within the founder's wording rules and links only to real pages", async ({ view }) => {
    const html = await render(view);
    const text = textOf(html);
    expect(text.length).toBeGreaterThan(400);

    /* No em or en dash anywhere a reader can see. */
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`));
    /* Nothing that promises a date nobody can keep, and never "not live". */
    expect(firstBannedPhrase(text, [...SCHEDULE_PROMISES, ...BANNED_EVERYWHERE])).toBeNull();
    /* No unbacked "safe", "secure" or "protected". */
    expect(unbackedClaim(text)).toBeNull();
    /* One contact address, and only that one. */
    for (const email of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(email).toBe(CONTACT_EMAIL);
    /* The Guarantee appears only as history. */
    if (/Guarantee/.test(text)) expect(text).toMatch(/retired/);

    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(0);
    const dead = hrefs.filter((href) => href.startsWith("/") && !served(href));
    expect(dead).toEqual([]);
  }, 60_000);

  it("gives every chapter a contents card of at least three sections, with unique anchors", async () => {
    for (const slug of MANUAL_SLUGS) {
      const html = await render(`<ManualChapterView slug="${slug}" />`);
      const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]!);
      expect(ids.length, slug).toBeGreaterThanOrEqual(3);
      expect(new Set(ids).size, slug).toBe(ids.length);
    }
  }, 120_000);

  it("leaves the out of hours contact for the founder to name, never an invented one", async () => {
    const text = textOf(await render(`<ManualChapterView slug="escalation" />`));
    expect(text).toContain("To be named by the founder");
    /* No phone number in any form. */
    expect(text).not.toMatch(/\+?234[\s-]?\d|\b0[789]0\d[\s-]?\d{3}[\s-]?\d{4}\b/);
  }, 60_000);
});
