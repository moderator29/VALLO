/**
 * The trust checks, mounted for real in Chromium on the real Sheet and the
 * real grouped list: a dated row opens a sheet that says when, who, what was
 * looked at and what it does not prove; an explainer row says how it is
 * earned and never a date; a long register name wraps at a word and never
 * runs down the card a letter at a time; every row is a 44pt target.
 *
 * Set `HUNTER_SHOTS_DIR` to also write screenshots there (a proof aid; the
 * suite never depends on it).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { PORTED_CSS } from "@/components/ui/ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const WEB = join(__dirname, "..", "..", "..", "..");
const sheet = (...parts: string[]) => readFileSync(join(WEB, "src", ...parts), "utf8");
const CSS = [
  PORTED_CSS,
  sheet("app", "css", "typography.css"),
  sheet("app", "css", "list-group.css"),
  sheet("app", "css", "utilities.css"),
  readFileSync(join(__dirname, "trust-checks.css"), "utf8"),
  "#root{padding:16px;}",
].join("\n");

const t = getDictionary("en");
const words = t.trustReasons;

type Page = import("playwright-core").Page;

async function maybeShot(page: Page, name: string) {
  const dir = process.env.HUNTER_SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
}

function spaceEntry(view: "dated" | "empty") {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { TrustFacts } from "@/components/app/listing/TrustFacts";
    import { proofLines } from "@/lib/trust/proof-strip";
    import { mount } from "@/lib/testing/browser-root";
    const t = getDictionary("en");
    const dated = ${JSON.stringify(view === "dated")};
    const lines = dated ? proofLines({
      isDemo: false,
      identitySeenAt: "2026-08-14T09:00:00Z",
      ownershipVerifiedAt: "2026-08-20T09:00:00Z",
      credentials: [{ kind: "lasrera", number: "LAS-0004411", company: null, registerName: "Adaeze Chukwuemeka-Olanrewaju", checkedAt: "2026-09-01T09:00:00Z" }],
      renters: { attended: 7, asListed: 6, lastAt: "2026-10-01T00:00:00Z" },
    }) : [];
    mount(
      <TrustFacts
        listingId="x"
        trust={dated ? { inspectedAt: "2026-09-12T10:00:00Z", addressCheckedAt: "2026-08-03T09:00:00Z" } : { inspectedAt: null, addressCheckedAt: null }}
        strip={null}
        proofCount={lines.length}
        lines={lines}
        locale="en"
        t={t}
        variant="full"
        askHref={dated ? null : "/messages/new?listing=x"}
      />,
    );
  `;
}

const personEntry = `
  import { getDictionary } from "@vallo/i18n";
  import { PersonReasons } from "@/components/app/trust/PersonReasons";
  import { personChecks, personStats, reasonsTitle } from "@/lib/trust/checks";
  import { mount } from "@/lib/testing/browser-root";
  const copy = getDictionary("en").trustReasons;
  mount(
    <PersonReasons
      title={reasonsTitle("Sophia Duru", copy)}
      lede={copy.person.lede}
      stats={personStats({ reviewCount: 18, averageRating: 4.8, memberSince: "2025-03-04T09:00:00Z" }, copy, "en")}
      checks={personChecks({
        identitySeenAt: "2026-11-03T08:00:00Z",
        identityMethod: "seen",
        phoneConfirmedAt: "2026-11-12T08:00:00Z",
        emailConfirmedAt: "2026-11-12T07:40:00Z",
        promiseAcceptedAt: "2026-11-13T09:00:00Z",
      }, copy, "en")}
      labels={copy.sheet}
    />,
  );
`;

const ownEntry = `
  import { getDictionary } from "@vallo/i18n";
  import { OwnChecks } from "@/components/app/trust/OwnChecks";
  import { mount } from "@/lib/testing/browser-root";
  import { subscribeToast } from "@/lib/ui/toast";
  window.__toasts = [];
  subscribeToast((item) => { if (item) window.__toasts.push([item.message, item.tone]); });
  const copy = getDictionary("en").trustReasons;
  mount(
    <OwnChecks
      rows={[
        { key: "identity", title: copy.own.identity.title, how: copy.own.identity.how, href: "/verification" },
        { key: "phone", title: copy.own.phone.title, how: copy.own.phone.how, href: "/settings/phone" },
        { key: "promise", title: copy.own.promise.title, how: copy.own.promise.how },
      ]}
      words={{ ...copy.own, close: copy.sheet.close }}
    />,
  );
`;

const footEntry = `
  import { getDictionary } from "@vallo/i18n";
  import { PromiseFoot } from "@/components/app/trust/PromiseFoot";
  import { mount } from "@/lib/testing/browser-root";
  import { subscribeToast } from "@/lib/ui/toast";
  window.__toasts = [];
  subscribeToast((item) => { if (item) window.__toasts.push([item.message, item.tone]); });
  const own = getDictionary("en").trustReasons.own;
  mount(
    <PromiseFoot
      locale="en"
      words={{ accept: own.promiseAccept, accepted: own.promiseAccepted, done: own.promiseDone, failed: own.promiseFailed, signedOut: own.promiseSignedOut, note: own.promiseNote }}
    />,
  );
`;

const toasts = (page: Page) => page.evaluate(() => (window as unknown as { __toasts: [string, string][] }).__toasts);
const routerCalls = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).map((call) => call[0]));

/** Text that has collapsed into a column: narrower than two of its own characters, taller than three lines. */
const collapsed = (page: Page) =>
  page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll("#root *")) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent?.trim() ?? "").join("");
      if (own.length < 6) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const line = parseFloat(cs.lineHeight) || size * 1.4;
      if (r.width > 0 && r.width < size * 2.2 && r.height > line * 3) bad.push(own.slice(0, 30));
    }
    return bad;
  });

describe.skipIf(!hasBrowser)("the trust checks in a real browser", () => {
  it("a dated check opens a sheet that says when, who, what was looked at and what it does not prove", async () => {
    const { page, close } = await mountInBrowser({ entry: spaceEntry("dated"), css: CSS });
    try {
      await page.waitForSelector('[data-testid="trust-checks-space"]');
      await maybeShot(page, "space-dated-390");
      const groups = await page.$$eval(".nf-list-section__head", (heads) => heads.map((h) => h.textContent?.trim()));
      expect(groups[0]).toContain(words.space.spaceGroup);
      expect(groups[1]).toContain(words.space.listerGroup);

      await page.click('[data-testid="trust-check-inspected"]');
      await page.waitForSelector('[data-testid="trust-check-sheet"] .nf-reasons-sheet');
      const labels = await page.$$eval('[data-testid="trust-check-sheet"] dt', (els) => els.map((el) => el.textContent));
      expect(labels).toEqual([words.sheet.when, words.sheet.what, words.sheet.who, words.sheet.notProof]);
      const body = await page.textContent('[data-testid="trust-check-sheet"]');
      /* Node and Chromium abbreviate September differently ("Sept", "Sep"). */
      expect(body).toMatch(/12 Sept? 2026/);
      expect(body).toContain(words.checks.inspected.what);
      expect(body).toContain(words.checks.inspected.not);
      expect(body).toContain(words.who.staffVisit);
      await maybeShot(page, "space-dated-sheet-390");
    } finally {
      await close();
    }
  });

  it("every row is at least a 44pt target, and a long register name never collapses to a column of letters", async () => {
    for (const width of [320, 390]) {
      const { page, close } = await mountInBrowser({ entry: spaceEntry("dated"), css: CSS, viewport: { width, height: 844 } });
      try {
        await page.waitForSelector('[data-testid="trust-check-lasrera"]');
        const sizes = await page.$$eval("button.nf-reasons__row", (rows) =>
          rows.map((row) => {
            const r = row.getBoundingClientRect();
            return [Math.round(r.width), Math.round(r.height)];
          }),
        );
        expect(sizes.length).toBeGreaterThan(4);
        for (const [w, h] of sizes) {
          expect(h).toBeGreaterThanOrEqual(44);
          expect(w).toBeGreaterThanOrEqual(200);
        }
        expect(await collapsed(page)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      } finally {
        await close();
      }
    }
  });

  it("with nothing dated: the plain statement, the way to the lister, and explainer rows that open without a date", async () => {
    const { page, close } = await mountInBrowser({ entry: spaceEntry("empty"), css: CSS });
    try {
      await page.waitForSelector('[data-testid="trust-none"]');
      expect(await page.textContent('[data-testid="trust-none"]')).toContain(words.space.emptyTitle);
      expect(await page.getAttribute('[data-testid="trust-ask"]', "href")).toBe("/messages/new?listing=x");
      expect(await page.$$eval('[data-testid="trust-explainer"] time', (els) => els.length)).toBe(0);
      await maybeShot(page, "space-empty-390");

      await page.click('[data-testid="trust-explainer"] [data-testid="trust-check-ownership"]');
      await page.waitForSelector('[data-testid="trust-check-sheet"] .nf-reasons-sheet');
      const labels = await page.$$eval('[data-testid="trust-check-sheet"] dt', (els) => els.map((el) => el.textContent));
      expect(labels).toEqual([words.sheet.means, words.sheet.who, words.sheet.earn, words.sheet.notProof]);
      expect(await page.textContent('[data-testid="trust-check-sheet"]')).toContain(words.checks.ownership.earn);
      await maybeShot(page, "space-empty-sheet-390");
    } finally {
      await close();
    }
  });

  it("a person's section: real numbers, then each dated check, the promise told apart as a commitment", async () => {
    const { page, close } = await mountInBrowser({ entry: personEntry, css: CSS });
    try {
      await page.waitForSelector('[data-testid="person-reasons"]');
      expect(await page.textContent(".nf-reasons-person__title")).toBe("Reasons to trust Sophia");
      const stats = await page.$$eval(".nf-reasons-stats__cell", (cells) => cells.map((c) => c.textContent));
      expect(stats.length).toBe(3);
      const kinds = await page.$$eval("button.nf-reasons__row", (rows) => rows.map((r) => r.getAttribute("data-testid")));
      expect(kinds).toEqual(["trust-check-personIdentity", "trust-check-phone", "trust-check-email", "trust-check-promise"]);
      /* Nothing private is on the page: no number, no address. */
      expect(await page.textContent("#root")).not.toMatch(/\+234|@/);
      await maybeShot(page, "person-390");

      await page.click('[data-testid="trust-check-promise"]');
      await page.waitForSelector('[data-testid="trust-check-sheet"] .nf-reasons-sheet');
      const body = await page.textContent('[data-testid="trust-check-sheet"]');
      expect(body).toContain(words.checks.promise.not);
      expect(body).toContain("13 Nov 2026");
      await maybeShot(page, "person-sheet-390");
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser)("a member's own checks and the Community Promise, in a real browser", () => {
  it("the rows to add lead to the real places, and the promise is accepted in its sheet", async () => {
    const { page, close } = await mountInBrowser({
      entry: ownEntry,
      css: CSS,
      actions: { acceptCommunityPromise: `async () => ({ ok: true, at: "2026-11-13T09:00:00Z" })` },
    });
    try {
      await page.waitForSelector('[data-testid="own-checks"]');
      expect(await page.getAttribute('[data-testid="own-check-identity"]', "href")).toBe("/verification");
      expect(await page.getAttribute('[data-testid="own-check-phone"]', "href")).toBe("/settings/phone");
      await maybeShot(page, "own-390");

      await page.click('[data-testid="own-check-promise"]');
      await page.waitForSelector('[data-testid="promise-sheet"] [data-testid="promise-accept"]');
      const body = await page.textContent('[data-testid="promise-sheet"]');
      for (const point of words.own.promisePoints) expect(body).toContain(point);
      expect(body).toContain(words.own.promiseNote);
      await maybeShot(page, "own-promise-sheet-390");

      await page.click('[data-testid="promise-accept"]');
      await page.waitForFunction(() => (window as unknown as { __toasts: unknown[] }).__toasts.length > 0);
      expect(await toasts(page)).toEqual([[words.own.promiseDone, "success"]]);
      /* The server is asked to draw the page again, with the dated line. */
      expect(await routerCalls(page)).toContain("refresh");
    } finally {
      await close();
    }
  });

  it("an acceptance that was not recorded says so and never reads as a success", async () => {
    const { page, close } = await mountInBrowser({
      entry: ownEntry,
      css: CSS,
      actions: { acceptCommunityPromise: `async () => ({ ok: false, reason: "failed" })` },
    });
    try {
      await page.click('[data-testid="own-check-promise"]');
      await page.click('[data-testid="promise-accept"]');
      await page.waitForFunction(() => (window as unknown as { __toasts: unknown[] }).__toasts.length > 0);
      expect(await toasts(page)).toEqual([[words.own.promiseFailed, "error"]]);
      expect(await routerCalls(page)).not.toContain("refresh");
      /* The sheet stays, so the member can try again. */
      expect(await page.locator('[data-testid="promise-accept"]').count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("the foot of the promise: nothing for a visitor, the action for a member, the date once accepted", async () => {
    const visitor = await mountInBrowser({ entry: footEntry, css: CSS, actions: { readMyPromise: `async () => ({ state: "signed-out" })` } });
    try {
      await visitor.page.waitForTimeout(400);
      expect(await visitor.page.locator('[data-testid="promise-foot"], [data-testid="promise-accepted"]').count()).toBe(0);
    } finally {
      await visitor.close();
    }

    const unread = await mountInBrowser({ entry: footEntry, css: CSS, actions: { readMyPromise: `async () => ({ state: "unavailable" })` } });
    try {
      await unread.page.waitForTimeout(400);
      expect(await unread.page.locator('[data-testid="promise-foot"]').count()).toBe(0);
    } finally {
      await unread.close();
    }

    const member = await mountInBrowser({
      entry: footEntry,
      css: CSS,
      actions: {
        readMyPromise: `async () => ({ state: "open" })`,
        acceptCommunityPromise: `async () => ({ ok: true, at: "2026-11-13T09:00:00Z" })`,
      },
    });
    try {
      await member.page.waitForSelector('[data-testid="promise-accept-foot"]');
      await maybeShot(member.page, "promise-foot-390");
      await member.page.click('[data-testid="promise-accept-foot"]');
      await member.page.waitForSelector('[data-testid="promise-accepted"]');
      expect(await member.page.textContent('[data-testid="promise-accepted"]')).toContain("13 Nov 2026");
      expect(await toasts(member.page)).toEqual([[words.own.promiseDone, "success"]]);
      await maybeShot(member.page, "promise-foot-accepted-390");
    } finally {
      await member.close();
    }
  });
});

/*
 * The platform's grouped list row itself (app/css/list-group.css), with the
 * case that used to collapse: a long name beside a long value. The shared
 * rule was `overflow-wrap: anywhere`, which let the title's column shrink to
 * one letter; it is `break-word` now, and this holds it there.
 */
const longRowEntry = `
  import { ListGroup, ListRow } from "@/components/ui/ListGroup";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <ListGroup label="People">
      <ListRow title="Oluwaseun Chukwuemeka-Olanrewaju Adebayo-Williams" sub="Chukwuemeka-Olanrewaju and Partners, Lekki Phase 1" value="12,500,000 a year" chevron onClick={() => {}} data-testid="long-row" />
      <ListRow title="Ada" value="1" chevron onClick={() => {}} />
    </ListGroup>,
  );
`;

describe.skipIf(!hasBrowser)("the shared list row with a long name beside a value", () => {
  it("wraps the name between its words at 390 and 320, and never into a column of letters", async () => {
    for (const width of [390, 320]) {
      const { page, close } = await mountInBrowser({ entry: longRowEntry, css: CSS, viewport: { width, height: 844 } });
      try {
        await page.waitForSelector('[data-testid="long-row"]');
        const title = await page.$eval('[data-testid="long-row"] .nf-list-row__title', (el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return { width: r.width, lines: Math.round(r.height / parseFloat(cs.lineHeight)), wrap: cs.overflowWrap };
        });
        expect(title.wrap).toBe("break-word");
        /* Room for its longest word, and no more lines than it has places to
           break: three spaces and two hyphens make five pieces. A column of
           letters would be forty lines. */
        expect(title.width).toBeGreaterThan(90);
        expect(title.lines).toBeLessThanOrEqual(5);
        expect(await collapsed(page)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        if (width === 390) await maybeShot(page, "list-row-long-name-390");
      } finally {
        await close();
      }
    }
  });
});
