/**
 * THE W12 TOUCH TARGETS, EACH AT 44PX (Chromium, the product's real compiled
 * cascade, `fitMount` from the locale-fit helper).
 *
 * The production sweep measured these controls under 44px. Each fix grows the
 * TARGET and not the drawing (D28): a transparent, centred `::before` or
 * `::after` (`nf-tap` in base.css, or the component's own), so what this
 * measures is what `auditFit` counts as reach: the larger of the element's box
 * and the box of an absolutely positioned pseudo-element with content. It then
 * asks the page itself, with `elementFromPoint` 20px above and below the
 * centre, whether that point is still the control's (or a neighbour's, where
 * two targets sit closer than 44px), rather than an ancestor whose overflow
 * cut the hit area off.
 *
 * Data is the preview harness's own: the async preview pages are rendered to
 * markup in English, as `locale-fit/workspaces.dom.test.tsx` renders the agent
 * dashboard, and the client previews are mounted whole. Nothing is invented.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { Page } from "playwright-core";
import { prerender } from "react-dom/static";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss, fitMount } from "@/lib/testing/locale-fit";

vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: () => {
    throw new Error("redirect");
  },
}));

import { getDictionary } from "@vallo/i18n";
import { ClientCopyProvider } from "@/lib/i18n/client-copy";
import { clientCopyOf } from "@/lib/i18n/client-copy-of";
import AgentListPreview from "@/app/(dev)/preview/f5/agent-list/page";
import InspectionPreview from "@/app/(dev)/preview/f5/inspection/page";
import AgentInspectionsPreview from "@/app/(dev)/preview/f5/agent-inspections/page";
import AgentReviewsPreview from "@/app/(dev)/preview/f5/agent-reviews/page";
import AgentDashboardPreview from "@/app/(dev)/preview/f5/agent-dashboard/page";
import HostLandingPreview from "@/app/(dev)/preview/f5/host-landing/page";
import Db2Preview from "@/app/(dev)/preview/db2/page";
import RefundsPreview from "@/app/(dev)/preview/bd/refunds/page";
import AssistantPreview from "@/app/(dev)/preview/f1/assistant/page";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const t = getDictionary("en");
const PHONE = { width: 390, height: 844 };

type Reach = { who: string; box: string; w: number; h: number; above: true | string; below: true | string };

/** Every element matching `selector` (and, if given, whose words are `text`), with its reach. */
async function reach(page: Page, selector: string, text?: string): Promise<Reach[]> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  /* Let any entrance settle; a rise in flight shifts every box by a few pixels. */
  await page.waitForTimeout(900);
  return page.evaluate(
    ({ selector, text }) => {
      const squash = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
      const found = [...document.querySelectorAll(selector)].filter((el) => {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") return false;
        return text === undefined || squash(el.textContent) === text;
      });
      return found.map((el) => {
        /* `instant`: the product scrolls smoothly, and a box read mid-scroll is not where a thumb lands. */
        el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        const r = el.getBoundingClientRect();
        let w = r.width;
        let h = r.height;
        for (const which of ["::before", "::after"]) {
          const p = getComputedStyle(el, which);
          if (p.position === "absolute" && p.content !== "none") {
            w = Math.max(w, parseFloat(p.width) || 0);
            h = Math.max(h, parseFloat(p.height) || 0);
          }
        }
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        /* A CLIPPED reach lands on an ancestor (its overflow cut the hit area off) or on nothing. Landing
           on a neighbour is the overlap two adjacent targets closer than 44px apart have to share, and the
           later one in paint order keeps it; that is a layout fact, not a defect, so it passes. */
        const hits = (y: number): true | string => {
          const at = document.elementFromPoint(cx, y);
          if (at && (el.contains(at) || !at.contains(el))) return true;
          return at ? `${at.tagName.toLowerCase()}.${String(at.className).split(" ").slice(0, 2).join(".")}` : "nothing";
        };
        const name = el.getAttribute("aria-label") ?? squash(el.textContent).slice(0, 40);
        return {
          who: `${el.tagName.toLowerCase()} "${name}"`,
          box: `${Math.round(r.width * 10) / 10} by ${Math.round(r.height * 10) / 10}`,
          w: Math.round(w * 10) / 10,
          h: Math.round(h * 10) / 10,
          /* A disabled step gives up its overflow on purpose (flow-m.css); only reachable controls are probed. */
          above: (el as HTMLButtonElement).disabled ? true : hits(cy - 20),
          below: (el as HTMLButtonElement).disabled ? true : hits(cy + 20),
        };
      });
    },
    { selector, text },
  );
}

async function markup(node: ReactNode): Promise<string> {
  const { prelude } = await prerender(<ClientCopyProvider copy={clientCopyOf(t)}>{node}</ClientCopyProvider>);
  return new Response(prelude).text();
}

type Case = {
  name: string;
  /** A preview page rendered to markup, or a client body for `fitMount`. */
  page?: () => Promise<ReactNode>;
  imports?: string;
  body?: string | (() => Promise<string>);
  selector: string;
  text?: string;
  /** How many the fixture draws, so a selector that drifts cannot pass on nothing. */
  count: number;
  viewport?: { width: number; height: number };
  sheets?: string[];
};

const CASES: Case[] = [
  {
    name: "1. the listing wizard's Back and Close (f5/agent-list, a rental on step 4)",
    page: () => AgentListPreview({ searchParams: Promise.resolve({ draft: "rental", step: "4" }) }),
    /* The wizard moved onto StepFrame (Grade 1, November 2026): the numbered
       rail became a progress bar that is not a control, so what a thumb
       reaches at the top of every step is Back and Close. */
    selector: ".nf-g1step__bar .nf-g1step__round:not(.nf-g1step__round--empty)",
    count: 2,
  },
  {
    name: "2. the inspection's room checks (f5/inspection)",
    page: () => InspectionPreview(),
    selector: "button.nf-ix-room__check",
    count: 8,
  },
  {
    name: "3a. agent inspections: the listing title (f5/agent-inspections)",
    page: () => AgentInspectionsPreview(),
    selector: ".nf-console a[href^='/listing/']",
    count: 1,
  },
  {
    name: "3b. agent inspections: Open the chat (f5/agent-inspections)",
    page: () => AgentInspectionsPreview(),
    selector: ".nf-console a[href^='/messages/']",
    text: "Open the chat",
    count: 1,
  },
  {
    name: "3c. agent reviews: the listing line (f5/agent-reviews)",
    page: () => AgentReviewsPreview(),
    selector: "a[href^='/listing/']",
    count: 1,
  },
  {
    name: "3d. the db2 index's quiet links (db2)",
    page: async () => Db2Preview(),
    selector: "a.nf-link-quiet",
    count: 2,
  },
  {
    name: "3e. host landing: Contact us (f5/host-landing)",
    page: () => HostLandingPreview(),
    selector: "a[href='/contact?topic=verification']",
    count: 1,
  },
  {
    name: "3f. agent dashboard: View all (f5/agent-dashboard)",
    page: () => AgentDashboardPreview(),
    selector: "a.nf-link-quiet",
    text: t.common.viewAll,
    /* The fixture's one inspection is not one the dashboard lists, so its "View all" is not drawn:
       the pipeline's and the stays'. */
    count: 2,
  },
  /* 4. was the redesigned welcome tour's pager dots (TourPager); the founder
     rolled the tour back to its earlier design on 7 October 2026, which has
     no pager, so there is nothing of it left to measure. */
  ...[PHONE, { width: 768, height: 1024 }].map<Case>((viewport) => ({
    name: `5. the console header's home link at ${viewport.width} (bd/refunds)`,
    page: () => RefundsPreview(),
    selector: `header a[aria-label="${t.a11y.logoHome}"]`,
    count: 1,
    viewport,
    sheets: ["app/css/admin.css"],
  })),
  {
    name: "6a. Segmented, quiet (g1 CleanPreview)",
    imports: `import { CleanPreview } from "@/app/(dev)/preview/g1/CleanPreview";`,
    body: `<CleanPreview />`,
    selector: ".nf-segmented--quiet .nf-segmented__item",
    count: 10,
  },
  {
    name: "6b. Segmented, solid at sm and md (g1 ControlsPreview)",
    imports: `import { ControlsPreview } from "@/app/(dev)/preview/g1/ControlsPreview";`,
    body: `<ControlsPreview />`,
    selector: ".nf-segmented--solid .nf-segmented__item",
    count: 6,
  },
  {
    name: "7. the switch (g1 ControlsPreview)",
    imports: `import { ControlsPreview } from "@/app/(dev)/preview/g1/ControlsPreview";`,
    body: `<ControlsPreview />`,
    selector: "button.nf-switch",
    count: 3,
  },
  ...[
    { name: "8a. the assistant's result save heart, nf-icon-btn h-9 (f1/assistant)", selector: "button.nf-ai__result-save", count: 2, viewport: PHONE },
    { name: "8b. the assistant's delete conversation at 1440 (f1/assistant)", selector: "button[aria-label^='Delete conversation']", count: 1, viewport: { width: 1440, height: 900 } },
  ].map<Case>((one) => ({
    ...one,
    /* The chat draws its seeded thread once it is mounted, so it is mounted in the browser, with the
       preview page's own seed and viewer read off the element the page returns. */
    imports: `
      import { AssistantChat } from "@/components/app/assistant/AssistantChat";
      import { assistantCopyOf } from "@/components/app/assistant/assistant-copy";`,
    body: async () => {
      const main = (await AssistantPreview()) as ReactElement<{ children: ReactElement<{ viewer: unknown; seed: unknown }> }>;
      const { viewer, seed } = main.props.children.props;
      return `<main id="main" className="flex h-dvh min-w-0 flex-col overflow-hidden">
        <AssistantChat locale="en" viewer={${JSON.stringify(viewer)}} seed={${JSON.stringify(seed)}} t={assistantCopyOf(t)} />
      </main>`;
    },
  })),
];

describe.skipIf(!hasBrowser && !process.env.CI)("W12 touch targets reach 44px", () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const body = c.page
        ? `<div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(await markup(await c.page()))} }} />`
        : typeof c.body === "function"
          ? await c.body()
          : c.body!;
      const { page, close } = await fitMount({
        locale: "en",
        imports: c.imports ?? "",
        body,
        css: await appCss(...(c.sheets ?? [])),
        bleed: true,
        viewport: c.viewport ?? PHONE,
      });
      try {
        const found = await reach(page, c.selector, c.text);
        expect(found.length, `${c.selector} drawn`).toBeGreaterThanOrEqual(c.count);
        const short = found.filter((one) => one.w < 43.5 || one.h < 43.5).map((one) => `${one.who}: drawn ${one.box}, reaches ${one.w} by ${one.h}`);
        expect(short.join("\n"), "hit area under 44px").toBe("");
        const missed = found
          .filter((one) => one.above !== true || one.below !== true)
          .map((one) => `${one.who}: ${one.above === true ? "" : `20px above lands on ${one.above}; `}${one.below === true ? "" : `20px below lands on ${one.below}`}`);
        expect(missed.join("\n"), "hit area not reachable").toBe("");
      } finally {
        await close();
      }
    });
  }
});
