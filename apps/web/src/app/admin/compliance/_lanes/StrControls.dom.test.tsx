/**
 * The suspicious-transaction lane's second-person approval, mounted for real in
 * Chromium on the product's own stylesheets. A second person's approval is
 * recorded once and never revised, so it is a slide; but it MOVES NO MONEY (a
 * hold only stops a payout account being added or changed), so it is the plain
 * `DragToConfirm`, not the money one. What that means, and what this holds it to:
 *
 *   - it says "confirming" until the server answers and "confirmed" only after
 *     the action resolved true, printing the server's own sentence;
 *   - a REFUSAL resolves false: the track springs back to rest, says the lane's
 *     refusal words on it and says the refusal's own sentence in the banner, as
 *     an alert, and nothing is claimed as done;
 *   - it is not marked `money` (and so it is the kind that may reset itself, but
 *     this one is given no delay, so a confirmed approval stays confirmed);
 *   - the keyboard path is the handle; Reject stays a button (sending a decision
 *     back reopens the case); and no other state of the lane draws a slide.
 *
 * The server actions are staged by the test. Fixtures are slots: no case, person
 * or reference is invented.
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
import { axeViolations } from "@/components/ui/ported-test-css";
import { GLASS_CSS, productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss(
  GLASS_CSS,
  "app/css/base.css",
  "app/css/typography.css",
  "app/css/controls.css",
  "app/admin/_components/admin-material.css",
);

function entry(state: "open" | "awaiting_approval" | "to_file" | "not_filed" | "filed"): string {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { StrCaseControls } from "@/app/admin/compliance/_lanes/StrControls";
    import { mount } from "@/lib/testing/browser-root";
    import { ToastHost } from "@/components/ui/ToastHost";
    const t = getDictionary("en");
    const words = {
      slideApprove: t.experienceAdmin.compliance.slideApprove,
      confirming: t.experienceUi.confirming,
      confirmed: t.experienceUi.confirmed,
      error: t.experienceAdmin.compliance.refused,
      decisionBar: t.experienceAdmin.compliance.decisionBar,
      slideApproveRelease: t.experienceAdmin.compliance.slideApproveRelease,
    };
    window.__facts = { words, copy: t.complianceStr };
    window.__answer = null;
    window.__release = (value) => window.__answer(value);
    mount(
      <div style={{ width: 380, padding: 16 }}>
        <ToastHost />
        <StrCaseControls
          copy={t.complianceStr}
          words={words}
          c={{ id: "case-slot", state: ${JSON.stringify(state)}, subjectId: null, decision: { id: "decision-slot" } }}
        />
      </div>,
    );
  `;
}

/* A held server action: answers when the test releases it. */
const HELD = {
  approveStr: `(input) => new Promise((resolve) => { window.__answer = resolve; })`,
  decideStr: `async () => ({ ok: true, data: { text: "Decided, slot." } })`,
};

type Facts = { words: Record<string, string>; copy: Record<string, string> };
const facts = (page: Page) => page.evaluate(() => (window as unknown as { __facts: Facts }).__facts);
const release = (page: Page, value: unknown) =>
  page.evaluate((v) => (window as unknown as { __release: (x: unknown) => void }).__release(v), value);
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);
const slide = (page: Page) => page.getByTestId("str-approve-slide");
const view = (page: Page) => slide(page).getAttribute("data-state");
const inState = (page: Page, want: string) =>
  page.waitForFunction((s) => document.querySelector("[data-testid=str-approve-slide]")?.getAttribute("data-state") === s, want);

async function confirmByKeyboard(page: Page) {
  const f = await facts(page);
  await slide(page).getByRole("button", { name: f.copy.approve! }).focus();
  await page.keyboard.press("Enter");
}

describe.skipIf(!hasBrowser && !process.env.CI)("the STR lane's second-person approval", () => {
  it("is a plain slide, not a money one, in a named decision bar beside a Reject button", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("awaiting_approval"), css: CSS, actions: HELD });
    try {
      const f = await facts(page);
      expect(await slide(page).count()).toBe(1);
      /* No money on this lane's approval: the control is not the money kind. */
      expect(await slide(page).getAttribute("data-money")).toBeNull();
      expect(await view(page)).toBe("idle");
      expect(await page.getByRole("group", { name: f.words.decisionBar! }).count()).toBe(1);
      expect(await page.getByTestId("str-approve").locator("p.nf-caption").first().textContent()).toBe(f.copy.secondPerson);
      expect(await slide(page).textContent()).toContain(f.words.slideApprove!);
      expect(await slide(page).getByRole("button", { name: f.copy.approve! }).count()).toBe(1);
      const reject = page.getByRole("button", { name: f.copy.reject!, exact: true });
      expect(await reject.count()).toBe(1);
      expect((await reject.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.waitForTimeout(300);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("says Confirming until the server answers, then Confirmed with the server's sentence, and stays confirmed", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("awaiting_approval"), css: CSS, actions: HELD });
    try {
      const f = await facts(page);
      await page.getByLabel(f.copy.approveNote!, { exact: true }).fill("A note, slot.");
      await confirmByKeyboard(page);
      await inState(page, "confirming");
      expect(await slide(page).getAttribute("aria-busy")).toBe("true");
      expect(await slide(page).textContent()).toContain(f.words.confirming!);
      expect(await slide(page).textContent()).not.toContain(f.words.confirmed!);
      /* The other way out of the same decision is shut while this one is in flight. */
      expect(await page.getByRole("button", { name: f.copy.reject!, exact: true }).isDisabled()).toBe(true);
      /* The approval, with the note that was typed, and nothing before it was asked for. */
      expect(await calls(page)).toEqual([["approveStr", { decisionId: "decision-slot", approve: true, note: "A note, slot." }]]);
      await page.waitForTimeout(700);
      expect(await view(page)).toBe("confirming");

      await release(page, { ok: true, data: { text: "Approved, slot." } });
      await inState(page, "confirmed");
      expect(await slide(page).textContent()).toContain(f.words.confirmed!);
      expect(await page.getByRole("status").filter({ hasText: "Approved, slot." }).count()).toBe(1);
      /* An approval is recorded once: it stays confirmed. */
      await page.waitForTimeout(1500);
      expect(await view(page)).toBe("confirmed");
      expect(await slide(page).getAttribute("data-failed")).toBeNull();
    } finally {
      await close();
    }
  });

  it("on a refusal resolves false: springs back, says the lane's refusal on the track, and prints the sentence as an alert", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("awaiting_approval"), css: CSS, actions: HELD });
    try {
      const f = await facts(page);
      await confirmByKeyboard(page);
      await inState(page, "confirming");
      await release(page, { ok: false, error: "The refusal's own sentence, slot." });
      await inState(page, "idle");
      expect(await slide(page).getAttribute("data-failed")).toBe("declined");
      /* The track says it did not happen; it never claimed it did. */
      expect(await slide(page).textContent()).toContain(f.words.error!);
      expect(await slide(page).textContent()).not.toContain(f.words.confirmed!);
      /* And the refusal's own sentence is printed under it, as an alert. */
      const alert = page.getByRole("alert");
      expect(await alert.count()).toBe(1);
      expect(await alert.textContent()).toBe("The refusal's own sentence, slot.");
      /* It can be tried again: the handle is live. */
      expect(await slide(page).getByRole("button").getAttribute("aria-disabled")).toBeNull();
      await page.waitForTimeout(400);
      /* The refusal words on the track clear contrast: they take the primary ink and the
         track's edge carries the failure (ported.css, `.nf-dtc[data-failed]`). */
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("can be tried again after a refusal and confirms the second time", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("awaiting_approval"), css: CSS, actions: HELD });
    try {
      await confirmByKeyboard(page);
      await inState(page, "confirming");
      await release(page, { ok: false, error: "Refused, slot." });
      await inState(page, "idle");
      await confirmByKeyboard(page);
      await inState(page, "confirming");
      await release(page, { ok: true, data: { text: "Approved, slot." } });
      await inState(page, "confirmed");
      /* The refusal from the first try gives way to the approval once the
         second is accepted (the banner holds an error for its short minimum
         before a calmer message replaces it). */
      await page.getByRole("status").filter({ hasText: "Approved, slot." }).waitFor();
      expect(await page.getByRole("alert").count()).toBe(0);
      expect((await calls(page)).length).toBe(2);
    } finally {
      await close();
    }
  });

  it("confirms from a full pointer slide, and holds a short one back without asking the server", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("awaiting_approval"), css: CSS, actions: HELD });
    try {
      const handle = slide(page).getByRole("button");
      const box = (await handle.boundingBox())!;
      const track = (await slide(page).boundingBox())!;
      const travel = track.width - 2 * 4 - 2 - 48;
      const y = box.y + box.height / 2;
      const x = box.x + box.width / 2;
      /* Short of the end: nothing is asked. */
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + travel * 0.5, y, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      expect(await view(page)).toBe("idle");
      expect(await calls(page)).toEqual([]);
      /* All the way. */
      const again = (await handle.boundingBox())!;
      await page.mouse.move(again.x + 24, y);
      await page.mouse.down();
      await page.mouse.move(again.x + 24 + travel / 2, y, { steps: 4 });
      await page.mouse.move(again.x + 24 + travel, y, { steps: 4 });
      await page.mouse.up();
      await inState(page, "confirming");
      expect((await calls(page)).length).toBe(1);
      await release(page, { ok: true, data: { text: "Approved, slot." } });
      await inState(page, "confirmed");
    } finally {
      await close();
    }
  });

  it("keeps Reject a button that sends the decision back, with no slide in the way", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("awaiting_approval"), css: CSS, actions: { ...HELD, approveStr: `async () => ({ ok: true, data: { text: "Sent back, slot." } })` } });
    try {
      const f = await facts(page);
      await page.getByRole("button", { name: f.copy.reject!, exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Sent back, slot." }).waitFor();
      expect(await calls(page)).toEqual([["approveStr", { decisionId: "decision-slot", approve: false, note: "" }]]);
      /* The slide is untouched by a rejection. */
      expect(await view(page)).toBe("idle");
    } finally {
      await close();
    }
  });

  it("draws no slide in any other state of the lane: a decision, a filing and a closed case are buttons and forms", async () => {
    for (const state of ["open", "to_file", "not_filed", "filed"] as const) {
      const { page, close } = await mountInBrowser({ entry: entry(state), css: CSS, actions: HELD });
      try {
        expect(await page.locator(".nf-dtc").count(), state).toBe(0);
        expect(await page.getByTestId("str-approve").count(), state).toBe(0);
      } finally {
        await close();
      }
    }
    const open = await mountInBrowser({ entry: entry("open"), css: CSS, actions: HELD });
    try {
      /* Proposing a decision is a button: a second person must approve it. */
      expect(await open.page.getByTestId("str-decide").getByRole("button").count()).toBe(2);
    } finally {
      await open.close();
    }
  });

  it("works under reduced motion: the slide is operable and still says what happened", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("awaiting_approval"), css: CSS, actions: HELD, reducedMotion: true });
    try {
      const f = await facts(page);
      await confirmByKeyboard(page);
      await inState(page, "confirming");
      await release(page, { ok: false, error: "Refused, slot." });
      await inState(page, "idle");
      expect(await slide(page).textContent()).toContain(f.words.error!);
      expect(await page.getByRole("alert").textContent()).toBe("Refused, slot.");
    } finally {
      await close();
    }
  });
});
