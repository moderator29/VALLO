/**
 * THE ASSISTANT'S INTERACTIVE BLOCKS, MOUNTED FOR REAL IN CHROMIUM (action
 * calls recorded on `window.__calls`, answers staged by the test).
 *
 * What is held: a card's buttons call the server action that was named; a tapped
 * viewing time is re-checked by the server and only then offers Confirm; Confirm
 * calls the decide action with the proposal id and hash it was given; a payment
 * shows the amount and lines it was handed, charges nothing on its own, and
 * opens the payment page only after the server says so; a failure says why and
 * offers a retry; Cancel says nothing was charged.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const HASH = "a".repeat(64);
const calls = async (page: import("playwright-core").Page) => {
  const raw = await page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);
  return raw.map(([name, input]) => ({ name: name as string, input }));
};

const CARD = `{ id: "l1", title: "Two bed in Lekki", city: "Lagos", kind: "apartment", price: "N5,000,000 per year", rating: 4.5, verified: true, bedrooms: 2, href: "/listing/l1", reason: "You keep looking in Lagos.", actions: [
  { id: "v", label: "View listing", kind: "link", href: "/listing/l1" },
  { id: "p", label: "More pictures", kind: "photos", listingId: "l1" },
  { id: "s", label: "Request viewing", kind: "slots", listingId: "l1" },
  { id: "sv", label: "Save", kind: "save", listingId: "l1" },
  { id: "c", label: "Compare", kind: "ask", prompt: "Compare this place" } ] }`;

describe.skipIf(!hasBrowser && !process.env.CI)("assistant blocks", () => {
  it("draws a card with its reason behind Why this, and its buttons call the actions they name", async () => {
    const { page, close } = await mountInBrowser({
      actions: {
        assistantSave: "async () => ({ ok: true, data: { saved: true } })",
        assistantListingPhotos: "async () => ({ ok: true, data: { title: 'Two bed in Lekki', urls: ['https://x.test/1.jpg'] } })",
      },
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { AssistantBlocks } from "@/components/app/assistant/AssistantBlocks";
        window.__asked = [];
        mount(<AssistantBlocks onAsk={(p) => window.__asked.push(p)} blocks={[{ type: "cards", title: "Picked for you by VALLO AI", items: [${CARD}] }]} />);
      `,
    });
    try {
      expect(await page.getByText("Two bed in Lekki").first().isVisible()).toBe(true);
      expect(await page.getByText("You keep looking in Lagos.").count()).toBe(0);
      await page.getByRole("button", { name: "Why this?" }).click();
      expect(await page.getByText("You keep looking in Lagos.").isVisible()).toBe(true);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Saved", exact: true }).waitFor();
      expect((await calls(page)).find((c) => c.name === "assistantSave")?.input).toEqual({ listingId: "l1", want: true });
      await page.getByRole("button", { name: "More pictures" }).click();
      await page.getByRole("img", { name: /picture 1 of 1/ }).waitFor();
      await page.getByRole("button", { name: "Compare" }).click();
      expect(await page.evaluate(() => (window as unknown as { __asked: string[] }).__asked)).toEqual(["Compare this place"]);
    } finally {
      await close();
    }
  });

  it("walks time, then Confirm, and calls decide with the proposal it was handed", async () => {
    const { page, close } = await mountInBrowser({
      actions: {
        assistantViewingSlots: "async () => ({ ok: true, data: { listingId: 'l1', title: 'Two bed in Lekki', slots: [{ slotAt: '2026-11-10T09:00:00Z', label: 'Tue 10 Nov, 10:00' }] } })",
        assistantProposeViewing: `async () => ({ ok: true, data: { proposalId: "p1", payloadHash: "${HASH}", title: "Two bed in Lekki", whenLabel: "Tue 10 Nov, 10:00" } })`,
        assistantDecide: "async () => ({ ok: true, data: { kind: 'viewing_booked', message: 'Booked and confirmed: Two bed in Lekki, Tue 10 Nov, 10:00. It is on your Plans.' } })",
      },
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { AssistantBlocks } from "@/components/app/assistant/AssistantBlocks";
        mount(<AssistantBlocks onAsk={() => {}} blocks={[{ type: "cards", items: [${CARD}] }]} />);
      `,
    });
    try {
      await page.getByRole("button", { name: "Request viewing" }).click();
      await page.getByRole("button", { name: "Tue 10 Nov, 10:00" }).click();
      expect(await page.getByText("Nothing is booked until you confirm.").isVisible()).toBe(true);
      expect(await page.getByText("Booked and confirmed").count()).toBe(0);
      await page.getByRole("button", { name: "Confirm viewing" }).click();
      await page.getByText(/Booked and confirmed/).waitFor();
      const decide = (await calls(page)).find((c) => c.name === "assistantDecide");
      expect(decide?.input).toEqual({ proposalId: "p1", payloadHash: HASH, decision: "confirm" });
    } finally {
      await close();
    }
  });

  it("shows the real amount and lines, charges nothing by itself, and opens the payment page only after the server says so", async () => {
    const { page, close } = await mountInBrowser({
      actions: {
        assistantDecide: "async () => ({ ok: true, data: { kind: 'open_checkout', url: 'https://pay.example/x', message: 'The secure payment page for N5,000,000 is ready.' } })",
        assistantPaymentStatus: "async () => ({ ok: true, data: { paid: false, message: 'Not paid yet. If you have just paid, give it a minute and check again.' } })",
      },
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { AssistantBlocks } from "@/components/app/assistant/AssistantBlocks";
        mount(<AssistantBlocks onAsk={() => {}} blocks={[{ type: "payment_review", proposalId: "p9", payloadHash: "${HASH}", service: "Stay booking: Two bed", recipient: "The lister, paid through our licensed provider.", amount: "N5,000,000", fees: [{ label: "Stay", value: "N4,800,000" }, { label: "Service fee", value: "N200,000" }], total: "N5,000,000", expiresAt: "2026-11-01T11:00:00Z" }]} />);
      `,
    });
    try {
      expect(await page.getByText("N4,800,000").isVisible()).toBe(true);
      expect(await page.getByText("Total to pay").isVisible()).toBe(true);
      expect(await page.getByText(/Nothing is charged until you confirm/).isVisible()).toBe(true);
      expect((await calls(page)).length).toBe(0);
      expect(await page.getByRole("link", { name: "Open payment page" }).count()).toBe(0);
      await page.getByRole("button", { name: "Confirm and pay" }).click();
      const link = page.getByRole("link", { name: "Open payment page" });
      await link.waitFor();
      expect(await link.getAttribute("href")).toBe("https://pay.example/x");
      await page.getByRole("button", { name: /check status/ }).click();
      await page.getByText(/Not paid yet/).waitFor();
      expect((await calls(page)).filter((c) => c.name === "assistantDecide")).toHaveLength(1);
    } finally {
      await close();
    }
  });

  it("says why a payment failed and offers a safe retry, and Cancel says nothing was charged", async () => {
    const { page, close } = await mountInBrowser({
      actions: {
        assistantDecide: "async (input) => input.decision === 'cancel' ? ({ ok: true, data: { kind: 'cancelled' } }) : ({ ok: false, error: 'Unlock Vallo with your passcode first.' })",
        assistantRetry: `async () => ({ ok: true, data: { proposalId: "p10", payloadHash: "${HASH}" } })`,
      },
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { AssistantBlocks } from "@/components/app/assistant/AssistantBlocks";
        mount(<AssistantBlocks onAsk={() => {}} blocks={[{ type: "payment_review", proposalId: "p9", payloadHash: "${HASH}", service: "Stay booking: Two bed", recipient: "r", amount: "N1", fees: [], total: "N1", expiresAt: "" }]} />);
      `,
    });
    try {
      await page.getByRole("button", { name: "Confirm and pay" }).click();
      await page.getByText("Unlock Vallo with your passcode first.").waitFor();
      await page.getByRole("button", { name: "Try again" }).click();
      await page.getByRole("button", { name: "Confirm and pay" }).waitFor();
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByText("Cancelled. Nothing was charged.").waitFor();
    } finally {
      await close();
    }
  });

  it("draws summary rows exactly as handed", async () => {
    const { page, close } = await mountInBrowser({
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { AssistantBlocks } from "@/components/app/assistant/AssistantBlocks";
        mount(<AssistantBlocks onAsk={() => {}} blocks={[{ type: "summary", title: "Your payments, this month", rows: [{ label: "Stay in Ikoyi", value: "-N100,000", date: "Mon 2 Nov, 10:00", status: "successful" }], note: "As recorded." }]} />);
      `,
    });
    try {
      expect(await page.getByText("-N100,000").isVisible()).toBe(true);
      expect(await page.getByText("successful").isVisible()).toBe(true);
      expect(await page.getByText("As recorded.").isVisible()).toBe(true);
    } finally {
      await close();
    }
  });
});
