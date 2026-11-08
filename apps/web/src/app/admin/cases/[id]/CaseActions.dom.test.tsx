/**
 * THE CASE DESK'S ACTIONS, in a real Chromium: only the buttons the staff
 * member's `can` allows are drawn (the database decides `can` from their
 * scopes; the desk must not offer what the server would refuse), a closed
 * case offers only reopening, closing and a note, and a reader with no
 * decision rights is told where decisions sit.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const NONE = { note: false, assign: false, status: false, escalate: false, resolve: false, restrict: false, suspend: false, message: false, documents: false };
const SUBJECT = { userId: "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b", name: "Ada", handle: "ada", avatarUrl: null };

function entry(can: Partial<typeof NONE>, status = "under_review"): string {
  return `
    import { mount } from "@/lib/testing/browser-root";
    import { CaseActions } from "@/app/admin/cases/[id]/CaseActions";
    mount(
      <div style={{ width: 420, padding: 16 }}>
        <CaseActions
          caseId="00000000-0000-4000-8000-000000000001"
          status={${JSON.stringify(status)}}
          can={${JSON.stringify({ ...NONE, ...can })}}
          targetType="roommate_listing"
          subject={${JSON.stringify(SUBJECT)}}
          reporters={[]}
        />
      </div>,
    );
  `;
}

async function buttons(page: import("playwright-core").Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll("[data-testid='case-actions'] button")].map((b) => b.textContent?.trim() ?? ""));
}

describe.skipIf(!hasBrowser && !process.env.CI)("the case desk's actions follow can", () => {
  it("draws nothing to press for a reader with no rights, and says where decisions sit", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({}), css: productCss() });
    try {
      expect(await buttons(page)).toEqual([]);
      expect(await page.getByText("Decisions sit with its module's moderators").count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("offers a note-and-escalate role only Add note and Escalate", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ note: true, escalate: true }), css: productCss() });
    try {
      expect(await buttons(page)).toEqual(["Add note", "Escalate"]);
    } finally {
      await close();
    }
  });

  it("offers a moderator the decisions, and Restrict member only with a subject and the right", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ note: true, assign: true, status: true, escalate: true, resolve: true, restrict: true }), css: productCss() });
    try {
      const got = await buttons(page);
      for (const label of ["Take this case", "Add note", "Awaiting information", "Escalate", "Act on the content", "Restrict member", "Resolve"]) expect(got).toContain(label);
      expect(got).not.toContain("Message a member");
    } finally {
      await close();
    }
  });

  it("offers a closed case only reopening, closing a resolved one, and a note", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ note: true, resolve: true, escalate: true }, "resolved"), css: productCss() });
    try {
      expect(await buttons(page)).toEqual(["Close case", "Reopen", "Add note"]);
    } finally {
      await close();
    }
  });
});
