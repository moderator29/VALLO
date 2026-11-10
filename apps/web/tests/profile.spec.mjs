/**
 * Profile and settings golden-path checks.
 *
 * Run with the dev or production server already listening:
 *   node apps/web/tests/profile.spec.mjs
 *
 * Covers the account loop at phone size (390x844, dark):
 *   0. Signed out (since 23 September), /profile and every settings screen
 *      answer the sign-in wall. The signed-out "on-device identity card" this
 *      spec used to read no longer exists for a stranger.
 *   1. The profile hero opens its details sheet, closes on Escape, and both
 *      tabs render: read in the preview harness (`/preview/session-b/profile`,
 *      the real AccountHero with a fixture member).
 *   2. Every preference group renders. Settings is a hub now, and the groups
 *      live on its sub-pages (Appearance and Language on /settings/appearance,
 *      Notifications on /settings/notifications, Privacy, Security and Your
 *      data on /settings/privacy, Account and Search on /settings/account,
 *      About on /settings/help); each is read through the harness's matching
 *      view of `/preview/session-b/sweep-settings`.
 *   3. Flipping a notification switch survives a reload. That writes the QA
 *      member's own profiles.settings, so it runs on the real
 *      /settings/notifications signed in, puts the switch back afterwards, and
 *      is reported as SKIP without QA_MEMBER_EMAIL / QA_MEMBER_PASSWORD.
 *   4. The delete-account drawer takes two steps and refuses to arm its button
 *      until the exact confirmation phrase is typed (harness `?v=account`, the
 *      real panel). The button is never pressed: this script must not delete
 *      anything.
 */

import { chromium } from "playwright-core";
import { expectSignInWall, openPreview, qaContext, signInAsQa } from "./_gate.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3210";
const EXECUTABLE = "/opt/pw-browsers/chromium";
const CONFIRM_PHRASE = "DELETE MY ACCOUNT";

const failures = [];
function check(label, condition) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}`);
  }
}

const OPTIONS = {
  colorScheme: "dark",
  viewport: { width: 390, height: 844 },
  /* Groups arrive on a `Reveal`, held at opacity 0 until scrolled into view.
     Playwright treats an element mid-transition as unstable, so a control that
     is genuinely on the page reads as absent. The platform honours
     prefers-reduced-motion for real; these specs test behaviour, not entrances. */
  reducedMotion: "reduce",
};
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const context = await browser.newContext(OPTIONS);
const page = await context.newPage();
const HARNESS = "/preview/session-b/sweep-settings";
const opened = (path) => openPreview(page, path, check, { base: BASE_URL, wait: 1200 });

try {
  /* ------------------------------------------------------ 0. signed out */
  console.log("signed out");
  for (const path of ["/profile", "/settings", "/settings/notifications", "/settings/account", "/settings/privacy"]) {
    await expectSignInWall(check, path, BASE_URL);
  }

  /* ------------------------------------------------- 1. the profile hero */
  console.log("profile page (preview harness)");
  if (await opened("/preview/session-b/profile")) {
    const hero = page.locator('[data-testid="account-hero"]');
    check("the account hero renders", await hero.isVisible());
    check("the cover band is present", (await page.locator(".nf-social-cover").count()) > 0);
    check(
      "the avatar opens a picker",
      await page.locator('[data-testid="account-avatar-button"]').isVisible(),
    );
    check(
      "both tabs render",
      (await page.locator('[data-testid="account-tab-account"]').count()) > 0 &&
        (await page.locator('[data-testid="account-tab-posts"]').count()) > 0,
    );
    check(
      "the account tab lists what you have here",
      await page.locator('[data-testid="row-bookings"]').isVisible(),
    );

    // Your details open in a sheet rather than expanding the page under your
    // thumb. Escape must close it: this is the one modal on the account.
    await page.locator('[data-testid="row-details"]').click();
    await page.waitForTimeout(500);
    const sheet = page.locator('[role="dialog"]');
    check("your details open in a sheet", await sheet.isVisible());
    check("the sheet carries a name field", await page.getByLabel(/First name/).first().isVisible());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check("escape closes the sheet", (await sheet.count()) === 0);

    // The Posts tab is the public page's own panel.
    await page.locator('[data-testid="account-tab-posts"]').click();
    await page.waitForTimeout(500);
    check("the posts tab renders its panel", await page.locator("#account-panel-posts").isVisible());
    await page.locator('[data-testid="account-tab-account"]').click();
    await page.waitForTimeout(300);

    // Visible only: the desktop rail also carries this href and is hidden at 390px.
    check(
      "the account reaches settings",
      (await page.locator('a[href="/settings"]:visible, [data-testid="account-settings-button"]:visible').count()) > 0,
    );
  }

  /* ---------------------------------------------- 2. the settings groups */
  console.log("settings groups (preview harness)");
  const GROUPS = [
    ["appearance", ["Appearance"]],
    ["notifications", ["Notifications"]],
    ["privacy", ["Privacy", "Security", "Your data"]],
    ["account", ["Account", "Search"]],
    ["help", ["About"]],
  ];
  for (const [view, groups] of GROUPS) {
    if (!(await opened(`${HARNESS}?v=${view}`))) continue;
    /* Language is no longer a group of its own: it is the "App language" row
       inside Appearance, on the real page as in the harness. */
    if (view === "appearance") {
      check(
        "Language renders, as the App language row inside Appearance",
        (await page.locator('section[aria-label="Appearance"] [data-testid="setting-language"], [data-testid="setting-language"]').count()) > 0,
      );
    }
    for (const group of groups) {
      check(
        `${group} group renders (/settings/${view})`,
        (await page.locator(`section[aria-label="${group}"]`).count()) > 0 ||
          (await page.getByText(group, { exact: true }).count()) > 0,
      );
    }
  }

  /* --------------------------------------- 3. a toggle survives a reload */
  console.log("toggle persistence (signed in as the QA member)");
  const state = await signInAsQa(browser, { base: BASE_URL });
  if (state) {
    const qa = await qaContext(browser, state, OPTIONS);
    const qp = await qa.newPage();
    await qp.goto(`${BASE_URL}/settings/notifications`, { waitUntil: "load" });
    await qp.waitForTimeout(1200);
    const notifications = qp.locator('section[aria-label="Notifications"]');
    const firstSwitch = notifications.getByRole("switch").first();
    check("notifications group has switches", await firstSwitch.isVisible());
    const before = await firstSwitch.getAttribute("aria-checked");
    await firstSwitch.click();
    await qp.waitForTimeout(600);
    const after = await firstSwitch.getAttribute("aria-checked");
    check("switch flips on tap", before !== after);
    await qp.reload({ waitUntil: "load" });
    await qp.waitForTimeout(1200);
    const reloaded = await qp
      .locator('section[aria-label="Notifications"]')
      .getByRole("switch")
      .first()
      .getAttribute("aria-checked");
    check("switch keeps its new value across a reload", reloaded === after);
    // Put it back so a rerun starts from where it found things.
    await qp.locator('section[aria-label="Notifications"]').getByRole("switch").first().click();
    await qp.waitForTimeout(400);
    await qa.close();
  }

  /* ------------------------------------------ 4. the delete-account gate */
  console.log("delete account drawer (preview harness)");
  if (await opened(`${HARNESS}?v=account`)) {
    await page.locator('[data-testid="delete-open"]').click();
    await page.waitForTimeout(500);

    const drawer = page.locator('[data-testid="delete-drawer"]');
    check("drawer opens full page", await drawer.isVisible());
    check(
      "drawer covers the viewport",
      await drawer.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.width >= window.innerWidth - 1 && box.height >= window.innerHeight - 1;
      }),
    );
    check("first step explains before it asks", await page.locator('[data-testid="delete-continue"]').isVisible());

    await page.locator('[data-testid="delete-continue"]').click();
    await page.waitForTimeout(400);

    const reasonContinue = page.locator('[data-testid="delete-reason-continue"]');
    check("second step asks why they are leaving", await page.locator('[data-testid="delete-reason-step"]').isVisible());
    check("continue is disabled until a reason is chosen", await reasonContinue.isDisabled());
    await page.locator('[data-testid="delete-reason-prefer_not_to_say"]').click();
    await page.waitForTimeout(150);
    check("choosing a reason arms continue", await reasonContinue.isEnabled());
    await reasonContinue.click();
    await page.waitForTimeout(400);

    const phrase = page.locator('[data-testid="delete-phrase"]');
    const confirm = page.locator('[data-testid="delete-confirm"]');
    check("third step asks for the phrase", await phrase.isVisible());
    check("confirm button starts disabled", await confirm.isDisabled());

    await phrase.fill("delete my account");
    await page.waitForTimeout(250);
    check("lower case does not arm the button", await confirm.isDisabled());

    await phrase.fill("DELETE MY ACCOUNTS");
    await page.waitForTimeout(250);
    check("a near miss does not arm the button", await confirm.isDisabled());

    await phrase.fill(CONFIRM_PHRASE);
    await page.waitForTimeout(250);
    check("the exact phrase arms the button", await confirm.isEnabled());

    // Nothing is deleted here: close the drawer and leave the account alone.
    await page.getByRole("button", { name: "Keep my account" }).first().click();
    await page.waitForTimeout(400);
    check("keeping the account closes the drawer", (await drawer.count()) === 0);
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed:`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}

console.log("\nall profile and settings checks passed");
