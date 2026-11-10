import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { shellDictionary } from "@/lib/i18n/shell-dictionary";
import { buildNav, isCurrent } from "./nav-model";

const t = shellDictionary(getDictionary("en"));
const off = { ...t, roommatesEntry: undefined };

describe("Vallo Roommates in the side navigation", () => {
  for (const side of ["property", "stays"] as const) {
    it(`is its own top-level row on the ${side} side, not under Circle and not in the docked group`, () => {
      const nav = buildNav({ t, side, unreadNotifications: 0, isAgent: false, isAdmin: false, signedIn: true });
      const sectionIndex = nav.findIndex((s) => s.items.some((i) => i.href === "/roommates"));
      expect(sectionIndex).toBeGreaterThan(0);
      const section = nav[sectionIndex]!;
      expect(section.hideWhenDocked, "a phone drawer must show it").toBeFalsy();
      expect(section.items[0]).toMatchObject({ href: "/roommates", icon: "house-duplex", label: t.roommatesEntry!.nav });
      const circle = nav.flatMap((s) => s.items).find((i) => i.href === "/circle");
      expect(circle).toBeDefined();
      expect((circle as { children?: unknown[] }).children ?? []).toHaveLength(0);
    });
    it(`is hidden on the ${side} side when the roommates switch is off`, () => {
      const nav = buildNav({ t: off, side, unreadNotifications: 0, isAgent: false, isAdmin: false, signedIn: true });
      expect(nav.flatMap((s) => s.items).some((i) => i.href === "/roommates")).toBe(false);
    });
  }

  it("lights the row on every /roommates page and on no other", () => {
    expect(isCurrent("/roommates", "/roommates", null)).toBe(true);
    expect(isCurrent("/roommates", "/roommates/discover", null)).toBe(true);
    expect(isCurrent("/roommates", "/roommates/r/abc/edit", null)).toBe(true);
    expect(isCurrent("/roommates", "/roommatesx", null)).toBe(false);
    expect(isCurrent("/roommates", "/circle", null)).toBe(false);
  });
});
