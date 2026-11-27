/**
 * THE AGENT APPLICATION'S DOCUMENTS STEP FITS A PHONE (23 November 2026).
 *
 * The same fault as Talk to a person: a document restored from a saved draft
 * is named in its slot on one truncated line ("Scan_National_Identity_Card_
 * ..._front.pdf"), and the grid of slots had the default auto column, which
 * is as wide as that line, so the slots and the whole step ran past the right
 * edge of a 390px phone. This mounts the real wizard in the app's own
 * stylesheet with a stored draft holding two PDFs, shows the documents step,
 * and checks nothing on it reaches past the step's 16px gutter.
 *
 * The step is shown by lifting `hidden` from its fieldset rather than by
 * filling in three steps of personal details first; the markup measured is
 * the wizard's own.
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

const DRAFT = JSON.stringify({
  values: {},
  agentType: "business",
  batchId: "batch-1",
  documents: [
    { kind: "idFront", path: "user-1/batch-1/id-front.pdf", fileName: "Scan_National_Identity_Card_Adaeze_Okonkwo_2026-11-20_front.pdf", isPdf: true },
    { kind: "idBack", path: "user-1/batch-1/id-back.pdf", fileName: "Scan_National_Identity_Card_Adaeze_Okonkwo_2026-11-20_back.pdf", isPdf: true },
  ],
});

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ApplyWizard } from "@/components/agent/ApplyWizard";
  import { forApply } from "@/components/agent/agent-copy";
  mount(
    <div className="mx-auto max-w-3xl">
      <ApplyWizard t={forApply(getDictionary("en"))} role="professional" intro="What it involves" closeHref="/profile/setup" />
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the agent application on a phone", () => {
  it("keeps the documents step inside its gutter when a slot names a long file", async () => {
    const css = await layoutCss("app/(app)/layout.tsx");
    const { page, close } = await mountInBrowser({
      entry,
      css,
      init: `localStorage.setItem("nf_agent_application_draft", ${JSON.stringify(DRAFT)});`,
      viewport: { width: 390, height: 844 },
    });
    try {
      await page.locator("label[for=idFront]").waitFor({ state: "attached" });
      await expect.poll(() => page.locator("label[for=idFront]").textContent()).toContain("Scan_National");
      const fit = await page.evaluate(() => {
        const step = document.querySelector<HTMLElement>("label[for=idFront]")!.closest("fieldset")!;
        document.querySelectorAll("fieldset").forEach((set) => {
          set.hidden = set !== step;
        });
        const limit = window.innerWidth - 16 + 0.5;
        const over = [step, ...step.querySelectorAll<HTMLElement>("*")]
          .filter((el) => !el.closest("svg"))
          .map((el) => ({ el, right: el.getBoundingClientRect().right }))
          .filter(({ right }) => right > limit)
          .map(({ el, right }) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} ${Math.round(right)}`);
        return { over, step: Math.round(step.getBoundingClientRect().width) };
      });
      expect(fit.step).toBeGreaterThan(200);
      expect(fit.over).toEqual([]);
    } finally {
      await close();
    }
  });
});
