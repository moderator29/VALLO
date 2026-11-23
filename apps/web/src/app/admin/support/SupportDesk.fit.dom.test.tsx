/**
 * THE SUPPORT DESK'S MEMBER FACTS FIT A PHONE (23 November 2026).
 *
 * The same family of fault as Talk to a person: "Email on the ticket" is a
 * label and a value in one flex row, and a flex item will not shrink below
 * its longest word. An email address is one word, so a long one ran the
 * value past the right edge of a 390px phone instead of breaking. This
 * mounts the real desk on the preview fixtures (a ticket filed without an
 * account), in the console's own stylesheet, inside a 16px gutter, and checks
 * no fact in "The member" reaches past the gutter.
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
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { SupportDesk } from "@/app/admin/support/SupportDesk";
  import { detailFor, NOW, ROWS } from "@/app/(dev)/preview/support-staff/fixtures";
  const id = ROWS.find((row) => !row.hasAccount).id;
  const detail = detailFor(id, { escalationsInstalled: true });
  mount(
    <div style={{ paddingInline: "16px" }}>
      <SupportDesk
        now={NOW}
        tab="open"
        q=""
        queue={{ state: "ok", rows: ROWS, escalationsInstalled: true }}
        selected={{ ...detail, email: ${JSON.stringify(EMAIL)} }}
        missing={null}
        copy={getDictionary("en").admin.support}
      />
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the support desk on a phone", () => {
  it("breaks a long email on the ticket inside the gutter rather than running past the screen", async () => {
    const css = await layoutCss("app/admin/layout.tsx", "app/admin/_components/admin-material.css");
    const { page, close } = await mountInBrowser({ entry, css, viewport: { width: 390, height: 844 } });
    try {
      const member = page.locator("#support-member");
      await member.waitFor();
      const fit = await member.evaluate((section, email) => {
        const limit = window.innerWidth - 16 + 0.5;
        const facts = [...section.querySelectorAll<HTMLElement>("dl > div, dt, dd")];
        const over = facts
          .map((el) => ({ el, right: el.getBoundingClientRect().right }))
          .filter(({ right }) => right > limit)
          .map(({ el, right }) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").slice(0, 40)}" ${Math.round(right)}`);
        return { over, shown: facts.some((el) => el.textContent === email) };
      }, EMAIL);
      expect(fit.shown).toBe(true);
      expect(fit.over).toEqual([]);
    } finally {
      await close();
    }
  });
});
