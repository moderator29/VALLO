/**
 * PASTE, IN A REAL BROWSER (founder, 14 November 2026).
 *
 * The reading is unit tested in `lib/paste/paste.test.ts`. This is what only a
 * browser can say: that a real paste event into a real field is held as a
 * chip or handed to the photo door, that the chip opens to read and edit, that
 * no request leaves the page for a pasted address, that a code is filled from
 * the clipboard in one tap, and that a phone number, an email and an amount
 * are cleaned as they land.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

type Page = import("playwright-core").Page;

const CSS = productCss("components/app/messages/paste-tray.css", "components/ui/paste-code.css", "app/css/grade1.css");
const LISTING = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";

const COMPOSER = `
  import { useState } from "react";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { PasteTray } from "@/components/app/messages/PasteTray";
  import { usePaste } from "@/components/app/messages/use-paste";
  function Harness() {
    const [draft, setDraft] = useState("");
    const [photos, setPhotos] = useState([]);
    const paste = usePaste({
      limit: 2000,
      cards: true,
      imageRoom: 3 - photos.length,
      onImages: (files) => setPhotos((all) => [...all, ...files.map((file) => file.name)]),
    });
    const sent = paste.split(draft);
    window.__state = { photos, body: sent.body, cards: sent.cards, over: sent.over, chips: paste.chips.length };
    return (
      <main>
        <PasteTray paste={paste} over={sent.over} />
        <textarea data-testid="field" aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} onPaste={paste.onPaste} />
        <ToastHost />
      </main>
    );
  }
  mount(<Harness />);
`;

/** A real paste event on the field. Returns whether the component took it (prevented the browser's own paste). */
async function paste(page: Page, selector: string, what: { text?: string; files?: { name: string; type: string }[] }) {
  return page.evaluate(
    ([sel, text, files]) => {
      const data = new DataTransfer();
      if (text) data.setData("text/plain", text as string);
      for (const file of files as { name: string; type: string }[]) data.items.add(new File(["x"], file.name, { type: file.type }));
      const field = document.querySelector(sel as string) as HTMLElement;
      field.focus();
      const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
      return !field.dispatchEvent(event);
    },
    [selector, what.text ?? "", what.files ?? []] as const,
  );
}

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __state: { photos: string[]; body: string; cards: unknown[]; over: number; chips: number } }).__state);

describe.skipIf(!hasBrowser && !process.env.CI)("paste in a composer", () => {
  it("leaves a short paste to the field, as it always was", async () => {
    const { page, close } = await mountInBrowser({ entry: COMPOSER, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      expect(await paste(page, "[data-testid=field]", { text: "Is it still available?" })).toBe(false);
      expect(await page.locator("[data-testid=paste-tray]").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("holds a long paste as a chip that opens to read and edit, and sends it as the message's text", async () => {
    const { page, close } = await mountInBrowser({ entry: COMPOSER, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      const long = `Dear Nora,\nThe flat on Admiralty Way is still open.\n${"More about the flat. ".repeat(70)}`;
      expect(await paste(page, "[data-testid=field]", { text: long })).toBe(true);
      const chip = page.locator("[data-testid=paste-chip-text]");
      await chip.waitFor();
      const words = await chip.innerText();
      expect(words).toContain("TEXT");
      expect(words).toContain("Dear Nora,");
      expect(words).toContain("The flat on Admiralty Way is still open.");
      expect(words).toContain(`${long.length.toLocaleString("en-NG")} characters`);
      /* The field stays empty; the message's text is the paste. */
      expect(await page.locator("[data-testid=field]").inputValue()).toBe("");
      expect((await state(page)).body).toBe(long.trim());

      /* A 44 px way out, and a row that does not push the page sideways. */
      const close44 = await page.locator("[data-testid=paste-chip-remove]").boundingBox();
      expect(close44!.width).toBeGreaterThanOrEqual(44);
      expect(close44!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

      /* Open it, change it, keep it. */
      await chip.locator("button.nf-paste__body").click();
      const field = page.locator("[data-testid=paste-sheet-field]");
      await field.waitFor();
      expect(await field.inputValue()).toBe(long);
      await field.fill("Shorter now.");
      await page.getByRole("button", { name: "Done" }).click();
      await page.waitForFunction(() => (window as unknown as { __state: { body: string } }).__state.body === "Shorter now.");
      expect(await chip.innerText()).toContain("Shorter now.");

      await page.locator("[data-testid=paste-chip-remove]").click();
      await page.locator("[data-testid=paste-tray]").waitFor({ state: "detached" });
      expect((await state(page)).body).toBe("");
    } finally {
      await close();
    }
  });

  it("says by how much a held paste is over the message's limit", async () => {
    const { page, close } = await mountInBrowser({ entry: COMPOSER, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      await paste(page, "[data-testid=field]", { text: "a".repeat(2300) });
      const chip = page.locator("[data-testid=paste-chip-text]");
      await chip.waitFor();
      expect(await chip.getAttribute("data-over")).toBe("");
      expect(await chip.innerText()).toContain("300 over the limit");
      expect((await state(page)).over).toBe(300);
    } finally {
      await close();
    }
  });

  it("draws a pasted address as its host and path and fetches nothing", async () => {
    const { page, close } = await mountInBrowser({ entry: COMPOSER, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      const requests: string[] = [];
      page.on("request", (request) => requests.push(request.url()));
      expect(await paste(page, "[data-testid=field]", { text: "https://www.example.com/rooms/12?ref=abc" })).toBe(true);
      const chip = page.locator("[data-testid=paste-chip-link]");
      await chip.waitFor();
      const words = await chip.innerText();
      expect(words).toContain("LINK");
      expect(words).toContain("example.com");
      expect(words).toContain("/rooms/12?ref=abc");
      expect(await chip.locator("a, img, iframe").count()).toBe(0);
      await page.waitForTimeout(400);
      expect(requests.filter((url) => url.includes("example.com"))).toEqual([]);
      /* It is sent as the address itself, in the message's text. */
      expect((await state(page)).body).toBe("https://www.example.com/rooms/12?ref=abc");
    } finally {
      await close();
    }
  });

  it("knows a Vallo listing and sends it as its own card, apart from the words", async () => {
    const { page, close } = await mountInBrowser({ entry: COMPOSER, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      await page.locator("[data-testid=field]").fill("Have you seen this one?");
      await paste(page, "[data-testid=field]", { text: `https://www.vallospaces.com/listing/${LISTING}` });
      const chip = page.locator("[data-testid=paste-chip-link]");
      await chip.waitFor();
      expect(await chip.getAttribute("data-kind")).toBe("vallo");
      const words = await chip.innerText();
      expect(words).toContain("VALLO");
      expect(words).toContain("A listing on Vallo");
      expect(words).toContain("Sends as its card");
      const sent = await state(page);
      expect(sent.cards).toEqual([{ kind: "listing", id: LISTING }]);
      expect(sent.body).toBe("Have you seen this one?");
      /* A lookalike host is somebody else's site: an ordinary link, never a card. */
      await paste(page, "[data-testid=field]", { text: `https://vallospaces.com.evil.example/listing/${LISTING}` });
      await page.waitForFunction(() => (window as unknown as { __state: { chips: number } }).__state.chips === 2);
      expect((await state(page)).cards).toHaveLength(1);
      expect(await page.locator("[data-testid=paste-chip-link]").nth(1).getAttribute("data-kind")).toBe("link");
    } finally {
      await close();
    }
  });

  it("hands pasted photos to the composer's own photo door and refuses the rest in words", async () => {
    const { page, close } = await mountInBrowser({ entry: COMPOSER, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      const took = await paste(page, "[data-testid=field]", {
        files: [
          { name: "front.png", type: "image/png" },
          { name: "lease.pdf", type: "application/pdf" },
          { name: "kitchen.jpg", type: "image/jpeg" },
        ],
      });
      expect(took).toBe(true);
      await page.getByText("Only photos can be pasted here.").waitFor();
      expect((await state(page)).photos).toEqual(["front.png", "kitchen.jpg"]);
      /* Past the room the composer has, the rest are not taken, and it says so. */
      await page.evaluate(() => document.querySelector<HTMLButtonElement>(".nf-toast button")?.click());
      await paste(page, "[data-testid=field]", {
        files: [
          { name: "bath.png", type: "image/png" },
          { name: "gate.png", type: "image/png" },
        ],
      });
      await page.getByText("That is as many photos as one message holds.").waitFor();
      expect((await state(page)).photos).toEqual(["front.png", "kitchen.jpg", "bath.png"]);
      /* Nothing pasted was typed into the field, and nothing names a source. */
      expect(await page.locator("[data-testid=field]").inputValue()).toBe("");
      expect(await page.locator("body").innerText()).not.toMatch(/pasted from/i);
    } finally {
      await close();
    }
  });
});

const FIELDS = `
  import { useState } from "react";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { TextField } from "@/components/ui/Field";
  import { NairaField } from "@/components/ui/NairaField";
  import { CodeInput } from "@/components/auth/CodeInput";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { readText: async () => window.__clipboardText ?? "" },
  });
  function Harness() {
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [amount, setAmount] = useState("");
    const [code, setCode] = useState("");
    const [otp, setOtp] = useState("");
    window.__fields = { phone, email, amount, code, otp };
    return (
      <main>
        <TextField label="Phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="phone" />
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="email" />
        <NairaField label="Rent" value={amount} onValueChange={setAmount} data-testid="amount" />
        <CodeInput id="code" name="code" label="Code" length={6} value={code} onChange={setCode} wrongCount={0} placeholder="000000" cellsLabel="Six digit code" />
        <TextField label="Withdrawal code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\\D/g, ""))} data-testid="otp" />
        <ToastHost />
      </main>
    );
  }
  mount(<Harness />);
`;

const fields = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fields: Record<"phone" | "email" | "amount" | "code" | "otp", string> }).__fields);

describe.skipIf(!hasBrowser && !process.env.CI)("paste in a field", () => {
  it("cleans a pasted phone number, email and amount as they land", async () => {
    const { page, close } = await mountInBrowser({ entry: FIELDS, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      expect(await paste(page, "[data-testid=phone]", { text: "+234 (803) 123-4567" })).toBe(true);
      expect(await paste(page, "[data-testid=email]", { text: " Seyi <Seyi@Example.com> " })).toBe(true);
      expect(await paste(page, "[data-testid=amount]", { text: "₦1,250,000.00" })).toBe(true);
      await page.waitForFunction(() => (window as unknown as { __fields: { amount: string } }).__fields.amount === "1250000");
      expect(await fields(page)).toMatchObject({ phone: "+2348031234567", email: "seyi@example.com", amount: "1250000" });
      expect(await page.locator("[data-testid=phone]").inputValue()).toBe("+2348031234567");
      expect(await page.locator("[data-testid=amount]").inputValue()).toBe("1,250,000");
      /* Already clean: the browser's own paste is left alone. */
      expect(await paste(page, "[data-testid=email]", { text: "ada@example.com" })).toBe(false);
      expect(await paste(page, "[data-testid=amount]", { text: "450000" })).toBe(false);
    } finally {
      await close();
    }
  });

  it("fills a one-time code from the clipboard in one tap, out of the sentence it came in", async () => {
    const { page, close } = await mountInBrowser({ entry: FIELDS, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      await page.evaluate(() => {
        (window as unknown as { __clipboardText: string }).__clipboardText = "Your Vallo code is 482 913. It expires in 10 minutes.";
      });
      const buttons = page.locator("[data-testid=paste-code]");
      expect(await buttons.count()).toBe(2);
      for (const index of [0, 1]) {
        const box = await buttons.nth(index).boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await buttons.nth(0).click();
      await page.waitForFunction(() => (window as unknown as { __fields: { code: string } }).__fields.code === "482913");
      await buttons.nth(1).click();
      await page.waitForFunction(() => (window as unknown as { __fields: { otp: string } }).__fields.otp === "482913");
      expect(await page.locator("#code").getAttribute("autocomplete")).toBe("one-time-code");
      /* A paste into the cells themselves is read the same way. */
      await page.evaluate(() => (window as unknown as { __clipboardText: string }).__clipboardText = "");
      expect(await paste(page, "#code", { text: "Code: 771-204" })).toBe(true);
      await page.waitForFunction(() => (window as unknown as { __fields: { code: string } }).__fields.code === "771204");
      /* An empty clipboard is said, not silently ignored. */
      await buttons.nth(0).click();
      await page.getByText("There is no code on the clipboard to paste.").waitFor();
    } finally {
      await close();
    }
  });
});
