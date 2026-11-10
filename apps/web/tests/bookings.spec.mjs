/**
 * Bookings loop walkthrough.
 *
 * Self-contained Playwright script: no runner, no config. It walks the three
 * booking surfaces at phone size in dark mode. Run with the dev server up:
 *
 *   BASE_URL=http://localhost:3210 node apps/web/tests/bookings.spec.mjs
 *
 * WHAT CHANGED. Since 23 September `/bookings`, `/listing/<id>` and `/search`
 * answer a signed-out visitor with the sign-in wall (asserted first). The
 * surfaces are then read where they can be:
 *
 *   the plans deck   `/preview/f3/bookings`, the real TripSpine and
 *                    TenancyCard with fixture trips. The real page's old
 *                    Upcoming / Cancelled tabs are gone: `/bookings` is now
 *                    "Plans" with an All / Property / Stays filter as links
 *                    (`app/(app)/bookings/page.tsx`, FilterLinks), read on the
 *                    real route signed in (SKIP without QA credentials).
 *   the stay panel   `/preview/session-b/sweep-home/listing-parts`, the real
 *                    ReservePanel ("Reserve panel (stays)").
 *   the rental panel the same harness, the real RentalPanel ("Rental panel").
 */

import { chromium } from "playwright-core";
import { expectSignInWall, openPreview, qaContext, signInAsQa } from "./_gate.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3210";
const WAIT = 1200;

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
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const VIEW = { colorScheme: "dark", viewport: { width: 390, height: 844 } };
const context = await browser.newContext(VIEW);
const page = await context.newPage();

/** The harness section headed by exactly `title` (the innermost one). */
const sectionTitled = (title) =>
  page
    .locator("section")
    .filter({ has: page.locator("h2", { hasText: new RegExp(`^\\s*${title.replace(/[()]/g, "\\$&")}\\s*$`) }) })
    .last();

try {
  // ------------------------------------------------------------ signed out
  console.log("signed out");
  for (const path of ["/bookings", "/listing/seed-2", "/search?market=rent"]) {
    await expectSignInWall(check, path);
  }

  // -------------------------------------------- the plans deck (preview)
  console.log("\n/preview/f3/bookings (the /bookings deck)");
  if (await openPreview(page, "/preview/f3/bookings", check, { wait: WAIT })) {
    const bodyText = await page.locator("body").innerText();
    check("at least one trip card renders", /Confirmed|Awaiting confirmation/.test(bodyText));
    check("a tenancy card renders with its move-in total", /Move-in total/.test(bodyText));
  }

  // ------------------------------------------- the stay reserve panel
  console.log("\n/preview/session-b/sweep-home/listing-parts (stay reserve panel)");
  if (await openPreview(page, "/preview/session-b/sweep-home/listing-parts", check, { wait: WAIT })) {
    const panel = sectionTitled("Reserve panel (stays)").locator('[data-testid="reserve-panel"]');
    check("reserve panel renders", (await panel.count()) === 1);
    check("per-night price shows", (await panel.innerText()).includes("/ night"));

    await panel.locator('input[name="checkIn"]').fill(futureIso(30));
    await panel.locator('input[name="checkOut"]').fill(futureIso(32));
    await page.waitForTimeout(400);

    /* The panel leads with the total and keeps the breakdown one tap away, so
       the nightly line only exists once the breakdown is open. */
    const closedText = await panel.innerText();
    check("the total is what the panel leads with", /total/i.test(closedText));
    check("the per-night view is offered", closedText.includes("See per night"));

    await panel.getByText("See per night").click();
    await page.waitForTimeout(400);
    const panelText = await panel.innerText();
    check("price breakdown shows nights multiplied", /×\s*2 nights/.test(panelText));
    check("price breakdown shows a total", panelText.includes("Total"));
    check("no fee wording anywhere in the panel", !/fees?\b/i.test(panelText));
    check(
      "reserve button present",
      (await panel.getByRole("button", { name: "Reserve" }).count()) === 1,
    );

    // ------------------------------------------------ the rental panel
    console.log("\nrental panel (same harness)");
    const rental = sectionTitled("Rental panel");
    check("the rental panel renders", (await rental.count()) === 1);
    const rentalText = await rental.innerText();
    check("Message agent CTA renders", rentalText.includes("Message agent"));
    check(
      "safety disclaimer renders",
      rentalText.includes(
        "For your safety, keep every chat inside Vallo. Pay through Vallo. A payment made outside the platform leaves no record, so we cannot help you if something goes wrong. Pay only after you have inspected the property.",
      ),
    );
    check("no Reserve control on a rental", !rentalText.includes("Reserve"));
    check("per-year price shows", rentalText.includes("year"));
  }

  // --------------------------------------- the real /bookings, signed in
  console.log("\n/bookings (signed in as the QA member)");
  const state = await signInAsQa(browser);
  if (state) {
    const qa = await qaContext(browser, state, VIEW);
    const qp = await qa.newPage();
    await qp.goto(`${BASE_URL}/bookings`, { waitUntil: "load" });
    await qp.waitForTimeout(WAIT);
    const filter = qp.getByTestId("plans-filter");
    check("the All / Property / Stays filter renders", (await filter.count()) === 1);
    check(
      "each side is a link, so the address is the state",
      (await filter.locator('a[href^="/bookings?side="]').count()) === 3,
    );
    await qp.goto(`${BASE_URL}/bookings?side=stays`, { waitUntil: "load" });
    await qp.waitForTimeout(WAIT);
    check("how-booking-works strip renders on the Stays side", /how booking works/i.test(await qp.locator("body").innerText()));
    await qa.close();
  }
} finally {
  await browser.close();
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
