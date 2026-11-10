import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_GROUPS, ADMIN_NAV, activeGroupKey, activeItemKey, groupItems } from "./nav";

/**
 * THE RAIL'S GROUPS (My Desk brief, 10 November 2026): each destination sits
 * in exactly one group, no href repeats, nothing on the old map is dropped,
 * and every href opens a page that exists.
 */
const APP = join(__dirname, "..", "..");

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pages(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}
const routes = pages(APP).map((file) => {
  const folder = relative(APP, join(file, ".."));
  const parts = folder.split(sep).filter((p) => !/^\(.*\)$/.test(p));
  return parts.length === 0 ? "/" : `/${parts.join("/")}`;
});

const all = ADMIN_GROUPS.flatMap(groupItems);

describe("the rail's groups", () => {
  it("are the eight the brief names, in order", () => {
    expect(ADMIN_GROUPS.map((g) => g.label)).toEqual([
      "Overview", "My Desk", "Staff and Access", "Operations", "Departments", "Intelligence", "Knowledge Centre", "Settings",
    ]);
  });

  it("repeat no href and no key", () => {
    const hrefs = all.map((i) => i.href);
    expect(hrefs.filter((h, i) => hrefs.indexOf(h) !== i)).toEqual([]);
    const keys = all.map((i) => i.key);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it("drop no destination the map already had", () => {
    const grouped = new Set(all.map((i) => i.href));
    expect(ADMIN_NAV.filter((i) => !grouped.has(i.href)).map((i) => i.href)).toEqual([]);
  });

  it("open a page that exists from every href", () => {
    const dead = all.filter((i) => !routes.includes(i.href)).map((i) => i.href);
    expect(dead).toEqual([]);
  });

  it("carry My Desk, its tasks and its announcements", () => {
    const hrefs = all.map((i) => i.href);
    for (const h of ["/admin/my-desk", "/admin/my-desk/tasks", "/admin/my-desk/announcements"]) expect(hrefs).toContain(h);
    expect(existsSync(join(APP, "admin", "my-desk", "page.tsx"))).toBe(true);
  });

  it("map the departments onto desks that exist", () => {
    const departments = ADMIN_GROUPS.find((g) => g.label === "Departments")!;
    expect(departments.sections.map((s) => s.label)).toEqual([
      "Business Development", "Social Media", "Marketing", "Content", "Technical", "Support", "Listing verification", "Trust and Safety", "Finance", "Compliance",
    ]);
  });

  it("light the longest matching row and open its group", () => {
    expect(activeItemKey("/admin/my-desk/tasks")).toBe("my-tasks");
    expect(activeGroupKey("/admin/my-desk/tasks")).toBe("g-my-desk");
    expect(activeItemKey("/admin/agreements/settings")).toBe("agreement-settings");
    expect(activeGroupKey("/admin/social-media")).toBe("g-departments");
    for (const desk of ["marketing", "content", "technical", "support-lead"]) {
      expect(activeGroupKey(`/admin/${desk}`), desk).toBe("g-departments");
      expect(activeItemKey(`/admin/${desk}`), desk).toBe(desk);
    }
    expect(activeItemKey("/admin")).toBe("overview");
  });
});
