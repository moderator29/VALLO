/**
 * The profile's Email row at 390, mounted for real in Chromium with the
 * settings rows' own stylesheet: the address starts on the same left edge as
 * the row's label and its note, inside the row, and never floats on a line of
 * its own at the right. Set `HUNTER_SHOTS_DIR` to also write a screenshot.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const WEB = join(__dirname, "..", "..", "..", "..");
const CSS = [
  PORTED_CSS,
  readFileSync(join(WEB, "src", "app", "settings-rows.css"), "utf8"),
  ".block{display:block}",
  "#root{padding:16px;}",
].join("\n");

/* The row exactly as AccountBody writes it, with a long address. */
const entry = `
  import { RowLink, RowValue, SettingsGroup } from "@/components/app/account/rows";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <SettingsGroup>
      <RowLink href="/profile" icon="user" label="Your details" sub="Name, nickname and phone number" />
      <RowValue
        icon="mail"
        label="Email"
        testId="row-email"
        sub={
          <>
            <span className="block" style={{ overflowWrap: "break-word" }} data-testid="profile-email">
              a.very.long.member.address+with.a.tag@an-example-mail-host.com.ng
            </span>
            <span className="block">Your email address cannot be changed.</span>
          </>
        }
      />
    </SettingsGroup>,
  );
`;

describe.skipIf(!hasBrowser)("the profile's Email row", () => {
  it("keeps the address in the row's text column, on the label's left edge", async () => {
    for (const width of [390, 360]) {
      const { page, close } = await mountInBrowser({ entry, css: CSS, viewport: { width, height: 844 } });
      try {
        await page.waitForSelector('[data-testid="profile-email"]');
        const box = await page.evaluate(() => {
          const row = document.querySelector('[data-testid="row-email"]')!;
          const label = row.querySelector(".nf-srow__label")!.getBoundingClientRect();
          const email = row.querySelector('[data-testid="profile-email"]')!.getBoundingClientRect();
          const r = row.getBoundingClientRect();
          return { labelLeft: Math.round(label.left), emailLeft: Math.round(email.left), emailRight: Math.round(email.right), rowRight: Math.round(r.right) };
        });
        expect(box.emailLeft).toBe(box.labelLeft);
        expect(box.emailRight).toBeLessThanOrEqual(box.rowRight);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        if (width === 390 && process.env.HUNTER_SHOTS_DIR) {
          await page.screenshot({ path: join(process.env.HUNTER_SHOTS_DIR, "profile-email-row-390.png") });
        }
      } finally {
        await close();
      }
    }
  });
});
