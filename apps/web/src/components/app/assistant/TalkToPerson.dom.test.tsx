/**
 * TALK TO A PERSON, FROM INSIDE THE ASSISTANT, IN CHROMIUM (Platform Grade 1,
 * P1.4; reference R70).
 *
 * The real `AssistantChat`: "Talk to a person" sits by the composer, opens
 * the inner page `/assistant/person`, and takes what the member was asking
 * with it. The real `PersonHandoff`: the question arrives filled in, Send
 * files it through the support flow that exists (`fileSupportTicket`, staged
 * here) with the assistant exchange as the ticket's first message, and the
 * member lands in that support conversation. Back goes to the assistant.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const chatEntry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { AssistantChat } from "@/components/app/assistant/AssistantChat";
  import { assistantCopyOf } from "@/components/app/assistant/assistant-copy";
  mount(<AssistantChat locale="en" t={assistantCopyOf(getDictionary("en"))} />);
`;

/* A link would leave the page; it is recorded instead. */
const stayHere = `
  window.__opened = [];
  document.addEventListener("click", (event) => {
    const a = event.target.closest && event.target.closest("a");
    if (a) { event.preventDefault(); window.__opened.push(a.getAttribute("href")); }
  }, true);
`;

const personEntry = (signedIn: boolean) => `
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { PersonHandoff } from "@/components/app/assistant/PersonHandoff";
  mount(
    <>
      <PersonHandoff signedIn={${signedIn}} openTickets={[{ id: "t-open", reference: "VAL-SUP-00042", topic: "Payments", unread: true }]} />
      <ToastHost />
    </>,
  );
`;

const seeded = `
  ${stayHere}
  sessionStorage.setItem("nf_ai_handoff", JSON.stringify({
    question: "My deposit for the Yaba flat was not returned",
    transcript: "Conversation with Vallo AI before this ticket:\\nMember: My deposit for the Yaba flat was not returned",
    at: Date.now(),
  }));
`;

describe.skipIf(!hasBrowser && !process.env.CI)("talk to a person", () => {
  it("is by the assistant's composer and carries what the member was asking", async () => {
    const { page, close } = await mountInBrowser({ entry: chatEntry, init: stayHere });
    try {
      const link = page.getByTestId("assistant-talk-to-person");
      await link.waitFor();
      expect(await link.textContent()).toContain("Talk to a person");
      expect(await link.getAttribute("href")).toBe("/assistant/person");
      await page.locator("#assistant-input").fill("Is there a 2 bed in Yaba under 2 million?");
      await link.click();
      expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(["/assistant/person"]);
      const handoff = await page.evaluate(() => JSON.parse(sessionStorage.getItem("nf_ai_handoff") ?? "null"));
      expect(handoff.question).toBe("Is there a 2 bed in Yaba under 2 million?");
      expect(handoff.transcript).toContain("Member: Is there a 2 bed in Yaba under 2 million?");
    } finally {
      await close();
    }
  });

  it("files the question with the assistant exchange and opens the support conversation", async () => {
    const { page, close } = await mountInBrowser({
      entry: personEntry(true),
      init: seeded,
      actions: { fileSupportTicket: `async () => ({ ok: true, data: { reference: "VAL-SUP-01234", id: "t-new" } })` },
    });
    try {
      const field = page.getByTestId("person-question");
      await field.waitFor();
      await expect.poll(() => field.inputValue()).toBe("My deposit for the Yaba flat was not returned");
      expect(await page.getByTestId("person-context").count()).toBe(1);
      /* A support conversation still open is offered first. */
      expect(await page.getByTestId("person-open-ticket").getAttribute("href")).toBe("/support/messages/t-open");
      /* Signed in: no name or email asked for. */
      expect(await page.getByLabel("Email to reply to").count()).toBe(0);

      await page.getByTestId("person-send").click();
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __router: { calls: unknown[][] } }).__router?.calls ?? []))
        .toContainEqual(["push", "/support/messages/t-new"]);
      const sent = await page.evaluate(() => ((window as unknown as { __calls: unknown[][] }).__calls ?? []).find((c) => c[0] === "fileSupportTicket")?.[1]);
      expect(sent).toEqual({
        topic: "other",
        kind: "question",
        body: "My deposit for the Yaba flat was not returned",
        summary: "Conversation with Vallo AI before this ticket:\nMember: My deposit for the Yaba flat was not returned",
      });
      await expect.poll(() => page.getByText("Sent to the support team. A person will reply here.").count()).toBe(1);
      /* The hand-over is used once. */
      expect(await page.evaluate(() => sessionStorage.getItem("nf_ai_handoff"))).toBeNull();
      expect(await page.getByTestId("person-back").getAttribute("href")).toBe("/assistant");
    } finally {
      await close();
    }
  });

  it("asks a signed-out member who to reply to, and says a refusal in the banner", async () => {
    const { page, close } = await mountInBrowser({
      entry: personEntry(false),
      init: seeded,
      actions: {
        fileSupportTicket: `async () => ({ ok: false, error: "Add your name and an email address so we can reply.", fieldErrors: { email: "Add an email address so we can reply." } })`,
      },
    });
    try {
      await page.getByLabel("Your name").fill("Ada");
      await page.getByTestId("person-send").click();
      await expect.poll(() => page.getByText("Add your name and an email address so we can reply.").count()).toBeGreaterThan(0);
      expect(await page.getByText("Add an email address so we can reply.").count()).toBeGreaterThan(0);
      /* Nothing was lost: the question is still there to send again. */
      expect(await page.getByTestId("person-question").inputValue()).toBe("My deposit for the Yaba flat was not returned");
    } finally {
      await close();
    }
  });
});
