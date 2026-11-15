/**
 * THE ESCALATION FORM, THE ESCALATE BUTTON AND THE RECORD'S ACTIONS, mounted
 * for real in Chromium at a phone's width. The server actions are stood in
 * for by recorders, so what is held here is what the person sees and exactly
 * what would have been sent:
 *
 *   - the "this goes to" line follows the kind of issue and the urgency, and
 *     says where it will really land when a team has nobody on it;
 *   - an ID, bank or card number is refused as it is typed, in the founder's
 *     words, and nothing can be sent while it is there;
 *   - "Never tell the member you suspect them" shows for identity and safety;
 *   - the page the button was pressed on travels as the attached record, and
 *     the overview attaches nothing;
 *   - a refusal from the server is said, and nothing claims to be sent;
 *   - an action that needs words cannot be sent without them.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { GLASS_CSS, productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss(GLASS_CSS, "app/css/typography.css", "app/css/controls.css");

const FORM = `
  import { EscalationForm } from "@/app/admin/escalations/EscalationForm";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <div style={{ padding: 16 }}>
      <EscalationForm sourcePath="/admin/kyc?person=abc" recordUrl="/admin/kyc?person=abc" recordLabel={null} staffed={["finance", "compliance", "coo"]} />
    </div>,
  );
`;

const BUTTON = (setUp: boolean) => `
  import { EscalateButton } from "@/app/admin/_components/EscalateButton";
  import { mount } from "@/lib/testing/browser-root";
  mount(<div style={{ padding: 16 }}><EscalateButton staffed={["finance", "coo"]} setUp={${setUp}} /></div>);
`;

const ACTIONS = `
  import { EscalationActions } from "@/app/admin/escalations/EscalationActions";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <div style={{ padding: 16 }}>
      <EscalationActions
        id="10000000-0000-4000-8000-000000000001"
        actions={["acknowledge", "assign", "comment", "reroute", "ask_raiser", "resolve", "decline"]}
        people={[{ id: "20000000-0000-4000-8000-000000000001", name: "Chidi Okafor" }]}
        currentRoute="finance"
      />
    </div>,
  );
`;

const RAISED = `async () => ({ ok: true, data: { id: "10000000-0000-4000-8000-000000000009", reference: "ESC-000123", routedTo: "coo", intended: "trust_safety", dueAt: null } })`;
const ACTED = `async () => ({ ok: true, data: { status: "resolved", routedTo: "finance" } })`;

type Call = [string, Record<string, unknown>];
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls?: Call[] }).__calls ?? []);
const where = (page: Page) => page.getByTestId("escalation-where").innerText();

async function fill(page: Page, over: { title?: string; happened?: string; needed?: string } = {}) {
  await page.getByTestId("escalation-title").fill(over.title ?? "A threat sent in a chat");
  await page.getByTestId("escalation-what-happened").fill(over.happened ?? "A member wrote a threat to a lister in a chat this morning.");
  await page.getByTestId("escalation-what-is-needed").fill(over.needed ?? "Decide what happens to the account.");
}

describe.skipIf(!hasBrowser && !process.env.CI)("the escalation form", () => {
  it("says where it will go and how soon, and follows the kind of issue and the urgency", async () => {
    const { page, close } = await mountInBrowser({ entry: FORM, css: CSS });
    try {
      expect(await where(page)).toBe("This goes to the COO. They aim to answer within 24 hours.");
      await page.getByTestId("escalation-category").selectOption("money");
      await page.locator('input[type=radio][value="high"]').check();
      expect(await where(page)).toBe("This goes to the Finance team. They aim to answer within 4 hours.");
      /* Nobody is on Trust and Safety here: identity falls to Compliance, safety straight to the COO. */
      await page.getByTestId("escalation-category").selectOption("identity_fraud");
      expect(await where(page)).toBe("Nobody is on Trust and Safety yet, so this goes to the Compliance team. They aim to answer within 4 hours.");
      await page.getByTestId("escalation-category").selectOption("safety");
      await page.locator('input[type=radio][value="urgent"]').check();
      expect(await where(page)).toBe("Nobody is on Trust and Safety yet, so this goes to the COO. They aim to answer within 1 hour.");
      expect(await page.getByTestId("escalation-route").innerText()).toContain("the super admin is told at once");
    } finally {
      await close();
    }
  });

  it("warns never to tip off the member on identity and safety only", async () => {
    const { page, close } = await mountInBrowser({ entry: FORM, css: CSS });
    try {
      expect(await page.getByTestId("escalation-no-tip-off").count()).toBe(0);
      for (const kind of ["identity_fraud", "safety"]) {
        await page.getByTestId("escalation-category").selectOption(kind);
        expect(await page.getByTestId("escalation-no-tip-off").innerText(), kind).toBe("Never tell the member you suspect them.");
      }
      await page.getByTestId("escalation-category").selectOption("technical");
      expect(await page.getByTestId("escalation-no-tip-off").count()).toBe(0);
      expect(await page.getByTestId("escalation-no-paste").innerText()).toBe("Do not paste ID numbers, bank details or documents. The link carries the record.");
    } finally {
      await close();
    }
  });

  it("refuses an ID, bank or card number as it is typed, and sends nothing while it is there", async () => {
    const { page, close } = await mountInBrowser({ entry: FORM, css: CSS, actions: { raiseEscalation: RAISED } });
    try {
      await fill(page);
      expect(await page.getByTestId("escalation-send").isDisabled()).toBe(false);
      for (const text of ["Their NIN is 12345678901 and it failed.", "Refund account 0123456789 today please.", "The card 4084 0840 8408 4081 was charged."]) {
        await page.getByTestId("escalation-what-happened").fill(text);
        expect(await page.getByTestId("escalation-number-refused").innerText(), text).toBe("Link the record instead of pasting an ID or account number.");
        expect(await page.getByTestId("escalation-send").isDisabled(), text).toBe(true);
        expect(await page.getByTestId("escalation-what-happened").getAttribute("aria-invalid"), text).toBe("true");
      }
      await page.getByTestId("escalation-what-happened").press("Enter");
      expect(await calls(page)).toEqual([]);
      await page.getByTestId("escalation-what-happened").fill("A member wrote a threat to a lister in a chat this morning.");
      expect(await page.getByTestId("escalation-number-refused").count()).toBe(0);
      expect(await page.getByTestId("escalation-send").isDisabled()).toBe(false);
    } finally {
      await close();
    }
  });

  it("cannot be sent until the title, what happened and what is needed are written", async () => {
    const { page, close } = await mountInBrowser({ entry: FORM, css: CSS });
    try {
      expect(await page.getByTestId("escalation-send").isDisabled()).toBe(true);
      await fill(page, { needed: "no" });
      expect(await page.getByTestId("escalation-send").isDisabled()).toBe(true);
      await fill(page);
      expect(await page.getByTestId("escalation-send").isDisabled()).toBe(false);
    } finally {
      await close();
    }
  });

  it("sends the five answers with the page attached, then says where it went and opens the record", async () => {
    const { page, close } = await mountInBrowser({ entry: FORM, css: CSS, actions: { raiseEscalation: RAISED } });
    try {
      expect(await page.getByTestId("escalation-attached").innerText()).toBe("Attached: this page");
      await page.getByTestId("escalation-category").selectOption("safety");
      await page.locator('input[type=radio][value="urgent"]').check();
      await fill(page);
      await page.getByTestId("escalation-send").click();
      await page.getByTestId("escalation-sent").waitFor();
      expect(await calls(page)).toEqual([
        [
          "raiseEscalation",
          {
            category: "safety",
            severity: "urgent",
            title: "A threat sent in a chat",
            whatHappened: "A member wrote a threat to a lister in a chat this morning.",
            whatIsNeeded: "Decide what happens to the account.",
            sourcePath: "/admin/kyc?person=abc",
            recordUrl: "/admin/kyc?person=abc",
            recordLabel: null,
            routedTo: null,
          },
        ],
      ]);
      expect(await page.getByTestId("escalation-sent").innerText()).toContain("ESC-000123 sent to the COO, because nobody is on Trust and Safety yet. They have been told.");
      expect(await page.getByTestId("escalation-sent-open").getAttribute("href")).toBe("/admin/escalations/10000000-0000-4000-8000-000000000009");
    } finally {
      await close();
    }
  });

  it("sends it somewhere else when the person chooses to, and back to the table when they change their mind", async () => {
    const { page, close } = await mountInBrowser({ entry: FORM, css: CSS, actions: { raiseEscalation: RAISED } });
    try {
      await fill(page);
      await page.getByTestId("escalation-elsewhere").click();
      await page.getByTestId("escalation-route-choice").selectOption("finance");
      expect(await where(page)).toBe("This goes to the Finance team. They aim to answer within 24 hours.");
      await page.getByTestId("escalation-route-choice").selectOption("");
      expect(await where(page)).toBe("This goes to the COO. They aim to answer within 24 hours.");
      await page.getByTestId("escalation-route-choice").selectOption("compliance");
      await page.getByTestId("escalation-send").click();
      await page.getByTestId("escalation-sent").waitFor();
      expect((await calls(page))[0]?.[1]).toMatchObject({ category: "other", routedTo: "compliance" });
    } finally {
      await close();
    }
  });

  it("says a refusal from the server and never claims it was sent", async () => {
    const refused = `async () => ({ ok: false, error: "Escalations are not set up on this server yet. Tell your lead directly for now." })`;
    const { page, close } = await mountInBrowser({ entry: FORM, css: CSS, actions: { raiseEscalation: refused } });
    try {
      await fill(page);
      await page.getByTestId("escalation-send").click();
      await page.getByText("Escalations are not set up on this server yet.").first().waitFor();
      expect(await page.getByTestId("escalation-sent").count()).toBe(0);
      expect(await page.getByTestId("escalation-title").inputValue()).toBe("A threat sent in a chat");
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the Escalate button in the console shell", () => {
  it("attaches the page it was pressed on, path and query, and closes once it is sent", async () => {
    const { page, close } = await mountInBrowser({ entry: BUTTON(true), css: CSS, actions: { raiseEscalation: RAISED }, url: "http://vallo.test/admin/people/abc?tab=documents" });
    try {
      const open = page.getByTestId("escalate-open");
      expect(await open.innerText()).toBe("Escalate");
      expect(await open.getAttribute("aria-haspopup")).toBe("dialog");
      await open.click();
      await page.getByRole("dialog", { name: "Escalate" }).waitFor();
      expect(await page.getByTestId("escalation-attached").innerText()).toBe("Attached: this page");
      await fill(page);
      await page.getByTestId("escalation-send").click();
      await page.getByRole("dialog", { name: "Escalate" }).waitFor({ state: "detached" });
      expect((await calls(page))[0]?.[1]).toMatchObject({ sourcePath: "/admin/people/abc?tab=documents", recordUrl: "/admin/people/abc?tab=documents" });
    } finally {
      await close();
    }
  });

  it("attaches nothing on the overview, where there is no record", async () => {
    const { page, close } = await mountInBrowser({ entry: BUTTON(true), css: CSS, actions: { raiseEscalation: RAISED }, url: "http://vallo.test/admin" });
    try {
      await page.getByTestId("escalate-open").click();
      expect(await page.getByTestId("escalation-attached").innerText()).toContain("Nothing is attached.");
      await fill(page);
      await page.getByTestId("escalation-send").click();
      await page.getByRole("dialog", { name: "Escalate" }).waitFor({ state: "detached" });
      expect((await calls(page))[0]?.[1]).toMatchObject({ sourcePath: "/admin", recordUrl: null });
    } finally {
      await close();
    }
  });

  it("says not set up yet, instead of a form that cannot send, before the SQL has run", async () => {
    const { page, close } = await mountInBrowser({ entry: BUTTON(false), css: CSS, url: "http://vallo.test/admin/kyc" });
    try {
      await page.getByTestId("escalate-open").click();
      await page.getByTestId("escalations-not-set-up").waitFor();
      expect(await page.getByTestId("escalations-not-set-up").innerText()).toContain("Escalations are not set up yet");
      expect(await page.getByTestId("escalation-form").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("is not drawn on the form's own page", async () => {
    const { page, close } = await mountInBrowser({ entry: BUTTON(true), css: CSS, url: "http://vallo.test/admin/escalations/new" });
    try {
      expect(await page.getByTestId("escalate-open").count()).toBe(0);
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the actions on one escalation", () => {
  it("marks it seen in one press", async () => {
    const { page, close } = await mountInBrowser({ entry: ACTIONS, css: CSS, actions: { actOnEscalation: ACTED } });
    try {
      await page.getByTestId("escalation-act-acknowledge").click();
      await page.getByText("Marked as seen. The raiser has been told.").first().waitFor();
      expect(await calls(page)).toEqual([["actOnEscalation", { id: "10000000-0000-4000-8000-000000000001", action: "acknowledge", body: null, target: null }]]);
    } finally {
      await close();
    }
  });

  it("resolves only with a closing note of ten characters, and refuses a number in it", async () => {
    const { page, close } = await mountInBrowser({ entry: ACTIONS, css: CSS, actions: { actOnEscalation: ACTED } });
    try {
      await page.getByTestId("escalation-act-resolve").click();
      const send = page.getByTestId("escalation-act-send");
      expect(await send.isDisabled()).toBe(true);
      await page.getByTestId("escalation-act-body").fill("done");
      expect(await send.isDisabled()).toBe(true);
      await page.getByTestId("escalation-act-body").fill("Refund sent to account 0123456789 today.");
      expect(await send.isDisabled()).toBe(true);
      expect(await page.getByRole("alert").filter({ hasText: "Link the record" }).count()).toBeGreaterThan(0);
      await page.getByTestId("escalation-act-body").fill("Both accounts are held while we look.");
      await send.click();
      await page.getByText("Resolved. The raiser has been told.").first().waitFor();
      expect(await calls(page)).toEqual([
        ["actOnEscalation", { id: "10000000-0000-4000-8000-000000000001", action: "resolve", body: "Both accounts are held while we look.", target: null }],
      ]);
    } finally {
      await close();
    }
  });

  it("sends to another team only with a team and a reason, and never offers the team it is already with", async () => {
    const { page, close } = await mountInBrowser({ entry: ACTIONS, css: CSS, actions: { actOnEscalation: ACTED } });
    try {
      await page.getByTestId("escalation-act-reroute").click();
      const options = await page.getByTestId("escalation-act-route").locator("option").allInnerTexts();
      expect(options).not.toContain("The Finance team");
      expect(options).toContain("The Compliance team");
      await page.getByTestId("escalation-act-body").fill("This is a compliance question, not a money one.");
      expect(await page.getByTestId("escalation-act-send").isDisabled()).toBe(true);
      await page.getByTestId("escalation-act-route").selectOption("compliance");
      await page.getByTestId("escalation-act-send").click();
      await page.getByText("Sent on. The new team has been told.").first().waitFor();
      expect((await calls(page))[0]).toEqual([
        "actOnEscalation",
        { id: "10000000-0000-4000-8000-000000000001", action: "reroute", body: "This is a compliance question, not a money one.", target: "compliance" },
      ]);
    } finally {
      await close();
    }
  });

  it("lets a lead give it to a named person", async () => {
    const { page, close } = await mountInBrowser({ entry: ACTIONS, css: CSS, actions: { actOnEscalation: ACTED } });
    try {
      await page.getByTestId("escalation-act-give").click();
      expect(await page.getByTestId("escalation-act-send").isDisabled()).toBe(true);
      await page.getByTestId("escalation-act-person").selectOption({ label: "Chidi Okafor" });
      await page.getByTestId("escalation-act-send").click();
      await page.getByText("Handed over. They have been told.").first().waitFor();
      expect((await calls(page))[0]).toEqual([
        "actOnEscalation",
        { id: "10000000-0000-4000-8000-000000000001", action: "assign", body: null, target: "20000000-0000-4000-8000-000000000001" },
      ]);
    } finally {
      await close();
    }
  });

  it("says a refusal and keeps the words the person wrote", async () => {
    const refused = `async () => ({ ok: false, error: "That is not yours to do on this escalation." })`;
    const { page, close } = await mountInBrowser({ entry: ACTIONS, css: CSS, actions: { actOnEscalation: refused } });
    try {
      await page.getByTestId("escalation-act-decline").click();
      await page.getByTestId("escalation-act-body").fill("This belongs with the payment partner.");
      await page.getByTestId("escalation-act-send").click();
      await page.getByText("That is not yours to do on this escalation.").first().waitFor();
      expect(await page.getByTestId("escalation-act-body").inputValue()).toBe("This belongs with the payment partner.");
    } finally {
      await close();
    }
  });
});
