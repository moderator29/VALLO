import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { shellDictionary } from "@/lib/i18n/shell-dictionary";
import { buildNav, formerTrayItems, type NavLeaf } from "./nav-model";

/**
 * THE DOCK'S CENTRE BECAME VALLO CIRCLE (founder, 7 November 2026), and the
 * grid tray it replaced must lose nothing: every destination the tray held is
 * one tap from the side menu, on both sides, signed in and signed out, and
 * Circle itself has a row.
 */
const t = shellDictionary(getDictionary("en"));

function hrefs(sections: ReturnType<typeof buildNav>): Set<string> {
  const out = new Set<string>();
  const walk = (items: readonly (NavLeaf & { children?: readonly NavLeaf[] })[]) => {
    for (const item of items) {
      out.add(item.href);
      if (item.children) walk(item.children);
    }
  };
  for (const section of sections) walk(section.items as readonly (NavLeaf & { children?: readonly NavLeaf[] })[]);
  return out;
}

describe("the side menu keeps every destination of the old dock tray", () => {
  for (const side of ["property", "stays"] as const) {
    for (const signedIn of [true, false]) {
      it(`${side} side, ${signedIn ? "signed in" : "signed out"}`, () => {
        const nav = buildNav({ t, side, unreadNotifications: 0, isAgent: false, isAdmin: false, signedIn });
        const listed = hrefs(nav);
        for (const item of formerTrayItems(t, signedIn, side === "stays")) {
          expect(listed.has(item.href), item.href).toBe(true);
        }
        expect(listed.has("/circle"), "Circle has a row").toBe(true);
      });
    }
  }
});
