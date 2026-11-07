import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { buildNav } from "@/components/app/nav-model";
import { shellDictionary } from "@/lib/i18n/shell-dictionary";
import { ROUTE_PARENTS } from "@/lib/nav/route-parents";
import { screenName } from "@/lib/nav/route-labels";
import { matchRoute, parentOf } from "@/lib/nav/resolve";
import { isKnownRoute } from "@/lib/routing/known-routes";
import { isPublicPath } from "@/proxy";

/**
 * THE PEOPLE PAGE IS A REGISTERED ROUTE: it has a page, a parent, a name, a
 * known address, a row in the side navigation beside the feed, and it asks for
 * a sign-in exactly as the feed does.
 */
const PATH = "/around/people";
const APP = join(__dirname, "..", "..", "app", "(app)", "around", "people");

describe("the people page's route", () => {
  it("has a page and a loading skeleton", () => {
    expect(existsSync(join(APP, "page.tsx"))).toBe(true);
    expect(existsSync(join(APP, "loading.tsx"))).toBe(true);
  });

  it("is declared under the feed, so Back from it is the feed", () => {
    expect(ROUTE_PARENTS[PATH]).toBe("/around");
    expect(matchRoute(PATH)).not.toBeNull();
    expect(parentOf(PATH)).toMatchObject({ href: "/around" });
  });

  it("has a name for a screen reader", () => {
    expect(screenName(PATH)).toBeTruthy();
  });

  it("is a known address", () => {
    expect(isKnownRoute(PATH)).toBe(true);
  });

  it("asks for a sign-in like the feed does, and is not a public path", () => {
    expect(isPublicPath("/around")).toBe(false);
    expect(isPublicPath(PATH)).toBe(false);
  });
});

describe("the side navigation's People row", () => {
  const t = shellDictionary(getDictionary("en"));
  const base = { t, unreadNotifications: 0, isAgent: false, isAdmin: false };

  for (const side of ["property", "stays"] as const) {
    it(`sits after Feed and Circle on the ${side} side`, () => {
      const first = buildNav({ ...base, side, signedIn: true })[0]!;
      const hrefs = first.items.map((i) => i.href);
      /* Feed, then Circle (the feed's twin, founder 7 November 2026), then People. */
      expect(hrefs.indexOf("/circle")).toBe(hrefs.indexOf("/around") + 1);
      expect(hrefs.indexOf(PATH)).toBe(hrefs.indexOf("/circle") + 1);
      expect(first.items.find((i) => i.href === PATH)!.label).toBe(t.feedV2.people.navPeople);
    });
  }

  it("is in the same place for a signed-out visitor, as the feed is", () => {
    const hrefs = buildNav({ ...base, side: "property", signedIn: false }).flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/around");
    expect(hrefs).toContain(PATH);
  });
});
