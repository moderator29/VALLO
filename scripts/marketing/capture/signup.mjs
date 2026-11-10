/**
 * THE SIGN-UP FLOW, as a new member meets it.
 *
 *   SIGNUP_EMAIL=... SIGNUP_PASSWORD=... node scripts/marketing/capture/signup.mjs
 *   SIGNUP_EMAIL=... SIGNUP_PASSWORD=... node scripts/marketing/capture/signup.mjs --dry
 *
 * Walks /sign-up to /sign-up/email, fills the form the way a person does
 * (typed, not set: the form keeps its values in React state), and captures
 * every stage on the phone and on the desktop for the first of the three
 * short films.
 *
 * --dry stops before "Create account", so the flow can be rehearsed and the
 * shots checked without making an account.
 *
 * THE NAME ON THE FORM is the product's own placeholder pair, Ada Okafor, and
 * THE ADDRESS DRAWN ON SCREEN is always ada.okafor@example.com, whatever was
 * typed, so neither a real person's name nor a real mailbox is ever in an
 * asset (DESIGN.md section 2). The password is typed into a password field
 * and never captured in plain text; neither credential is written to disk.
 *
 * Out: docs/marketing/source/su-*.webp (phone) and d-su-*.webp (desktop).
 */
import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { BASE, VIEWPORTS, launch } from "./session.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/marketing/source");
const DRY = process.argv.includes("--dry");
/* --only mobile | desktop, to redo one cut without redoing the other. */
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const EMAIL = process.env.SIGNUP_EMAIL;
const PASSWORD = process.env.SIGNUP_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("set SIGNUP_EMAIL and SIGNUP_PASSWORD");
  process.exit(1);
}
const NAME = { first: "Ada", surname: "Okafor" };
/*
 * THE ADDRESS ON SCREEN IS NEVER A REAL ONE (DESIGN.md section 2: no email
 * address, phone number or real person's name in any asset, ever). The real
 * address is still typed, so React's state, the submit and the account are
 * all real; just before a screenshot the drawn text is swapped for the
 * product's own example and put back afterwards. Setting an input's value
 * from the DOM does not reach React's state, so the form still sends what
 * was typed, and the verify screen's sentence is a text node.
 */
const DISPLAY_EMAIL = "ada.okafor@example.com";

async function withExampleEmail(page, real, take) {
  await page.evaluate(([was, shown]) => {
    window.__restore = [];
    for (const el of document.querySelectorAll("input")) {
      if (el.value === was) {
        window.__restore.push([el, el.value]);
        el.value = shown;
      }
    }
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (n.nodeValue.includes(was)) {
        window.__restore.push([n, n.nodeValue]);
        n.nodeValue = n.nodeValue.split(was).join(shown);
      }
    }
    return window.__restore.length;
  }, [real, DISPLAY_EMAIL]);
  await page.waitForTimeout(200);
  await take();
  await page.evaluate(() => {
    for (const [node, value] of window.__restore ?? []) {
      if (node.nodeType === 3) node.nodeValue = value;
      else node.value = value;
    }
    window.__restore = [];
  });
}

mkdirSync(OUT, { recursive: true });
const browser = await launch();

/** A field is typed, key by key: a programmatic fill leaves React's state empty. */
async function typeInto(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 60_000 });
  const field = page.locator(selector);
  await field.click();
  await field.pressSequentially(value, { delay: 28 });
}

async function shot(page, id, kind) {
  const file = join(OUT, `${kind === "desktop" ? "d-" : ""}${id}.webp`);
  const png = await page.screenshot({ type: "png" });
  await sharp(png).webp({ quality: 92 }).toFile(file);
  console.log(`  ${file.split("/").pop()}`);
}

for (const kind of (ONLY ? [ONLY] : ["mobile", "desktop"])) {
  console.log(kind);
  const ctx = await browser.newContext({ ...VIEWPORTS[kind], reducedMotion: "reduce", locale: "en-NG", timezoneId: "Africa/Lagos" });
  await ctx.addCookies([{ name: "vallo_first_run", value: "seen", url: BASE }]);
  const page = await ctx.newPage();

  /* 1. the choice */
  await page.goto(`${BASE}/sign-up`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, "su-choice", kind);

  /* 2. the empty form */
  await page.goto(`${BASE}/sign-up/email`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, "su-form", kind);

  /* 3. the name, then the whole form filled */
  await typeInto(page, "#firstName", NAME.first);
  await typeInto(page, "#surname", NAME.surname);
  await page.waitForTimeout(400);
  await shot(page, "su-name", kind);

  await typeInto(page, "#email", EMAIL);
  await typeInto(page, "#password", PASSWORD);
  await page.waitForTimeout(400);
  await withExampleEmail(page, EMAIL, () => shot(page, "su-filled", kind));

  /* 4. the two confirmations. The real input is hidden behind the product's
     own control, so the box is ticked the way a member ticks it: on the words
     beside it. A programmatic check leaves the drawn box empty. */
  for (const name of ["ageConfirmed", "acceptTerms"]) {
    /* the drawn box, at the left of the row: the terms row carries links, so
       clicking its words opens a policy instead of ticking it */
    const box = page.locator(`input[name="${name}"]`).first();
    const row = page.locator(`label:has(input[name="${name}"])`).first();
    /* The drawn box is the row's FIRST element child, and on the desktop it
       is not 12px from the row's corner: the row is wider, its padding is
       different, and a corner click landed on the words (and on the terms
       row, on a policy link). Click the drawn box where it actually is. */
    const drawn = row.locator("> *").first();
    const at = (await drawn.count()) ? await drawn.boundingBox().catch(() => null) : null;
    if (at) await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    else {
      const target = (await row.count()) ? row : box;
      await target.click({ position: { x: 12, y: 12 }, force: true }).catch(() => {});
    }
    await page.waitForTimeout(350);
    if (!(await box.isChecked().catch(() => false))) {
      await box.check({ force: true }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  const ticked = await page.evaluate(() =>
    [...document.querySelectorAll('input[name="ageConfirmed"], input[name="acceptTerms"]')].filter((i) => i.checked).length);
  if (ticked < 2) console.log(`  warning: ${ticked} of 2 boxes ticked`);
  await page.waitForTimeout(500);
  await withExampleEmail(page, EMAIL, () => shot(page, "su-agreed", kind));

  /* 5. the account, and what the member is told next */
  if (!DRY) {
    /* THE BUTTON IS BELOW THE FOLD ON THE PHONE, under a sticky bar, and a
       click sent before React has enabled it is swallowed: the first live run
       left the phone cut sitting on the filled form while the desktop cut
       reached the verify screen. So it is scrolled to, waited for, clicked,
       and the submit is confirmed by the page leaving /sign-up/email. */
    const submit = page.locator("button[type=submit]:has-text('Create account')").last();
    await submit.scrollIntoViewIfNeeded().catch(() => {});
    await submit.waitFor({ state: "visible", timeout: 30_000 });
    for (let i = 0; i < 30 && (await submit.isDisabled().catch(() => false)); i += 1) await page.waitForTimeout(500);
    await page.waitForTimeout(600);
    await submit.click();
    for (let i = 0; i < 40; i += 1) {
      await page.waitForTimeout(1000);
      if (!(await page.evaluate(() => location.pathname)).endsWith("/sign-up/email")) break;
    }
    await page.waitForLoadState("networkidle", { timeout: 40_000 }).catch(() => {});
    await page.waitForTimeout(3000);
    if ((await page.evaluate(() => location.pathname)).endsWith("/sign-up/email")) {
      const said = await page.evaluate(() => [...document.querySelectorAll('[role=alert], .nf-field-error, [data-error]')].map((n) => n.textContent.trim()).filter(Boolean).join(" | "));
      console.log(`  warning: still on the form${said ? `: ${said}` : ""}`);
    }
    await withExampleEmail(page, EMAIL, () => shot(page, "su-sent", kind));
    console.log(`  landed on ${await page.evaluate(() => location.pathname)}`);
  }
  await ctx.close();
}

await browser.close();
console.log(DRY ? "rehearsal only: no account made" : "done");
