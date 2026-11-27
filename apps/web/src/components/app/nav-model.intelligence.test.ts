import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { shellDictionary } from "@/lib/i18n/shell-dictionary";
import { buildNav } from "./nav-model";

/**
 * VALLO INTELLIGENCE IN THE SIDE NAVIGATION (the founder, 16 November 2026):
 * one row with the spark, near the top, on both sides, signed in or out.
 * It is the section right after the docked group, so a phone's drawer (which
 * hides that group, the dock carries it) shows it first, and the desktop
 * rail shows it right under Home, Search and Feed.
 */
const t = shellDictionary(getDictionary("en"));

describe("VALLO Intelligence in the side navigation", () => {
  for (const side of ["property", "stays"] as const) {
    for (const signedIn of [true, false]) {
      it(`is its own row right after the docked group (${side}, ${signedIn ? "signed in" : "signed out"})`, () => {
        const nav = buildNav({ t, side, unreadNotifications: 0, isAgent: false, isAdmin: false, signedIn });
        expect(nav[0]!.hideWhenDocked).toBe(true);
        const section = nav[1]!;
        expect(section.hideWhenDocked, "a phone drawer must show it").toBeFalsy();
        /* `betaLabel` beside it since 27 November 2026: the row is marked as a
           product area still being built, the same mark Roommates and the AI
           Assistant carry. */
        expect(section.items).toEqual([
          { href: "/intelligence", label: "VALLO Intelligence", icon: "spark", betaLabel: "Beta" },
        ]);
        expect(nav.flatMap((s) => s.items).filter((i) => i.href === "/intelligence")).toHaveLength(1);
      });
    }
  }

  it("draws no row for a shell handed a whole dictionary (no entry slice)", () => {
    const whole = getDictionary("en") as unknown as Parameters<typeof buildNav>[0]["t"];
    const nav = buildNav({ t: whole, unreadNotifications: 0, isAgent: false, isAdmin: false, signedIn: true });
    expect(nav.flatMap((s) => s.items).some((i) => i.href === "/intelligence")).toBe(false);
  });
});
