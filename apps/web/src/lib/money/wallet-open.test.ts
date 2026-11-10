import { describe, expect, it } from "vitest";
import { buildNav } from "@/components/app/nav-model";
import { getDictionary } from "@vallo/i18n";
import { shellDictionary } from "@/lib/i18n/shell-dictionary";
import { WALLET_OPEN } from "./wallet-open";

/**
 * THE WALLET IS HIDDEN (founder, 10 November 2026): no wallet provider, so
 * the screens are unreachable behind one switch, closed by default, and no
 * navigation entry points at them. The code stays so it can return.
 */
describe("the wallet switch", () => {
  it("is closed", () => {
    expect(WALLET_OPEN).toBe(false);
  });

  it("leaves the Wallet out of the navigation for a signed-in member on both sides", () => {
    const t = shellDictionary(getDictionary("en"));
    for (const side of ["property", "stays"] as const) {
      const hrefs = buildNav({ t, side, signedIn: true, unreadNotifications: 0, isAgent: false, isAdmin: false }).flatMap((section) =>
        section.items.map((item) => item.href),
      );
      expect(hrefs).not.toContain("/wallet");
    }
  });
});
