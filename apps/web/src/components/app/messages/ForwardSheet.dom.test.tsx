/**
 * FORWARD, MOUNTED FOR REAL IN CHROMIUM (founder, 11 October 2026).
 *
 * The chooser is the real `ForwardSheet` inside the real `Sheet`, on the
 * product's own overlay and thread stylesheets. The two server actions are the
 * harness's staged answers: `readForwardTargets` hands back the list, and
 * `forwardMessage` says ok or refuses with the database's own words. What is
 * held: the list and its search, one tap forwards with the message's id and
 * the conversation's id, a refusal shows the sentence and keeps the sheet
 * open, the empty state is the founder's sentence, and the menu draws Forward
 * only when it is asked to.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/overlays.css", "app/css/threads.css");

const TARGETS = JSON.stringify([
  { id: "c-ada", name: "Ada Eze", title: "Lekki 2 bedroom flat", avatarUrl: null, tier: "none", kind: "member" },
  { id: "c-bola", name: "Bola Ade", title: null, avatarUrl: null, tier: "none", kind: "agent" },
]);

const sheetEntry = `
  import { useState } from "react";
  import { mount } from "@/lib/testing/browser-root";
  import { ForwardSheet } from "@/components/app/messages/ForwardSheet";
  import { getDictionary } from "@vallo/i18n";
  function Harness() {
    const [open, setOpen] = useState(true);
    const [done, setDone] = useState(null);
    return (
      <div>
        <p data-testid="done">{done ?? ""}</p>
        <ForwardSheet
          words={getDictionary("en").experienceInbox.thread.forward}
          open={open}
          messageId="m-1"
          fromConversationId="c-here"
          onClose={() => setOpen(false)}
          onForwarded={(target) => { setDone(target.name); setOpen(false); }}
        />
      </div>
    );
  }
  mount(<Harness />);
`;

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);

describe.skipIf(!hasBrowser && !process.env.CI)("the forward chooser", () => {
  it("lists the chats, searches them, and forwards with one tap", async () => {
    const { page, close } = await mountInBrowser({
      entry: sheetEntry,
      css: CSS,
      actions: {
        readForwardTargets: `async () => ${TARGETS}`,
        forwardMessage: `async () => ({ ok: true, data: { messageId: "m-new" } })`,
      },
    });
    try {
      await page.getByTestId("forward-row").first().waitFor();
      expect(await page.getByTestId("forward-row").count()).toBe(2);
      /* The list was asked for without the conversation the message came from. */
      expect((await calls(page)).find((c) => c[0] === "readForwardTargets")?.[1]).toEqual({ fromConversationId: "c-here" });

      await page.getByTestId("forward-search").fill("lekki");
      expect(await page.getByTestId("forward-row").count()).toBe(1);
      await page.getByTestId("forward-search").fill("nobody");
      await page.getByTestId("forward-no-match").waitFor();
      await page.getByTestId("forward-search").fill("");

      await page.getByTestId("forward-row").filter({ hasText: "Bola Ade" }).click();
      await page.getByTestId("done").filter({ hasText: "Bola Ade" }).waitFor();
      const forward = (await calls(page)).find((c) => c[0] === "forwardMessage");
      expect(forward?.[1]).toEqual({ messageId: "m-1", conversationId: "c-bola" });
    } finally {
      await close();
    }
  });

  it("shows the database's sentence on a refusal and stays open", async () => {
    const { page, close } = await mountInBrowser({
      entry: sheetEntry,
      css: CSS,
      actions: {
        readForwardTargets: `async () => ${TARGETS}`,
        forwardMessage: `async () => ({ ok: false, error: "you can forward only to people you follow" })`,
      },
    });
    try {
      await page.getByTestId("forward-row").first().click();
      const refusal = page.getByTestId("forward-refusal");
      await refusal.waitFor();
      expect(await refusal.textContent()).toBe("You can forward only to people you follow.");
      expect(await page.getByTestId("forward-sheet").count()).toBe(1);
      expect(await page.getByTestId("done").textContent()).toBe("");
    } finally {
      await close();
    }
  });

  it("says the founder's sentence when the reader follows nobody they chat with", async () => {
    const { page, close } = await mountInBrowser({
      entry: sheetEntry,
      css: CSS,
      actions: { readForwardTargets: `async () => []` },
    });
    try {
      const empty = page.getByTestId("forward-empty");
      await empty.waitFor();
      expect((await empty.textContent())?.trim()).toBe("Follow someone to forward a message to them.");
      expect(await page.getByTestId("forward-search").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("draws Forward in the menu only when the message can go", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { MessageMenu } from "@/components/app/messages/MessageMenu";
        import { getDictionary } from "@vallo/i18n";
        const noop = () => {};
        const words = getDictionary("en").experienceInbox.thread.menu;
        mount(
          <div>
            <div data-testid="text"><MessageMenu words={words} canCopy canDeleteEveryone={false} canForward onReply={noop} onForward={() => { window.__forward = true; }} onCopy={noop} onDeleteForMe={noop} onDeleteForEveryone={noop} onClose={noop} /></div>
            <div data-testid="photo"><MessageMenu words={words} canCopy={false} canDeleteEveryone={false} canForward={false} onReply={noop} onForward={noop} onCopy={noop} onDeleteForMe={noop} onDeleteForEveryone={noop} onClose={noop} /></div>
          </div>,
        );
      `,
      css: CSS,
    });
    try {
      expect(await page.getByTestId("photo").getByRole("menuitem", { name: "Forward" }).count()).toBe(0);
      const forward = page.getByTestId("text").getByRole("menuitem", { name: "Forward" });
      expect(await forward.count()).toBe(1);
      await forward.dispatchEvent("click");
      expect(await page.evaluate(() => (window as unknown as { __forward?: boolean }).__forward)).toBe(true);
    } finally {
      await close();
    }
  });
});
