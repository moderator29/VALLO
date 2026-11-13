/**
 * NO TEXT COLUMN COLLAPSES TO A COLUMN OF LETTERS (13 November 2026).
 *
 * `overflow-wrap: anywhere` counts toward an element's min-content width, so
 * a text column beside a fixed-width sibling (a name beside the Follow and
 * Message buttons, a title beside a figure, a label beside a value) could be
 * told that one letter was wide enough, and "Joseph Agboola" ran down the
 * people row as "Josep / h / Agbool / a". The platform now wraps with
 * `break-word` (`app/css/overflow-wrap.test.ts` gates it) and this mounts the
 * four surfaces the audit named, with long names, at 390 and 360 wide in
 * Chromium on the product's real compiled cascade, and fails on any text box
 * that is narrower than 22px and taller than 70px (the audit's own measure of
 * a column of letters), and on any text that takes more lines than it has
 * words plus one (a word broken at its letters takes more).
 *
 *   - the people row (`/u`): the name and the handle beside two buttons;
 *   - the saved row (`SavedShelf`): the name beside the figure and the heart;
 *   - a list row (`RowLink`, `RowValue`): the label beside its value;
 *   - a card (`ListingCard`), one across and wide: the title beside the price.
 *
 * Set `SWEEP_SHOTS_DIR` to also write a screenshot per width.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { layoutCss } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const WIDTHS = [390, 360] as const;

const NAMES = ["Joseph Agboola", "Oluwaseyifunmi Omojuni-Adebayo Ebenezer", "Chukwuemeka Nwachukwu-Okonkwo"];
const TITLE = "Luxury four bedroom semi-detached duplex with boys quarters in Lekki Phase 1";

const entry = `
  import { createRoot } from "react-dom/client";
  import { getDictionary } from "@vallo/i18n";
  import { ClientCopyProvider } from "@/lib/i18n/client-copy";
  import { clientCopyOf } from "@/lib/i18n/client-copy-of";
  import { FollowButton } from "@/components/social/profile/FollowButton";
  import { ButtonLink } from "@/components/ui/Button";
  import { SavedShelf } from "@/app/(app)/saved/SavedShelf";
  import { RowLink, RowValue } from "@/components/app/account/rows";
  import { ListingCard } from "@/components/app/ListingCard";
  import { SHELF } from "@/app/(dev)/preview/f3/fixtures";
  const t = getDictionary("en");
  const names = ${JSON.stringify(NAMES)};
  const long = { ...SHELF[0], title: ${JSON.stringify(TITLE)}, area: "Lekki Phase 1" };
  const figure = (amount) => (<><span>{amount}</span><span className="nf-shelf__unit"> to move in</span></>);
  createRoot(document.getElementById("root")).render(
    <ClientCopyProvider copy={clientCopyOf(t)}>
      <main className="nf-shell" style={{ padding: 16, display: "grid", gap: 16 }}>
        <ul data-case="people" className="flex flex-col gap-[var(--nf-social-gap)]">
          {names.map((name) => (
            <li key={name} className="nf-panel nf-panel--card nf-people__row flex-row">
              <a href="/u/x" className="nf-people__who">
                <span className="nf-people__avatar"><span aria-hidden="true">{name[0]}</span></span>
                <span className="nf-people__text">
                  <span className="nf-people__name"><span className="truncate-none">{name}</span></span>
                  <span className="nf-people__handle">@{name.toLowerCase().replace(/[^a-z]/g, "")}</span>
                  <span className="nf-people__bio">Looking for a two bedroom flat around Yaba from January.</span>
                </span>
              </a>
              <span className="nf-people__acts">
                <FollowButton handle="x" initialFollowing={false} signedIn compact />
                <ButtonLink href="/u/x/message" variant="icon" round leadingIcon="messages" className="nf-people__msg--glyph" aria-label={"Message " + name} />
                <ButtonLink href="/u/x/message" variant="secondary" size="sm" className="nf-people__msg--word">Message</ButtonLink>
              </span>
            </li>
          ))}
        </ul>
        <div data-case="saved" className="grid gap-[12px]">
          {[TITLE_, "Mini flat in Yaba"].map((title) => (
            <div key={title} className="nf-shelf-row">
              <SavedShelf href="/listing/a" title={title} where="Lekki Phase 1, Lagos" photo={null} hue={210} kind="apartment" figure={figure("N7,500,000")} status="For rent" verified={false} />
            </div>
          ))}
        </div>
        <div data-case="rows" className="nf-sgroup__body nf-panel nf-panel--card">
          <RowLink href="/settings/x" icon="user" label={names[1]} sub="Display name" value="Change" />
          <RowValue icon="mail" label="Email address" value="oluwaseyifunmi.omojuni-adebayo@example.com" />
          <RowValue icon="location" label="Preferred area" value={names[2]} />
        </div>
        <div data-case="cards" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
          <ListingCard listing={long} locale="en" t={t} index={0} />
          <ListingCard listing={long} locale="en" t={t} index={1} wide />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <ListingCard listing={long} locale="en" t={t} index={2} />
            <ListingCard listing={{ ...long, title: "Self contain in Ikorodu" }} locale="en" t={t} index={3} />
          </div>
        </div>
      </main>
    </ClientCopyProvider>,
  );
  requestAnimationFrame(() => { window.__mounted = true; });
`.replace("TITLE_", JSON.stringify(TITLE));

type Offender = string;

/** Every element that holds words of its own: its box, its lines and its words. */
function measure(page: Page): Promise<Offender[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const say = (el: Element) => {
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      const words = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""} "${words}"`;
    };
    for (const el of document.querySelectorAll("#root *")) {
      const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join(" ").trim();
      if (!own) continue;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || s.position === "absolute") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 22 && r.height > 70) out.push(`${say(el)} is a column of letters: ${Math.round(r.width)}px wide, ${Math.round(r.height)}px tall`);
      const line = parseFloat(s.lineHeight);
      if (Number.isFinite(line) && line > 0) {
        const lines = Math.round(r.height / line);
        const words = own.split(/\s+/).length;
        if (lines > words + 1) out.push(`${say(el)} takes ${lines} lines for ${words} word(s)`);
      }
    }
    return out;
  });
}

const SHOTS = process.env.SWEEP_SHOTS_DIR;

describe.skipIf(!hasBrowser && !process.env.CI)("no text column collapses to a column of letters", () => {
  for (const width of WIDTHS) {
    it(`people row, saved row, list rows and cards with long names at ${width}px`, async () => {
      const { page, close } = await mountInBrowser({
        entry,
        css: await layoutCss("app/(app)/layout.tsx", "app/css/list-views.css"),
        viewport: { width, height: 844 },
        url: "http://vallo.test/u",
      });
      try {
        await page.waitForSelector('[data-case="cards"] .nf-pcard__title');
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
        if (SHOTS) {
          if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `letter-columns-${width}.png`), fullPage: true });
        }
        const found = await measure(page);
        expect(found.join("\n"), "a text column collapsed").toBe("");
        /* The row the audit named: the name sits beside the two buttons on one row, in whole words. */
        const name = await page.$eval('[data-case="people"] .nf-people__name > span', (el) => el.getBoundingClientRect().width);
        expect(name).toBeGreaterThan(120);
      } finally {
        await close();
      }
    });
  }
});
