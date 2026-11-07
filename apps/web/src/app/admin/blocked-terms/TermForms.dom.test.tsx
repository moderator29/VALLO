/**
 * THE BLOCKED-TERMS FORMS, in a real Chromium: the add form shows the refusal
 * reason box only for a refuse, sends the database's arguments, and shows the
 * database's own sentence for a shape it refused; retiring needs a reason.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { TermForm, RetireTerm } from "@/app/admin/blocked-terms/TermForms";
  import { BLOCKED_TERM_ACTIONS, BLOCKED_TERM_CATEGORIES, BLOCKED_TERM_SEVERITIES } from "@/lib/admin/blocked-terms-rules";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  const c = getDictionary("en").adminCoverage.blockedTerms;
  const opt = (values, names) => values.map((value) => ({ value, label: names[value] ?? value }));
  mount(
    <div style={{ width: 360, padding: 16 }}>
      <ToastHost />
      <TermForm copy={c} categories={opt(BLOCKED_TERM_CATEGORIES, c.category)} actions={opt(BLOCKED_TERM_ACTIONS, c.action)} severities={opt(BLOCKED_TERM_SEVERITIES, c.severity)} />
      <ul className="nf-rows nf-group"><li className="nf-row flex-wrap"><span className="flex-1">send money first</span><RetireTerm term="send money first" copy={{ ...c, cancel: "Cancel" }} /></li></ul>
    </div>,
  );
`;

const OK = "async () => ({ ok: true, data: null })";
const REASON = "Classic advance-fee opener in rental scams.";

describe.skipIf(!hasBrowser && !process.env.CI)("the blocked-terms forms", () => {
  it("passes axe, and asks for a refusal sentence only when the action is refuse", async () => {
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { putBlockedTerm: OK, retireBlockedTerm: OK } });
    try {
      expect(await page.getByLabel("What the author reads when it is refused").count()).toBe(0);
      await page.getByLabel("What the scan does").selectOption("refuse");
      expect(await page.getByLabel("What the author reads when it is refused").count()).toBe(1);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps Save shut until there is a term and a real reason, then sends the arguments", async () => {
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { putBlockedTerm: OK, retireBlockedTerm: OK } });
    try {
      const save = page.getByRole("button", { name: "Save the term" });
      expect(await save.isDisabled()).toBe(true);
      await page.getByLabel("Term", { exact: true }).fill("Send  money first");
      await page.getByLabel("Why this term").fill("too short");
      expect(await save.isDisabled()).toBe(true);
      await page.getByLabel("Why this term").fill(REASON);
      await save.click();
      await page.getByRole("status").waitFor();
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.at(-1)).toEqual([
        "putBlockedTerm",
        { term: "Send  money first", category: "fraud.advance-fee", action: "hold", severity: "medium", reason: REASON },
      ]);
    } finally {
      await close();
    }
  });

  it("shows the database's sentence when it refuses a shape", async () => {
    const refused = 'async () => ({ ok: false, error: "Please check the highlighted fields and try again.", fieldErrors: { term: "Use letters and digits only, words separated by single spaces." } })';
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { putBlockedTerm: refused, retireBlockedTerm: OK } });
    try {
      await page.getByLabel("Term", { exact: true }).fill("bad term!");
      await page.getByLabel("Why this term").fill(REASON);
      await page.getByRole("button", { name: "Save the term" }).click();
      await page.getByRole("alert").waitFor();
      expect(await page.getByText("letters and digits only", { exact: false }).count()).toBeGreaterThan(0);
      expect(await page.getByRole("status").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("retires a term only with a reason, and says it stopped matching", async () => {
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { putBlockedTerm: OK, retireBlockedTerm: OK } });
    try {
      await page.getByRole("button", { name: "Retire", exact: true }).click();
      const confirm = page.getByRole("button", { name: "Retire the term" });
      expect(await confirm.isDisabled()).toBe(true);
      await page.getByLabel("Why retire it").fill("The founder struck it from the list.");
      await confirm.click();
      await page.getByText("Retired. It stops matching at once.").waitFor();
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.at(-1)).toEqual(["retireBlockedTerm", { term: "send money first", reason: "The founder struck it from the list." }]);
    } finally {
      await close();
    }
  });
});
