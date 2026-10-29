/**
 * SMALL TEXT ON A COLOURED OR TINTED GROUND, MEASURED ON THE PAINT (W12).
 *
 * The method is `control-contrast.dom.test.tsx`'s, for words rather than
 * buttons: hide the words (`-webkit-text-fill-color: transparent`), screenshot
 * the element's box so what is left is the painted ground behind it, then hold
 * the word's ink, composited at every opacity between it and the ground, to the
 * WORST pixel of that ground. 4.5:1 for all of these: none is large text.
 *
 * The cases are the ones a computed colour cannot judge, because the ground is
 * a gradient, a wash over the page, or the brand blue the word sits on:
 *
 *   the sent bubble's time, in the chat thread and in the assistant
 *   the chosen row of the assistant's history, its title and its time
 *   the unread time on an inbox row
 *   muted words on the warm and info tints (decision card, agreement diff, scam shield)
 *   the initial in a brand avatar
 *
 * A GRAPHIC (a glyph that carries meaning, such as the "answered" tick) is held to
 * 3:1 instead, WCAG 1.4.11, and is hidden with `visibility` since it is not text.
 *
 * The real compiled cascade (Tailwind included), both themes, 390px.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { appCss, fitMount } from "@/lib/testing/locale-fit";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT * 3 });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/** A word to measure: the element's selector within the stage, and whether its ground is a disc. */
type Probe = { name: string; selector: string; disc?: boolean; graphic?: boolean };

const IMPORTS = `
  import { AssistantSidebar } from "@/components/app/assistant/AssistantSidebar";
  import { DecisionCard } from "@/components/app/confirm/DecisionCard";
  import { AgreementChanges } from "@/components/app/agreements/AgreementChanges";
  import { ScamShield } from "@/components/app/messages/ScamShield";
  import { UiIcon } from "@/design-system/icons/UiIcon";
`;

const BODY = `
  <div style={{ display: "grid", gap: 16, background: "var(--nf-surface-canvas)", padding: 16 }}>
    <div data-probe="chat-time">
      <div className="nf-bubble nf-bubble--mine" style={{ maxWidth: 260 }}>
        <p className="nf-bubble__body">Is Saturday by 2pm okay?</p>
      </div>
      <p className="nf-msg__status"><span className="nf-numeric">09:31</span></p>
    </div>
    <div data-probe="assistant-time" className="nf-ai__turn nf-ai__turn--mine">
      <div className="nf-ai__bubble nf-ai__bubble--mine">
        Show me 2-bed in Lekki under 2m
        <span className="nf-ai__stamp nf-numeric">
          07:22
          <span className="nf-ai__ticks" role="img" aria-label="Answered"><UiIcon name="verified" size={12} /></span>
        </span>
      </div>
    </div>
    <div data-probe="assistant-row" style={{ width: 280 }}>
      <AssistantSidebar
        threads={[{ id: "a", title: "Show me 2-bed in Lekki under 2m", createdAt: 1, updatedAt: Date.now(), messages: [] }]}
        activeId="a" tone="Concise" language="English"
        onSelect={() => {}} onNew={() => {}} onDelete={() => {}} onClearAll={() => {}} onToneChange={() => {}} onLanguageChange={() => {}}
      />
    </div>
    <a data-probe="inbox-time" className="nf-inbox-row" data-unread="true" href="#">
      <span className="nf-inbox-row__when nf-numeric">09:21</span>
    </a>
    <div data-probe="decision">
      <DecisionCard label="Awaiting you" when="Since 30 Sept" title="Confirm these terms" primary={<span>Go</span>} />
    </div>
    <div data-probe="diff">
      <AgreementChanges
        byLine="By the host." versionsLine="Version 2."
        changes={[{ key: "rent", label: "Rent", before: "₦3,000,000", after: "₦3,200,000" }, { key: "caution", label: "Caution", before: t.memberKit.agreementDiff.notStated, after: "₦250,000" }]}
        copy={t.memberKit.agreementDiff}
      />
    </div>
    <div data-probe="scam">
      <ScamShield ask={{ reason: "fee", reasons: ["fee"] }} messageId="m1" canReport={false} copy={t.memberKit.scam} />
    </div>
    <span data-probe="avatar" className="nf-nav__avatar" aria-hidden="true">S</span>
  </div>
`;

const PROBES: Probe[] = [
  { name: "the time under a bubble (chat)", selector: '[data-probe="chat-time"] .nf-msg__status .nf-numeric' },
  { name: "the sent bubble's time (assistant)", selector: '[data-probe="assistant-time"] .nf-ai__stamp' },
  { name: "the assistant's 'answered' tick (graphic, 3:1)", selector: '[data-probe="assistant-time"] .nf-ai__ticks', graphic: true },
  { name: "the chosen history row's title", selector: '[data-probe="assistant-row"] .nf-ai__row--on > span:first-child' },
  { name: "the chosen history row's time", selector: '[data-probe="assistant-row"] .nf-ai__row--on > span:nth-child(2)' },
  { name: "the unread time on an inbox row", selector: '[data-probe="inbox-time"] .nf-inbox-row__when' },
  { name: "the decision card's label", selector: '[data-probe="decision"] .nf-decision__label' },
  { name: "the decision card's wait", selector: '[data-probe="decision"] .nf-decision__when' },
  { name: "the agreement diff's old value", selector: '[data-probe="diff"] s.nf-terms-diff__old' },
  { name: "the agreement diff's 'not stated'", selector: '[data-probe="diff"] span.nf-terms-diff__old' },
  { name: "the scam shield's private line", selector: '[data-probe="scam"] .nf-scam-shield__private' },
  { name: "the brand avatar's initial", selector: '[data-probe="avatar"]', disc: true },
];

/** The word's ink, composited over its ground pixel by pixel, against the worst of them. */
async function worstRatio(page: Page, probe: Probe): Promise<number> {
  const target = page.locator(probe.selector).first();
  await target.scrollIntoViewIfNeeded();
  const info = await target.evaluate((el) => {
    /* Every opacity from the word up to the stage composites the ink toward the ground. */
    let opacity = 1;
    for (let node: Element | null = el; node && node.id !== "stage"; node = node.parentElement) {
      opacity *= Number.parseFloat(getComputedStyle(node).opacity);
    }
    (el as HTMLElement).style.setProperty("-webkit-text-fill-color", "transparent");
    /* A glyph beside the words (the tick in the stamp) is a child: hidden, it cannot colour the ground, and
       the box (and the screenshot) stay in place. */
    for (const child of Array.from(el.children)) (child as HTMLElement | SVGElement).style.visibility = "hidden";
    return { ink: getComputedStyle(el).color, opacity };
  });
  const png = (await target.screenshot()).toString("base64");
  await target.evaluate((el) => {
    (el as HTMLElement).style.removeProperty("-webkit-text-fill-color");
    for (const child of Array.from(el.children)) (child as HTMLElement | SVGElement).style.visibility = "";
  });
  return page.evaluate(
    async ({ png, info, disc }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const c = canvas.getContext("2d", { willReadFrequently: true })!;
      c.drawImage(img, 0, 0);
      const parse = (value: string) => {
        const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        probe.fillStyle = "black";
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const d = probe.getImageData(0, 0, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
      };
      const lum = (r: number, g: number, b: number) => {
        const f = (v: number) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ink = parse(info.ink);
      const a = ink[3]! * info.opacity;
      const cx = img.width / 2;
      const cy = img.height / 2;
      const inset = disc ? 3 : 0;
      let worst = Infinity;
      for (let x = inset; x < img.width - inset; x += 1) {
        for (let y = inset; y < img.height - inset; y += 1) {
          if (disc && ((x - cx) / (cx - inset)) ** 2 + ((y - cy) / (cy - inset)) ** 2 > 1) continue;
          const p = c.getImageData(x, y, 1, 1).data;
          const over = [0, 1, 2].map((i) => ink[i]! * a + p[i]! * (1 - a));
          const l1 = lum(over[0]!, over[1]!, over[2]!);
          const l2 = lum(p[0]!, p[1]!, p[2]!);
          worst = Math.min(worst, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
        }
      }
      return worst;
    },
    { png, info, disc: Boolean(probe.disc) },
  );
}

describe.skipIf(!hasBrowser && !process.env.CI)("small text on a coloured ground, measured on the paint", () => {
  it("every word clears 4.5:1 against its painted ground, in both themes", async () => {
    const { page, close } = await fitMount({ locale: "en", imports: IMPORTS, body: BODY, css: await appCss(), bleed: true });
    const rows: string[] = [];
    try {
      for (const theme of ["dark", "light"]) {
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        /* Transitions on colour would be photographed mid-fade. */
        await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
        for (const probe of PROBES) {
          if ((await page.locator(probe.selector).count()) === 0) {
            rows.push(`${theme} | ${probe.name} | not found`);
            continue;
          }
          const ratio = await worstRatio(page, probe);
          const need = probe.graphic ? 3 : 4.5;
          if (ratio < need) rows.push(`${theme} | ${probe.name} | ${ratio.toFixed(2)}:1 < ${need}`);
        }
      }
    } finally {
      await close();
    }
    expect(rows).toEqual([]);
  });
});
