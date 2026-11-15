import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { STAFF_SCOPES, type StaffScope } from "@/lib/admin/guard";
import { ADMIN_NAV, ADMIN_SETTINGS, canOpen, destinationsFor, groupsFor, type NavViewer } from "./nav";

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
  "/admin/escalations/new": "the escalation form as a page, opened from the escalations desk and linked from other desks with a record attached",
};

/**
 * RECORD PAGES, AND WHY THEY ARE NOT ON THE MENU (15 November 2026).
 *
 * The audit of 15 November walked every page route under `app/admin`, dynamic
 * ones too, and not only the static ones this file used to read. A route with
 * a parameter in it is one RECORD of a desk (one listing, one case, one
 * escalation), reached by opening that record from its desk, so it is not a
 * menu row and never should be. What it must have is a desk ABOVE it that the
 * menu does open, which is what `coveredByAncestor` below checks. Nothing is
 * exempt: a record page under a desk nobody can reach from the menu fails
 * here with its address printed.
 */
function coveredByAncestor(route: string, reachable: Set<string>): boolean {
  const parts = route.split("/");
  for (let cut = parts.length - 1; cut > 1; cut -= 1) {
    const parent = parts.slice(0, cut).join("/");
    if (reachable.has(parent)) return true;
  }
  return false;
}

const scopeOf = new Set<string>(STAFF_SCOPES);
const DOORS = ["staff", "coo", "admin", "super_admin"];

/** A viewer the console admits, for the filtering tests. */
function viewer(over: Partial<NavViewer> = {}): NavViewer {
  return { isAdmin: false, isSuperAdmin: false, scopes: [], position: null, ...over };
}

const routes = pages(ADMIN_DIR).map(routeOf);
const staticRoutes = routes.filter((route) => !route.includes("["));
const hrefs = new Set(ADMIN_NAV.map((item) => item.href));
/** Every address the menu opens, plus the sub pages a desk links to from its own head. */
const reachable = new Set<string>([...hrefs, ...Object.keys(SUB_PAGES)]);

/** Every page route under `app/admin`, as the URL pattern it serves. */
const appRoutes = new Set(routes);

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


  it("leaves no page route uncovered, records and sub pages included", () => {
    const orphans = routes.filter(
      (route) => !reachable.has(route) && !coveredByAncestor(route, reachable),
    );
    expect(
      orphans,
      orphans.length === 0
        ? ""
        : [
            "These admin pages cannot be reached from the console menu at all:",
            ...orphans.map((route) => `  ${route}`),
            "Add a row for each to ADMIN_PRIMARY or ADMIN_SETTINGS in nav.ts, in the group it belongs to,",
            "or, where it is a view inside a desk the menu already opens, name it in SUB_PAGES above with the desk that links to it.",
          ].join("\n"),
    ).toEqual([]);
  });

  it("says who every row is for, with a real access area and a real role", () => {
    const unnamed = ADMIN_NAV.filter((item) => !DOORS.includes(item.door)).map((item) => item.key);
    expect(unnamed, `these rows name no role: ${unnamed.join(", ")}. Give each a door of ${DOORS.join(", ")}.`).toEqual([]);

    const strays = ADMIN_NAV.flatMap((item) =>
      item.scopes.filter((scope) => !scopeOf.has(scope)).map((scope) => `${item.key} names ${scope}`),
    );
    expect(strays, `these rows name an access area the database does not have: ${strays.join("; ")}`).toEqual([]);

    const repeated = ADMIN_NAV.filter((item) => new Set(item.scopes).size !== item.scopes.length).map((i) => i.key);
    expect(repeated, `these rows name the same access area twice: ${repeated.join(", ")}`).toEqual([]);

    /* A row open to every member of staff says so by naming no area at all.
       A row that names areas is for the people holding one of them. */
    for (const item of ADMIN_NAV) {
      if (item.door === "staff") expect(Array.isArray(item.scopes), item.key).toBe(true);
    }
  });

  it("keeps the Staff desk and the Control room for the super admin alone", () => {
    const superOnly = ADMIN_NAV.filter((item) => item.door === "super_admin").map((item) => item.href).sort();
    expect(superOnly).toEqual(["/admin/control", "/admin/staff"]);
    const operator = viewer({ isAdmin: true });
    for (const href of superOnly) {
      const row = ADMIN_NAV.find((item) => item.href === href)!;
      expect(canOpen(row, operator), href).toBe(false);
      expect(canOpen(row, viewer({ isAdmin: true, isSuperAdmin: true })), href).toBe(true);
    }
  });

  it("draws a staff member the desks their areas open, and no row that leads nowhere", () => {
    const support = destinationsFor(viewer({ scopes: ["support"] })).map((item) => item.href);
    /* Everything the support area opens, which the frame could not reach before. */
    for (const href of ["/admin/support", "/admin/people", "/admin/account-recovery", "/admin/queue", "/admin/lookup", "/admin/doc-feedback"]) {
      expect(support, href).toContain(href);
    }
    /* And nothing it does not. */
    for (const href of ["/admin/money", "/admin/kyc", "/admin/staff", "/admin/control", "/admin/settings", "/admin/listings"]) {
      expect(support, href).not.toContain(href);
    }
    /* The few rows every member of staff the console admits may open. */
    for (const href of ["/admin", "/admin/my-desk", "/admin/escalations", "/admin/handbook", "/admin/manual", "/admin/copilot"]) {
      expect(support, href).toContain(href);
    }
    /* A finance reviewer gets the money desks and not the support ones. */
    const finance = destinationsFor(viewer({ scopes: ["finance"] })).map((item) => item.href);
    expect(finance).toContain("/admin/money");
    expect(finance).toContain("/admin/chargebacks");
    expect(finance).not.toContain("/admin/support");
    /* The super admin sees the whole menu, as they always did. */
    const all = destinationsFor(viewer({ isAdmin: true, isSuperAdmin: true })).map((item) => item.href);
    expect(all.length).toBe(new Set(ADMIN_NAV.map((item) => item.href)).size);
  });

  it("draws no empty group, and keeps the groups in their own order", () => {
    for (const scopes of [["support"], ["finance"], ["social_media"], ["technical"]] as StaffScope[][]) {
      const groups = groupsFor(viewer({ scopes }));
      expect(groups.length, scopes.join(",")).toBeGreaterThan(0);
      for (const group of groups) {
        expect(group.sections.length, `${scopes.join(",")} ${group.key}`).toBeGreaterThan(0);
        for (const section of group.sections) expect(section.items.length).toBeGreaterThan(0);
      }
      const order = groups.map((group) => group.key);
      expect(order).toEqual(groupsFor().filter((g) => order.includes(g.key)).map((g) => g.key));
    }
  });

  it("opens a page the app serves from every row, inside the console and out", () => {
    const dead = ADMIN_NAV.filter((item) => item.href.startsWith("/admin"))
      .filter((item) => !appRoutes.has(item.href))
      .map((item) => item.href);
    expect(dead, `the menu points at a console page that does not exist: ${dead.join(", ")}`).toEqual([]);
    /* The one row outside the console: the members' own help centre. */
    const outside = ADMIN_NAV.filter((item) => !item.href.startsWith("/admin")).map((item) => item.href);
    expect(outside).toEqual(["/settings/help"]);
    expect(existsSync(join(ADMIN_DIR, "..", "(app)", "settings", "help", "page.tsx"))).toBe(true);
    /* Settings is the one row the rail foot draws on its own. */
    expect(ADMIN_SETTINGS.href).toBe("/admin/settings");
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
    expect(keysOf("/admin/escalations")).toEqual(["escalations"]);
  });
});
