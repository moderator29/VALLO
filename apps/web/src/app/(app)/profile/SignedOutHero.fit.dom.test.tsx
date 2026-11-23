/**
 * A SETTINGS ROW'S VALUE FITS A PHONE (23 November 2026).
 *
 * The same family of fault as Talk to a person: a row's value (`.nf-srow__value`)
 * was one line that never wrapped, so a value longer than the whole row, a
 * long email address being the case that matters, ran past the right edge of
 * a 390px phone. The value still moves to a line of its own rather than
 * breaking beside the label; only a value longer than the row now wraps,
 * inside it, still whole. This mounts the signed-out profile, whose "On this
 * device" card shows the email kept in this browser, in the app's own
 * stylesheet inside a 16px gutter, and checks every row and value stays
 * inside the gutter.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { layoutCss } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const EMAIL = "adaeze.okonkwo-nwachukwu.properties@longcompanydomain.com.ng";

const entry = `
  import { mount } from "@/lib/testing/browser-root";
  import { SignedOutHero } from "@/app/(app)/profile/SignedOutHero";
  mount(
    <div style={{ paddingInline: "16px" }}>
      <div className="mx-auto max-w-2xl">
        <SignedOutHero unconfigured={false} />
      </div>
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the signed-out profile on a phone", () => {
  it("keeps a long email on this device inside the gutter, whole", async () => {
    const css = await layoutCss("app/(app)/layout.tsx");
    const { page, close } = await mountInBrowser({
      entry,
      css,
      init: `localStorage.setItem("nf_profile_name", "Adaeze Okonkwo"); localStorage.setItem("nf_profile_email", ${JSON.stringify(EMAIL)});`,
      viewport: { width: 390, height: 844 },
    });
    try {
      await page.getByTestId("device-name-row").waitFor();
      const fit = await page.evaluate((email) => {
        const limit = window.innerWidth - 16 + 0.5;
        const rows = [...document.querySelectorAll<HTMLElement>(".nf-srow, .nf-srow__value")];
        const over = rows
          .map((el) => ({ el, right: el.getBoundingClientRect().right }))
          .filter(({ right }) => right > limit)
          .map(({ el, right }) => `${el.tagName.toLowerCase()}.${el.className} "${(el.textContent ?? "").slice(0, 30)}" ${Math.round(right)}`);
        return { over, shown: rows.some((el) => el.classList.contains("nf-srow__value") && el.textContent === email) };
      }, EMAIL);
      expect(fit.shown).toBe(true);
      expect(fit.over).toEqual([]);
    } finally {
      await close();
    }
  });
});
