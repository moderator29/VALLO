/**
 * THE SPACE CARD (the founder, 13 October 2026): one container shape for every
 * listing that is shown. Mounted for real in Chromium on the product's compiled
 * cascade at 390px, in light and in dark, and held to the shape he asked for:
 *
 *   - one large soft outer card (28px), no border by day, a hairline at night,
 *     no glow ring;
 *   - the photo inset with an even 8px gap on the top and the sides, its radius
 *     the card's minus the gap;
 *   - a small white pill top left and a round white 44px heart top right, and
 *     the photo dots centred near the foot;
 *   - the info panel a SEPARATE rounded block under the photo with the same
 *     gap: the title on one line with an ellipsis, the price on the right with
 *     its unit under it, a quiet facts line with a small icon, and a third
 *     line in the brand blue only when a reason is passed;
 *   - one link a screen reader meets, the heart never inside it;
 *   - the compact variant is the same shape, smaller.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss } from "@/lib/testing/locale-fit";

/* The computed colour the browser reports for white, compared as data, never painted. */
// eslint-disable-next-line nf/no-raw-colour -- a computed style read back from the browser, compared as data
const WHITE = "rgb(255, 255, 255)";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = (props: string, wrapper = "390") => `
  import { mount } from "@/lib/testing/browser-root";
  import { SpaceCard } from "@/components/ui/space-card/SpaceCard";
  mount(
    <div style={{ width: ${wrapper}, padding: 16, boxSizing: "border-box" }}>
      <SpaceCard
        href="/listing/x"
        title="A very long title that cannot fit on one line of a phone and must end in an ellipsis"
        place="Bodija, Ibadan"
        photos={["/brand/photos/living-room-day-640.jpg", "/brand/photos/bedroom-01-640.jpg", "/brand/photos/villa-exterior-gate.jpg"]}
        status="To rent"
        heart={<button type="button" aria-label="Save" className="nf-icon-btn">S</button>}
        price={{ amount: "₦1.3m", unit: "to move in" }}
        facts={["2 beds", "2 baths", "96 m²"]}
        photoLabel="Photo {at} of {count}"
        ${props}
      />
    </div>,
  );
`;

type Reading = Awaited<ReturnType<typeof read>>;

const read = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
    };
    const card = document.querySelector(".nf-sc")!;
    const cs = getComputedStyle(card);
    const media = document.querySelector(".nf-sc__media")!;
    const info = document.querySelector(".nf-sc__info")!;
    const title = document.querySelector<HTMLElement>(".nf-sc__title")!;
    const status = document.querySelector(".nf-sc__status");
    const heart = document.querySelector<HTMLElement>(".nf-sc__heart > button");
    return {
      card: box(card),
      media: box(media),
      info: box(info),
      title: box(title),
      price: box(document.querySelector(".nf-sc__price")),
      amount: box(document.querySelector(".nf-sc__amount")),
      unit: box(document.querySelector(".nf-sc__unit")),
      heart: box(heart),
      status: box(status),
      cardRadius: parseFloat(cs.borderTopLeftRadius),
      cardBorder: cs.borderTopWidth + " " + cs.borderTopColor,
      cardBg: cs.backgroundColor,
      cardShadow: cs.boxShadow,
      mediaRadius: parseFloat(getComputedStyle(media).borderTopLeftRadius),
      infoRadius: parseFloat(getComputedStyle(info).borderTopLeftRadius),
      infoBg: getComputedStyle(info).backgroundColor,
      titleNowrap: getComputedStyle(title).whiteSpace,
      titleEllipsis: getComputedStyle(title).textOverflow,
      titleClipped: title.scrollWidth > title.clientWidth,
      statusBg: status ? getComputedStyle(status).backgroundColor : null,
      heartBg: heart ? getComputedStyle(heart).backgroundColor : null,
      heartInsideLink: !!heart?.closest("a"),
      links: [...document.querySelectorAll("a")].map((a) => ({ hidden: a.getAttribute("aria-hidden") === "true", tab: a.tabIndex })),
      dots: [...document.querySelectorAll(".nf-sc__dot")].map((d) => d.hasAttribute("data-on")),
      dotsBox: box(document.querySelector(".nf-sc__dots")),
      factsHasIcon: !!document.querySelector(".nf-sc__facts > svg"),
      factDividers: getComputedStyle(document.querySelectorAll(".nf-sc__fact")[1] ?? document.body, "::before").width,
      reason: document.querySelector(".nf-sc__reason")
        ? {
            color: getComputedStyle(document.querySelector(".nf-sc__reason")!).color,
            icon: !!document.querySelector(".nf-sc__reason > svg"),
          }
        : null,
      scheme: document.documentElement.getAttribute("data-theme"),
    };
  });

async function mounted(props: string, theme: "light" | "dark", wrapper = "390") {
  const m = await mountInBrowser({ entry: entry(props, wrapper), css: await appCss() });
  await m.page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
  await m.page.waitForTimeout(300);
  return m;
}

describe.skipIf(!hasBrowser && !process.env.CI)("the space card", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: the outer card, the inset photo and the separate info panel`, async () => {
      const { page, close } = await mounted(`reason="You said you came for rentals" reasonIcon="house-heart"`, theme);
      try {
        const at: Reading = await read(page);
        const card = at.card!;
        const media = at.media!;
        const info = at.info!;

        /* One large soft container: 28px, no hard border by day, a hairline at night. */
        expect(Math.round(at.cardRadius)).toBe(28);
        if (theme === "light") expect(at.cardBorder).toMatch(/^1px rgba\(0, 0, 0, 0\)$/);
        else expect(at.cardBorder).toMatch(/^1px /);
        /* No glow ring: nothing at night, a soft drop (never a spread ring) by day. */
        if (theme === "dark") expect(at.cardShadow).toMatch(/ 0px 0px 0px 0px$/);
        else expect(at.cardShadow).not.toBe("none");

        /* The photo is inset with an even 8px gap (the 1px edge is the card's own border). */
        const edge = card.x + 1;
        expect(Math.round(media.x - edge)).toBe(8);
        expect(Math.round(card.r - 1 - media.r)).toBe(8);
        expect(Math.round(media.y - (card.y + 1))).toBe(8);
        expect(Math.round(at.mediaRadius), "the card's radius minus the gap").toBe(20);

        /* The info panel is a separate block under the photo, the same gap, the same radius. */
        expect(Math.round(info.y - media.b)).toBe(8);
        expect(Math.round(info.x - media.x)).toBe(0);
        expect(Math.round(info.w - media.w)).toBe(0);
        expect(Math.round(at.infoRadius)).toBe(20);
        expect(at.infoBg, "a different surface from the card").not.toBe(at.cardBg);

        /* The pill, the heart and the dots. */
        expect(at.statusBg).toBe(WHITE);
        expect(at.status!.x).toBeLessThan(media.x + media.w / 2);
        expect(at.status!.y).toBeLessThan(media.y + 24);
        expect(at.heartBg).toBe(WHITE);
        expect(at.heart!.w).toBeGreaterThanOrEqual(44);
        expect(at.heart!.h).toBeGreaterThanOrEqual(44);
        expect(at.heart!.x).toBeGreaterThan(media.x + media.w / 2);
        expect(at.heart!.y).toBeLessThan(media.y + media.h / 2);
        expect(at.dots).toEqual([true, false, false]);
        expect(Math.abs(at.dotsBox!.x + at.dotsBox!.w / 2 - (media.x + media.w / 2))).toBeLessThanOrEqual(1);
        expect(at.dotsBox!.y).toBeGreaterThan(media.y + media.h / 2);

        /* The title is one line with an ellipsis; the price sits on the right with its unit under it. */
        expect(at.titleNowrap).toBe("nowrap");
        expect(at.titleEllipsis).toBe("ellipsis");
        expect(at.titleClipped).toBe(true);
        expect(at.title!.h).toBeLessThan(30);
        expect(at.price!.x).toBeGreaterThan(at.title!.x + 40);
        expect(at.unit!.y).toBeGreaterThanOrEqual(at.amount!.b - 1);
        expect(Math.abs(at.unit!.r - at.amount!.r)).toBeLessThanOrEqual(1);

        /* The quiet facts line with its small icon, and the reason in the brand blue with its own. */
        expect(at.factsHasIcon).toBe(true);
        expect(parseFloat(at.factDividers)).toBeGreaterThan(0);
        expect(at.reason?.icon).toBe(true);

        /* One link for a screen reader (the title), the photographs hidden and out of the tab order. */
        expect(at.links.filter((link) => !link.hidden)).toHaveLength(1);
        expect(at.links.filter((link) => link.hidden).every((link) => link.tab === -1)).toBe(true);
        expect(at.heartInsideLink).toBe(false);
      } finally {
        await close();
      }
    });
  }

  it("night uses a raised navy surface, day a white one", async () => {
    const day = await mounted("", "light");
    const dayAt = await read(day.page);
    await day.close();
    const night = await mounted("", "dark");
    const nightAt = await read(night.page);
    await night.close();
    expect(dayAt.cardBg).toBe(WHITE);
    expect(nightAt.cardBg).not.toBe(WHITE);
    /* Navy, not grey: blue leads in the dark card. */
    const [r, g, b] = nightAt.cardBg.match(/\d+/g)!.map(Number) as [number, number, number];
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("draws no reason line unless it is given one, no dots for one photograph, no pill without a status", async () => {
    const { page, close } = await mounted(`photos={["/brand/photos/living-room-day-640.jpg"]} status={null}`, "light");
    try {
      const at = await read(page);
      expect(at.reason).toBeNull();
      expect(at.dots).toEqual([]);
      expect(at.status).toBeNull();
    } finally {
      await close();
    }
  });

  it("moves the dot with the photograph as the gallery scrolls", async () => {
    const { page, close } = await mounted("", "light");
    try {
      await page.evaluate(() => {
        const gallery = document.querySelector<HTMLElement>(".nf-sc__gallery")!;
        gallery.scrollTo({ left: gallery.clientWidth, behavior: "instant" });
      });
      await page.waitForTimeout(400);
      expect((await read(page)).dots).toEqual([false, true, false]);
    } finally {
      await close();
    }
  });

  it("the compact variant is the same shape, smaller, and leaves the place and the dots out", async () => {
    const full = await mounted("", "light");
    const fullAt = await read(full.page);
    await full.close();
    const compact = await mounted(`variant="compact"`, "light", "272");
    try {
      const at = await read(compact.page);
      expect(at.card!.w).toBeLessThan(fullAt.card!.w);
      expect(Math.round(at.cardRadius)).toBe(22);
      expect(Math.round(at.info!.y - at.media!.b)).toBe(6);
      expect(at.dots).toEqual([]);
      expect(await compact.page.locator(".nf-sc__place").count()).toBe(0);
      expect(at.heart!.w).toBeGreaterThanOrEqual(44);
    } finally {
      await compact.close();
    }
  });
});
