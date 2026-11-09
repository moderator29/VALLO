import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { shellDictionary } from "@/lib/i18n/shell-dictionary";
import { buildNav } from "./nav-model";

/*
 * THE MONEY GROUP IS THREE ROWS (D78, 7 October 2026, evening).
 *
 * Wallet (once it is live), Rewards and Referral. Payments, Receipts, Payouts and Refunds are
 * rows on the Wallet screen (the founder: all of it lives inside the wallet),
 * and the Leaderboard opens from the Referral page. This fails if the group
 * grows those rows back, or loses one of its three.
 */
const t = shellDictionary(getDictionary("en"));
const base = { t, unreadNotifications: 0, isAgent: false, isAdmin: false };
/* The founder, 9 November 2026: the Wallet row is not drawn until the new
   rail is live and the member's Wallet is connected (`walletLive`). */
const MONEY = ["/rewards", "/settings/invite"];
const MONEY_LIVE = ["/wallet", ...MONEY];
/* Moved, not deleted: none of these is a side-nav row any more. */
const MOVED = ["/payments", "/receipts", "/payouts", "/refunds", "/leaderboard"];

describe("the side navigation's money group", () => {
  for (const side of ["property", "stays"] as const) {
    it(`carries every money destination on the ${side} side, under one heading`, () => {
      const sections = buildNav({ ...base, side, signedIn: true });
      const money = sections.find((s) => s.heading === t.experienceShell.navMoneyLabel);
      expect(money?.items.map((i) => i.href)).toEqual(MONEY);
    });
  }

  it("draws the Wallet row only once the Wallet is live, and first in the group", () => {
    const hidden = buildNav({ ...base, side: "property", signedIn: true }).flatMap((s) => s.items.map((i) => i.href));
    expect(hidden).not.toContain("/wallet");
    for (const side of ["property", "stays"] as const) {
      const money = buildNav({ ...base, side, signedIn: true, walletLive: true }).find(
        (s) => s.heading === t.experienceShell.navMoneyLabel,
      );
      expect(money?.items.map((i) => i.href)).toEqual(MONEY_LIVE);
    }
  });

  it("does not carry the rows that moved into the Wallet and Referral", () => {
    const hrefs = buildNav({ ...base, side: "property", signedIn: true }).flatMap((s) => s.items.map((i) => i.href));
    for (const href of MOVED) expect(hrefs).not.toContain(href);
  });

  it("offers none of them to a signed-out visitor", () => {
    const hrefs = buildNav({ ...base, signedIn: false, walletLive: true }).flatMap((s) => s.items.map((i) => i.href));
    for (const href of MONEY_LIVE) expect(hrefs).not.toContain(href);
  });
});
