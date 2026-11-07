/**
 * THE LISTING PAGE'S NEW PIECES, MOUNTED FOR REAL (founder's reference, 13
 * October 2026), in Chromium on the product's compiled cascade at 390px:
 *
 *   Listed by    the person is a link to /u/<handle>; the name carries the
 *                published badge and the role word; message opens the
 *                listing's conversation; call opens the same conversation
 *                (labelled for it) unless the page passed a live call, which
 *                rings through the calls feature and shows the database's
 *                refusal under the card. No online dot, no rating.
 *   Read more    the description opens and closes in the reader's words.
 *   Fact chips   five show; "+N" opens the rest and closes them again.
 *   Sticky CTA   "Schedule a visit" links to /listing/<id>/visit and spans
 *                the phone's width under the figure.
 *   Amenities    round plates, five and "+N" to the full list, no two
 *                labels running into each other in a phone's lead card.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT * 2 });
beforeAll(async () => {
  if (hasBrowser) await warmBrowser();
});
afterAll(closeBrowser);

const LISTING_ID = "00000000-0000-4000-8000-00000000f301";

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { ListingAgentCard } from "@/components/app/listing/ListingAgentCard";
  import { ListerCallButton } from "@/components/app/listing/ListerCallButton";
  import { ListingAbout } from "@/components/app/listing/ListingAbout";
  import { ListingSpecChips } from "@/components/app/listing/ListingSpecChips";
  import { ListingAmenityTiles } from "@/components/app/listing/ListingAmenityTiles";
  import { ListingStickyBar } from "@/components/app/listing/ListingStickyBar";
  import { specChips } from "@/components/app/listing/spec-chips";
  import { RENTAL } from "@/app/(dev)/preview/f3/fixtures";
  import { ToastHost } from "@/components/ui/ToastHost";

  const t = getDictionary("en");
  const d = t.catalogue.detail;
  const listing = { ...RENTAL, furnished: "fully_furnished", floor: 2, condition: "renovated", toilets: 6 };
  const messageHref = "/messages/new?listing=" + listing.id;
  const lister = { name: "Daniel Okafor", handle: "danielokafor", avatarUrl: null, role: "landlord", tier: "gold" };

  mount(
    <main className="nf-shell" style={{ padding: 16 }}>
      <section data-testid="card-plain">
        <ListingAgentCard verified t={t} messageHref={messageHref} lister={lister} />
      </section>
      <section data-testid="card-live" style={{ marginTop: 24 }}>
        <ListingAgentCard
          verified
          t={t}
          messageHref={messageHref}
          lister={{ ...lister, handle: null }}
          call={
            <ListerCallButton
              conversationId="c0000000-0000-4000-8000-000000000001"
              name="Daniel Okafor"
              contextLine="Luxury 4 bedroom duplex"
              copy={{
                label: t.calls.buttons.voiceWith,
                notEngagedTitle: t.calls.refusal.notEngagedTitle,
                notEngagedBody: t.calls.refusal.notEngagedBody,
                busy: t.calls.outgoing.busy,
                dismiss: t.calls.refusal.dismiss,
              }}
            />
          }
        />
      </section>
      <section style={{ marginTop: 80 }}>
        <ListingAbout
          labels={{ readMore: d.readMore, showLess: d.showLess }}
          paragraphs={["The first paragraph about the home.", "The second paragraph, which Read more reveals."]}
        />
      </section>
      <section style={{ marginTop: 24 }}>
        <ListingSpecChips chips={specChips(listing, t, "en")} labels={{ more: d.allFacts, fewer: d.fewerFacts }} />
      </section>
      <section style={{ marginTop: 24, width: 326 }} data-testid="plates-host">
        <ListingAmenityTiles variant="plates" amenities={listing.amenities} limit={5} moreHref="#amenities" moreLabel={d.more} />
      </section>
      <ToastHost />
      <ListingStickyBar
        variant="rental"
        priceMinor={listing.priceMinor}
        currency="NGN"
        locale="en"
        perLabel="per year"
        action={{ label: d.scheduleVisit, href: "/listing/" + listing.id + "/visit" }}
        secondary={{ label: d.calculateBreakdown, href: "/rent/move-in/" + listing.id }}
        secondaryIcon="document"
        fallbackLabel={listing.title}
        moveInMinor={listing.moveInCostMinor}
        moveInStated={listing.moveInCostStated}
        moveInLabel={d.moveInTotal}
        moveInFromLabel={d.moveInFrom}
        secondaryShortLabel={d.breakdownShort}
        sidePanelFromLg
        stackOnPhone
      />
    </main>
  );
`;

const NOT_ENGAGED = "You can call once they have replied in this conversation. Send a message first.";

describe.skipIf(!hasBrowser && !process.env.CI)("the listing page's new pieces at 390px", () => {
  it("Listed by: profile link, badge, role word, message and call actions, nothing invented", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: await appCss(),
      actions: { startCall: `async () => ({ ok: false, error: ${JSON.stringify(NOT_ENGAGED)} })` },
    });
    try {
      const plain = page.getByTestId("card-plain");
      const profile = plain.getByTestId("lister-profile");
      expect(await profile.getAttribute("href")).toBe("/u/danielokafor");
      expect(await plain.getByTestId("lister-name").textContent()).toContain("Daniel Okafor");
      expect(await plain.getByTestId("tier-badge").getAttribute("data-tier")).toBe("gold");
      expect(await plain.getByTestId("lister-role-word").textContent()).toBe("Landlord");

      const message = plain.getByTestId("lister-message");
      expect(await message.getAttribute("href")).toBe(`/messages/new?listing=${LISTING_ID}`);
      expect(await message.getAttribute("aria-label")).toBe("Message Daniel Okafor");

      /* No live call passed: the call button is the conversation, and says so. */
      const call = plain.getByTestId("lister-call");
      expect(await call.getAttribute("data-call")).toBe("message");
      expect(await call.getAttribute("href")).toBe(`/messages/new?listing=${LISTING_ID}`);
      expect(await call.getAttribute("aria-label")).toBe("Message Daniel Okafor first to arrange a call");

      /* Both are round 44px plates, side by side on the person's row. */
      const box = await call.boundingBox();
      expect(Math.round(box!.width)).toBe(44);
      expect(Math.round(box!.height)).toBe(44);
      const card = await plain.getByTestId("agent-card").boundingBox();
      const msgBox = await message.boundingBox();
      expect(msgBox!.x + msgBox!.width).toBeLessThanOrEqual(card!.x + card!.width);
      expect(Math.abs(msgBox!.y - box!.y)).toBeLessThan(2);

      /* Nothing a person does not have: no online dot, no rating. */
      const text = (await plain.textContent()) ?? "";
      expect(text).not.toMatch(/online/i);
      expect(await plain.locator("[data-testid=detail-rating]").count()).toBe(0);

      /* With no claimed handle the person is not a link. */
      const live = page.getByTestId("card-live");
      expect(await live.getByTestId("lister-profile").count()).toBe(0);

      /* A live call rings through the calls feature; the database's refusal
         is said by the one banner (Grade 1) in the calls feature's own words. */
      const liveCall = live.getByTestId("lister-call");
      expect(await liveCall.getAttribute("data-call")).toBe("live");
      expect(await liveCall.getAttribute("aria-label")).toBe("Voice call Daniel Okafor");
      await liveCall.click();
      const note = page.getByTestId("lister-call-note");
      await note.waitFor();
      expect(await note.textContent()).toContain("Calls open once they have replied");
    } finally {
      await close();
    }
  });

  it("Read more opens the description and Show less closes it", async () => {
    const { page, close } = await mountInBrowser({ entry, css: await appCss() });
    try {
      const toggle = page.getByTestId("about-toggle");
      expect(await toggle.textContent()).toContain("Read more");
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
      expect(await page.getByText("The second paragraph, which Read more reveals.").count()).toBe(0);
      await toggle.click();
      expect(await toggle.getAttribute("aria-expanded")).toBe("true");
      expect(await toggle.textContent()).toContain("Show less");
      expect(await page.getByText("The second paragraph, which Read more reveals.").count()).toBe(1);
      await toggle.click();
      expect(await page.getByText("The second paragraph, which Read more reveals.").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("the fact chips show five and +N opens the rest", async () => {
    const { page, close } = await mountInBrowser({ entry, css: await appCss() });
    try {
      const row = page.getByTestId("spec-chips");
      const chips = row.locator(".nf-spec-tile");
      expect(await chips.count()).toBe(5);
      const keys = await chips.evaluateAll((els) => els.map((el) => el.getAttribute("data-chip")));
      expect(keys.slice(0, 3)).toEqual(["beds", "baths", "size"]);

      const more = page.getByTestId("spec-chips-more");
      const hidden = Number(((await more.textContent()) ?? "").replace(/\D/g, ""));
      expect(hidden).toBeGreaterThan(1);
      expect(await more.getAttribute("aria-expanded")).toBe("false");
      expect(await more.getAttribute("aria-label")).toBe(`+${hidden} Show all details`);
      await more.click();
      expect(await chips.count()).toBe(5 + hidden);
      expect(await more.getAttribute("aria-expanded")).toBe("true");
      expect(await more.getAttribute("aria-label")).toBe("Show fewer details");
      await more.click();
      expect(await chips.count()).toBe(5);

      /* No chip breaks a word across lines and none runs off the phone. */
      const overflow = await row.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
    } finally {
      await close();
    }
  });

  it("the amenity row is one row: four plates and +N on a phone, five from 30rem, with room for every word", async () => {
    const { page, close } = await mountInBrowser({ entry, css: await appCss() });
    try {
      const row = page.getByTestId("amenity-plates");
      const visiblePlates = row.locator("[data-amenity]:visible");
      expect(await visiblePlates.count()).toBe(4);
      const more = row.locator("[data-testid=amenity-plates-more]:visible");
      expect(await more.count()).toBe(1);
      expect(await more.getAttribute("href")).toBe("#amenities");
      /* Seven amenities: four shown, so "+3", and the name says it. */
      expect(await more.getAttribute("aria-label")).toBe("+3 More");
      /* One row, and no label runs into its neighbour. */
      const boxes = await row.locator("li:visible").evaluateAll((els) =>
        els.map((el) => {
          const label = el.querySelector(":scope > span:last-child, :scope > a > span:last-child")!;
          const r = label.getBoundingClientRect();
          return { left: r.left, right: r.right, top: Math.round(el.getBoundingClientRect().top) };
        }),
      );
      expect(new Set(boxes.map((b) => b.top)).size).toBe(1);
      for (let i = 1; i < boxes.length; i += 1) expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right - 0.5);

      /* From 30rem the fifth plate joins and "+N" is one smaller. */
      await page.setViewportSize({ width: 600, height: 844 });
      await page.getByTestId("plates-host").evaluate((el) => ((el as HTMLElement).style.width = "520px"));
      expect(await visiblePlates.count()).toBe(5);
      expect(await row.locator("[data-testid=amenity-plates-more]:visible").getAttribute("aria-label")).toBe("+2 More");
    } finally {
      await close();
    }
  });

  it("Schedule a visit links to the visit flow and spans the phone's width", async () => {
    const { page, close } = await mountInBrowser({ entry, css: await appCss() });
    try {
      const action = page.getByTestId("sticky-action");
      expect(await action.textContent()).toContain("Schedule a visit");
      expect(await action.getAttribute("href")).toBe(`/listing/${LISTING_ID}/visit`);
      const bar = await page.getByTestId("listing-sticky-bar").boundingBox();
      const button = await action.boundingBox();
      /* The full row of the foot, under the figure and the breakdown. */
      expect(button!.width).toBeGreaterThan(bar!.width - 2);
      const figure = await page.getByTestId("sticky-total").boundingBox();
      expect(button!.y).toBeGreaterThan(figure!.y + figure!.height - 1);
      /* The breakdown is still there beside the figure. */
      expect(await page.getByTestId("sticky-breakdown").getAttribute("href")).toBe(`/rent/move-in/${LISTING_ID}`);
    } finally {
      await close();
    }
  });
});
