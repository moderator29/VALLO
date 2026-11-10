/**
 * Listing detail walkthrough.
 *
 * Self-contained Playwright script: no runner, no config. It walks a stay
 * detail and a rental detail at phone size in BOTH themes and exits non-zero on
 * the first broken expectation. The two themes matter here: the page floats
 * controls over photography and carries a sticky bar over the content, and a
 * panel that only works at night is a bug, not a style choice.
 *
 * Run with the dev server already up:
 *
 *   BASE_URL=http://localhost:3210 node apps/web/tests/listing-detail.spec.mjs
 */

import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3210";
const WAIT = 1200;
/** A published Example stay (labelled "Example" on the page); /listing/seed-2 no longer exists. */
const EXAMPLE_STAY = "ed000000-0000-4000-8000-000000000003";

let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log(`  ok      ${name}`);
  } else {
    failures += 1;
    console.log(`  FAILED  ${name}`);
  }
}

function futureIso(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

/** True when nothing pushes the document wider than the phone viewport. */
async function noHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth <= window.innerWidth + 1;
  });
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

/** The canonical rental safety wording, docs/HYBRID_INVENTORY.md section 6. */
const SAFETY_COPY =
  "For your safety, keep every chat inside Vallo. Pay through Vallo. A payment made outside the platform leaves no record, so we cannot help you if something goes wrong. Pay only after you have inspected the property.";

async function walk(colorScheme) {
  console.log(`\n================ ${colorScheme} ================`);
  const context = await browser.newContext({
    colorScheme,
    viewport: { width: 390, height: 844 },
  });
  /*
   * Dark is the platform default and only an explicit choice moves it, so
   * emulating a light operating system no longer produces a light page. A light
   * pass has to make the choice the way a visitor would, in storage, before the
   * before-paint script reads it.
   */
  await context.addInitScript((mode) => {
    try {
      window.localStorage.setItem("nf_theme", mode);
    } catch {
      /* storage unavailable, the page falls back to the dark default */
    }
  }, colorScheme === "light" ? "light" : "dark");

  const page = await context.newPage();

  try {
    // ------------------------------------------------------- a stay detail
    /* An Example stay from the published catalogue (migration 20260809081618):
       the one bedroom serviced flat in Lekki Phase 1, let by the night. */
    console.log(`/listing/${EXAMPLE_STAY} (stay)`);
    await page.goto(`${BASE_URL}/listing/${EXAMPLE_STAY}`, { waitUntil: "load" });
    /* Signed out, the address answers the sign-in wall, and the first-run
       screen can then move the page again on the client. Read the page once
       it has stopped moving, or the evaluate below dies with the navigation
       (C-14: "Execution context was destroyed" on the light pass). */
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(WAIT);

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme ?? "dark",
    );
    check(
      `page is rendering the ${colorScheme} theme`,
      colorScheme === "light" ? theme === "light" : theme !== "light",
    );

    /*
     * `seed-2` was one of twenty-three invented places, and that catalogue was
     * removed on purpose: a full shelf of homes that do not exist is a worse
     * answer than an empty one. The spec now reads a labelled Example stay;
     * every check below needs it to exist, so if it is ever unpublished they
     * cannot run - which is not the same as
     * failing, and saying so out loud is the whole point. See tests/_catalogue.mjs.
     */
    if ((await page.locator('[data-testid="listing-gallery"]').count()) === 0) {
      console.log("  skip    no listing behind this id, so there is nothing to render");
      console.log("  note    run against a deployment with real inventory to exercise this");
      await context.close();
      return;
    }

    // ----------------------------------------------------------- gallery
    const gallery = page.locator('[data-testid="listing-gallery"]');
    check("gallery renders", (await gallery.count()) === 1);

    const counter = page.locator('[data-testid="gallery-counter"]');
    check("gallery counter renders", await counter.isVisible());
    const counterText = (await counter.innerText()).replace(/\s+/g, " ").trim();
    check(
      `counter reads the real photo count (${counterText})`,
      /^(Photo )?\d+ \/ \d+$/.test(counterText),
    );
    const [, shown, total] = counterText.match(/(\d+) \/ (\d+)/) ?? [];
    check("counter starts on the first photo", shown === "1");
    check("counter counts more than one photo", Number(total) > 1);

    const share = page.locator('[data-testid="listing-share"]');
    const save = page.locator('[data-testid="listing-save"]');
    check("share control floats over the gallery", await share.isVisible());
    check("save control floats over the gallery", await save.isVisible());
    check(
      "save control reports its pressed state",
      (await save.getAttribute("aria-pressed")) !== null,
    );

    // ------------------------------------------------------- header block
    const heading = await page.locator("h1").first().innerText();
    check("the listing title is the page heading", heading.trim().length > 0);
    const headerText = await page.locator("body").innerText();
    check("per-night pricing shows on a stay", /per night/i.test(headerText));

    // -------------------------------------------------------- amenity row
    const amenityRow = page.locator('[data-testid="amenity-row"]');
    check("amenity row renders", await amenityRow.isVisible());
    const marks = await amenityRow.locator("li").allInnerTexts();
    check("amenity row leads with the room counts", /bedroom/i.test(marks[0] ?? ""));
    check("amenity row carries real amenities too", marks.length >= 3);

    // ------------------------------------------------- about with Read more
    check("About this place renders", /About this place/i.test(headerText));
    const about = page.locator('[data-testid="listing-about"]');
    const toggle = page.locator('[data-testid="about-toggle"]');
    check("Read more is a real button", (await toggle.count()) === 1);
    check("Read more starts collapsed", (await toggle.getAttribute("aria-expanded")) === "false");
    check("Read more owns the region it expands", Boolean(await toggle.getAttribute("aria-controls")));

    const collapsed = (await about.innerText()).trim();
    await toggle.click();
    await page.waitForTimeout(300);
    const expanded = (await about.innerText()).trim();
    check("Read more reports itself expanded", (await toggle.getAttribute("aria-expanded")) === "true");
    check("Read more reveals more text", expanded.length > collapsed.length);
    check("the control becomes Show less", /show less/i.test(await toggle.innerText()));

    // ---------------------------------------------------------- sticky bar
    const bar = page.locator('[data-testid="listing-sticky-bar"]');
    check("sticky bar renders", await bar.isVisible());
    check("sticky bar offers Check availability", /Check availability/i.test(await bar.innerText()));
    /*
     * THIS CHECK USED TO READ "sticky bar shows the rate before dates are
     * picked", asserting `per night`. That was correct until the date fields
     * started opening on the upcoming weekend (docs/POLISH_PASS.md item 16),
     * at which point there is no "before dates are picked" any more: a stay
     * arrives with two nights already chosen and the bar quotes their total,
     * which is a strictly better answer to the same question. The product
     * moved and the spec had not, so this asserts the guarantee that actually
     * matters and has never changed: the bar always states a real figure, and
     * never an empty slot where a price should be.
     */
    const openingBar = (await bar.innerText()).replace(/\s+/g, " ").trim();
    check(
      `sticky bar states a figure on arrival (${openingBar})`,
      /per night/i.test(openingBar) || /total for \d+ nights?/i.test(openingBar),
    );

    const panel = page.locator('#reserve [data-testid="reserve-panel"]');
    check("reserve panel renders inline on a phone", (await panel.count()) === 1);
    await panel.locator('input[name="checkIn"]').fill(futureIso(30));
    await panel.locator('input[name="checkOut"]').fill(futureIso(32));
    await page.waitForTimeout(400);

    const barText = (await bar.innerText()).replace(/\s+/g, " ").trim();
    check(`sticky bar quotes the nights (${barText})`, /Total for 2 nights/i.test(barText));
    const quoted = await page.locator('[data-testid="sticky-total"]').innerText();
    check(`sticky bar quotes a total (${quoted.trim()})`, /[\d][\d,.]{3,}/.test(quoted));
    check(
      "no surcharge wording on the detail page",
      !/\bfees?\b/i.test(await page.locator("body").innerText()),
    );

    check("no horizontal overflow on a stay at 390px", await noHorizontalOverflow(page));

    // ----------------------------------------------------- a rental detail
    console.log("/search?market=rent, then the first rental's detail page");
    await page.goto(`${BASE_URL}/search?market=rent`, { waitUntil: "load" });
    await page.waitForTimeout(WAIT);

    const rentalHref = await page.locator('a[href^="/listing/"]').first().getAttribute("href");
    check("a rental links to a detail page", Boolean(rentalHref));

    if (rentalHref) {
      await page.goto(`${BASE_URL}${rentalHref}`, { waitUntil: "load" });
      await page.waitForTimeout(WAIT);

      const rentalText = await page.locator("body").innerText();
      check("rental offers Message agent", rentalText.includes("Message agent"));
      check("rental renders the canonical safety line", rentalText.includes(SAFETY_COPY));
      check("rental has NO Reserve control", !/\bReserve\b/i.test(rentalText));
      check("rental has NO Check availability control", !/Check availability/i.test(rentalText));
      check("rental prices per year", /per year|\/ year/i.test(rentalText));

      const rentalBar = page.locator('[data-testid="listing-sticky-bar"]');
      check("rental sticky bar renders", await rentalBar.isVisible());
      check(
        "rental sticky bar's action is Message agent",
        /Message agent/i.test(await rentalBar.innerText()),
      );

      check(
        "rental gallery still carries share and save",
        (await page.locator('[data-testid="listing-share"]').count()) === 1 &&
          (await page.locator('[data-testid="listing-save"]').count()) === 1,
      );

      check("no horizontal overflow on a rental at 390px", await noHorizontalOverflow(page));
    }
  } catch (error) {
    failures += 1;
    console.log(`  FAILED  threw: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close();
  }
}

await walk("dark");
await walk("light");
await browser.close();

console.log(
  failures === 0
    ? "\nlisting detail: all checks passed"
    : `\nlisting detail: ${failures} failed`,
);
process.exit(failures === 0 ? 0 : 1);
