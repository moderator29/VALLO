import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "./nav";

/*
 * ADMIN COVERAGE (13 October 2026; docs/ADMIN_COVERAGE.md).
 *
 * The console grew desks faster than its map: four reached only by Control K
 * or a link inside another desk, and a blocked-terms panel that said the list
 * "cannot be read from the console" while the function that reads it had been
 * live for a week. These hold the map to the tree in both directions: every
 * static admin page is on the rail (or is a named sub-page of a desk that is),
 * and every rail row opens a page that exists.
 */
const ADMIN_DIR = join(__dirname, "..");

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

const routeOf = (file: string) => {
  const folder = relative(ADMIN_DIR, join(file, ".."));
  return folder === "" ? "/admin" : `/admin/${folder.split(sep).join("/")}`;
};

/** Pages that are a view inside a desk the rail already opens, named so a new one cannot hide here. */
const SUB_PAGES: Record<string, string> = {
  "/admin/handbook/position": "the staff member's own role, linked from the handbook and the staff frame",
  "/admin/handbook/manual": "the staff manual, linked from the handbook",
  "/admin/kyc/guide": "the reviewer guide, linked from the verification desk and from every person's checklist",
};

const routes = pages(ADMIN_DIR).map(routeOf);
const staticRoutes = routes.filter((route) => !route.includes("["));
const hrefs = new Set(ADMIN_NAV.map((item) => item.href));

describe("the console map and the route tree agree", () => {
  it("has a rail row for every static admin page, or names why not", () => {
    const orphans = staticRoutes.filter((route) => !hrefs.has(route) && !(route in SUB_PAGES));
    expect(orphans, `admin pages with no rail row: ${orphans.join(", ")}`).toEqual([]);
  });

  it("opens a page that exists from every rail row (no dead link)", () => {
    const dead = ADMIN_NAV.filter((item) => item.href.startsWith("/admin"))
      .filter((item) => !staticRoutes.includes(item.href))
      .map((item) => item.href);
    expect(dead).toEqual([]);
  });

  it("lists every new coverage desk on the rail", () => {
    for (const href of [
      "/admin/blocked-terms",
      "/admin/weight-withheld",
      "/admin/call-usage",
      "/admin/retention",
      "/admin/restaurant-fees",
      "/admin/bookings/reservations",
      "/admin/agreements/settings",
      "/admin/field-speed",
    ]) {
      expect(hrefs.has(href), href).toBe(true);
    }
  });

  it("uses each destination key once, so a badge and a label never collide", () => {
    const keys = ADMIN_NAV.map((item) => item.key);
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
  });

  it("leaves no rail row's page as a placeholder", () => {
    const stubs = staticRoutes
      .filter((route) => hrefs.has(route))
      .filter((route) => {
        const file = join(ADMIN_DIR, route.replace("/admin", ""), "page.tsx");
        return existsSync(file) && /coming soon|not built yet/i.test(readFileSync(file, "utf8"));
      });
    expect(stubs).toEqual([]);
  });

  it("badges the desks that have work waiting on a person", () => {
    const keysOf = (href: string) => ADMIN_NAV.find((item) => item.href === href)?.countKeys ?? [];
    expect(keysOf("/admin/retention")).toEqual(["retention"]);
    expect(keysOf("/admin/restaurant-fees")).toEqual(["seatings"]);
    expect(keysOf("/admin/account-recovery")).toEqual(["recovery"]);
    expect(keysOf("/admin/money")).toEqual(["claims", "referrals", "payouts", "chargebacks"]);
  });
});
