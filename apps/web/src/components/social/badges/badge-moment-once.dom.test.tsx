/**
 * THE EARNED MOMENT PLAYS ONCE AND NEVER AGAIN (the founder, 12 November 2026:
 * the celebration opened every single time he tapped through to his profile).
 *
 * `BadgeEarnedHost` is the component whose entire reason for existing is "once
 * per badge, per account, on this device", and until this file nothing asserted
 * it: `badges.dom.test.tsx` mounts `BadgeRow` only. So the row's decoration was
 * covered in nine tests while the one promise a person would notice breaking
 * had none.
 *
 * Every test here mounts the real host in a real browser against the real
 * `localStorage`, celebrates, dismisses, and then MOUNTS IT AGAIN in the same
 * page, which is what tapping back into the profile does. The second mount must
 * draw nothing.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { PORTED_CSS } from "@/components/ui/ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const VIEWER = "viewer-1";

/**
 * A harness that can unmount and remount the host on demand, because a second
 * visit to the profile is a fresh mount against the same storage. "visit"
 * renders it; "leave" takes it away, the way routing to another page does.
 */
function entry(grantedDaysAgo: number) {
  return `
    import { useState } from "react";
    import { BadgeEarnedHost } from "@/components/social/badges/BadgeEarnedHost";
    import { mount } from "@/lib/testing/browser-root";

    const granted = new Date(Date.now() - ${grantedDaysAgo} * 24 * 60 * 60 * 1000).toISOString();
    const badges = [{
      code: "verified-member",
      name: "Verified Member",
      description: "Email and phone confirmed.",
      objectName: "shield",
      tier: 1,
      grantedAt: granted,
      grantedLabel: "1 November 2026",
      earned: true,
    }];
    const copy = {
      overline: "Badge earned", share: "Share", back: "Back",
      viewProfile: "View on my profile",
      shareText: "I earned {badge} on Vallo.",
      copied: "Copied.", copyFailed: "Could not share.",
      replayHint: "Tap the medal to see it again",
      title: "Badges", givenBy: "Given by the Vallo team",
      earnedOn: "Earned on {date}", means: "What it means",
    };

    function Harness() {
      const [visit, setVisit] = useState(1);
      const [here, setHere] = useState(true);
      return (
        <>
          <button data-testid="leave" onClick={() => setHere(false)}>leave</button>
          <button data-testid="visit" onClick={() => { setHere(true); setVisit((n) => n + 1); }}>visit</button>
          <span data-testid="visit-count">{visit}</span>
          {here ? <BadgeEarnedHost key={visit} viewerId="${VIEWER}" badges={badges} copy={copy} /> : null}
        </>
      );
    }
    mount(<Harness />);
  `;
}

/** The host waits 600ms after mount before it opens; give it room, then settle. */
const OPEN_WAIT = 1400;

describe.skipIf(!hasBrowser && !process.env.CI)("the earned moment, once and never again", () => {
  it("celebrates a recent badge on the first visit, and never on the visits after it", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(11), css: PORTED_CSS });
    try {
      /* First visit: it plays. */
      await page.getByTestId("badge-moment").waitFor({ timeout: OPEN_WAIT });

      /* Dismissed the way a person does. */
      await page.getByRole("button", { name: "Back" }).click();
      await page.getByTestId("badge-moment").waitFor({ state: "detached" });

      /* The dismissal is written down, not just forgotten in memory. */
      const stored = await page.evaluate(
        (k) => window.localStorage.getItem(k),
        `nf_badges_shown:${VIEWER}`,
      );
      expect(stored).toContain("verified-member");

      /* Second visit, a fresh mount against that same storage. */
      await page.getByTestId("leave").click();
      await page.getByTestId("visit").click();
      await page.waitForTimeout(OPEN_WAIT);
      expect(await page.getByTestId("badge-moment").count()).toBe(0);

      /* And a third, because "every time" was the complaint. */
      await page.getByTestId("leave").click();
      await page.getByTestId("visit").click();
      await page.waitForTimeout(OPEN_WAIT);
      expect(await page.getByTestId("badge-moment").count()).toBe(0);
      expect(await page.getByTestId("visit-count").textContent()).toBe("3");
    } finally {
      await close();
    }
  });

  it("writes the badge down when it is dismissed by the sheet's own close, not only by Back", async () => {
    /* The founder's screenshot shows an X in the corner. It is the Sheet's own
       control, so it answers through onOpenChange rather than the Back button,
       and a dismissal that does not record itself is a replay on the next visit. */
    const { page, close } = await mountInBrowser({ entry: entry(11), css: PORTED_CSS });
    try {
      await page.getByTestId("badge-moment").waitFor({ timeout: OPEN_WAIT });
      await page.keyboard.press("Escape");
      await page.getByTestId("badge-moment").waitFor({ state: "detached" });

      const stored = await page.evaluate(
        (k) => window.localStorage.getItem(k),
        `nf_badges_shown:${VIEWER}`,
      );
      expect(stored).toContain("verified-member");

      await page.getByTestId("leave").click();
      await page.getByTestId("visit").click();
      await page.waitForTimeout(OPEN_WAIT);
      expect(await page.getByTestId("badge-moment").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("records the badge once it has been SHOWN, even if the screen is left without dismissing it", async () => {
    /*
     * THE FOUNDER'S BUG (12 November 2026): "anytime I click my profile icon it
     * always pops up". Every dismissal recorded itself, so the replay could not
     * come from Back, Escape, the X or a swipe. It came from the ways of
     * leaving that are not dismissals, and the native shell adds the common
     * one: `ValloShell.swift` sets `allowsBackForwardNavigationGestures`, so an
     * edge swipe navigates the web view away and the host unmounts with no
     * close ever called. Force quitting the app with the sheet open does the
     * same, and so does a crash.
     *
     * A celebration that has been put on the screen has been seen. It is
     * written down at that moment, not when somebody is polite enough to press
     * Back.
     */
    const { page, close } = await mountInBrowser({ entry: entry(11), css: PORTED_CSS });
    try {
      await page.getByTestId("badge-moment").waitFor({ timeout: OPEN_WAIT });

      /* Leave the page with the sheet still open: no Back, no Escape, no X.
         Dispatched rather than clicked, because the sheet is modal and its own
         overlay would swallow a real press. An edge swipe does not go through
         the page's hit testing either: it takes the web view out from under
         it, which is exactly what this stands for. */
      await page.evaluate(() => {
        (document.querySelector('[data-testid="leave"]') as HTMLButtonElement | null)?.click();
      });
      await page.getByTestId("badge-moment").waitFor({ state: "detached" });

      const stored = await page.evaluate(
        (k) => window.localStorage.getItem(k),
        `nf_badges_shown:${VIEWER}`,
      );
      expect(stored).toContain("verified-member");

      await page.getByTestId("visit").click();
      await page.waitForTimeout(OPEN_WAIT);
      expect(await page.getByTestId("badge-moment").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("never celebrates a badge older than the moment window, and remembers it so it cannot start later", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(45), css: PORTED_CSS });
    try {
      await page.waitForTimeout(OPEN_WAIT);
      expect(await page.getByTestId("badge-moment").count()).toBe(0);
      const stored = await page.evaluate(
        (k) => window.localStorage.getItem(k),
        `nf_badges_shown:${VIEWER}`,
      );
      expect(stored).toContain("verified-member");
    } finally {
      await close();
    }
  });
});
