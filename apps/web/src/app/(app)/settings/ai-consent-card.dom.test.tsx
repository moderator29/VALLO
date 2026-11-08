/**
 * STORE-07: the privacy screen states whether this person has agreed to the
 * AI disclosure and, when they have, offers to withdraw it (the confirm
 * sheet and the action are `AiConsentCard` and `lib/ai/consent-actions.ts`,
 * whose round trip is `consent-actions.test.ts`). Rendered for real and
 * checked by axe-core in Chromium.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { axe, closeAxe, hasBrowser } from "@/lib/a11y/axe";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("@/lib/ai/consent-actions", () => ({ withdrawAiConsent: async () => ({ ok: true, data: null }) }));

import { AiConsentCard } from "./AiConsentCard";

afterAll(closeAxe);

const t = getDictionary("en");
const copy = t.settings.aiConsent;
const page = (body: string) => `<h1>Privacy</h1>${body}`;

describe("AiConsentCard", () => {
  it("agreed: says so, and the row is a button that opens the withdraw step", () => {
    const html = renderToStaticMarkup(<AiConsentCard t={t} consented />);
    expect(html).toContain(copy.row);
    expect(html).toContain(copy.on);
    expect(html).toMatch(/<button[^>]*data-testid="settings-ai-consent-row"/);
    expect(html).not.toContain(copy.off);
  });

  it("not agreed: says so, and leads to the assistant, where agreeing happens", () => {
    const html = renderToStaticMarkup(<AiConsentCard t={t} consented={false} />);
    expect(html).toContain(copy.off);
    const row = html.match(/<a [^>]*data-testid="settings-ai-consent-row"[^>]*>/)?.[0] ?? "";
    expect(row).toContain('href="/assistant"');
    expect(html).not.toContain(`>${copy.on}<`);
  });

  it.each(["ha", "ig", "yo"] as const)("%s falls back to the English copy", (locale) => {
    expect(getDictionary(locale).settings.aiConsent.row).toBe(copy.row);
  });

  /* Privacy was split into inner pages (W6, aa9421e49); the agreement now
     has its own, under Privacy. */
  it("stands on its own privacy page", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/settings/privacy/ai/page.tsx"), "utf8");
    expect(source).toMatch(/<AiConsentCard t=\{forAiConsent\(t\)\} consented=\{consented\} \/>/);
    expect(source).toMatch(/aiConsentForViewer\(\)/);
  });

  describe.skipIf(!hasBrowser && !process.env.CI)("axe", () => {
    it.each([true, false])("consented=%s has no violations", async (consented) => {
      const html = renderToStaticMarkup(<AiConsentCard t={t} consented={consented} />);
      expect(await axe(page(html))).toEqual([]);
    });
  });
});
