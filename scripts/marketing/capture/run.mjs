/**
 * Captures the live screens in plan.mjs into docs/marketing/source/.
 *
 *   QA_MEMBER_EMAIL=... QA_MEMBER_PASSWORD=... \
 *     node scripts/marketing/capture/run.mjs [--only id,id] [--kind mobile|desktop] [--skip-existing]
 *
 * Mobile screens are 1320 x 2682 (the web view at 3x; the status bar is drawn
 * later, by screens.mjs, the way the native shell draws it). Desktop screens
 * are 2880 x 1800. A capture marked `full` also writes <id>-full.webp, the
 * whole page at 2x. Everything is WebP at quality 95, and every capture's
 * route, time and result goes into capture-report.json beside them.
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, VIEWPORTS, launch, contextFor, settle, signInWithin, hasSession, keepUnlocked, touchUnlock, isLocked } from "./session.mjs";
import { CAPTURES } from "./plan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const OUT = join(REPO, "docs", "marketing", "source");
mkdirSync(OUT, { recursive: true });
/* The guides' shots are served by the web app, at web size (plan.mjs, GUIDES). */
const GUIDE_OUT = join(REPO, "apps", "web", "public", "help", "shots");
mkdirSync(GUIDE_OUT, { recursive: true });
const outFor = (cap) => (cap.dest === "guides" ? GUIDE_OUT : OUT);

/*
 * NO CAPTURE SHOWS AN EMAIL ADDRESS (founder, 9 November 2026). Every
 * email-shaped string in the page's text and fields is blanked before the
 * shot; then, if the signed-in account's own address can still be found
 * anywhere on the page, the capture fails and nothing is written. The address
 * is read from the environment and never printed: the error names no address.
 */
const ACCOUNT_EMAIL = (process.env.QA_MEMBER_EMAIL ?? "").trim().toLowerCase();
async function blankEmails(page) {
  await page.evaluate(() => {
    const shape = () => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue && shape().test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(shape(), "Email hidden");
    }
    for (const field of document.querySelectorAll("input, textarea")) {
      if (field.value && shape().test(field.value)) field.value = field.value.replace(shape(), "Email hidden");
    }
  });
  if (!ACCOUNT_EMAIL) return;
  const still = await page.evaluate((needle) => {
    const fields = [...document.querySelectorAll("input, textarea")].map((f) => f.value).join(" ");
    return `${document.body?.innerText ?? ""} ${fields}`.toLowerCase().includes(needle);
  }, ACCOUNT_EMAIL);
  if (still) throw new Error("the signed-in account's email address is still on the page; nothing written");
}

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const skipExisting = args.includes("--skip-existing");
const kindOnly = args.includes("--kind") ? args[args.indexOf("--kind") + 1] : null;

async function run(page, steps, signed) {
  for (const step of steps) {
    if (step.goto) {
      await page.goto(`${BASE}${step.goto}`, { waitUntil: "load", timeout: 90_000 });
      await settle(page, 1800);
      if (signed) await touchUnlock(page);
    } else if (step.click) {
      await page.locator(step.click).first().click({ timeout: 12_000 });
      await page.waitForTimeout(step.pause ?? 900);
    } else if (step.clickIf) {
      const target = page.locator(step.clickIf).first();
      if (await target.count()) {
        await target.click({ timeout: 12_000 }).catch(() => {});
        await page.waitForTimeout(step.pause ?? 900);
      }
    } else if (step.reveal) {
      await page.locator(step.reveal).first().evaluate((el, offset) => {
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
      }, step.offset ?? 96, { timeout: 12_000 });
      await page.waitForTimeout(1800);
    } else if (step.type) {
      const field = page.locator(step.type).first();
      await field.click({ timeout: 12_000 });
      await field.pressSequentially(step.text, { delay: 18 });
      await page.waitForTimeout(400);
    } else if (step.press) {
      await page.keyboard.press(step.press);
      await page.waitForTimeout(600);
    } else if (step.waitStable) {
      /* Streaming text: wait until the element has not changed for `ms`. */
      const quiet = step.ms ?? 3000;
      const started = Date.now();
      let last = "";
      let since = Date.now();
      while (Date.now() - started < (step.max ?? 60_000)) {
        const now = await page.locator(step.waitStable).first().innerText().catch(() => "");
        if (now !== last) { last = now; since = Date.now(); }
        else if (Date.now() - since > quiet) break;
        await page.waitForTimeout(500);
      }
    } else if (step.blur) {
      /* Nothing keeps focus: no focus ring on the captured field. */
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.mouse.move(2, 2);
      await page.waitForTimeout(600);
    } else if (step.clear) {
      await page.evaluate((keys) => { for (const k of keys) { try { localStorage.removeItem(k); } catch {} } }, step.clear);
    } else if (step.top) {
      await page.evaluate(() => { window.scrollTo(0, 0); if (document.scrollingElement) document.scrollingElement.scrollTop = 0; });
      await page.waitForTimeout(900);
    } else if (step.into) {
      /* Scrolls whatever scrolls (the page or a panel) to bring the element to the top. */
      await page.locator(step.into).first().evaluate((el, offset) => {
        el.scrollIntoView({ block: "start" });
        let box = el.parentElement;
        while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement;
        if (box) box.scrollTop -= offset; else window.scrollBy(0, -offset);
      }, step.offset ?? 120, { timeout: 12_000 });
      await page.waitForTimeout(1200);
    } else if (step.wait) {
      await page.waitForTimeout(step.wait);
    }
  }
}

/* Walk the page so lazily loaded images arrive before a full-page shot. */
async function loadWholePage(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
}

const reportFile = join(OUT, "capture-report.json");
/* Written after every capture, merged with what is on disk, so a stopped
   run or two runs side by side (--kind) keep every result. */
function record(id, entry) {
  const report = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, "utf8")) : {};
  report[id] = entry;
  writeFileSync(reportFile, JSON.stringify(Object.fromEntries(Object.entries(report).sort()), null, 2) + "\n");
}
const browser = await launch();
const haveCredentials = Boolean(process.env.QA_MEMBER_EMAIL && process.env.QA_MEMBER_PASSWORD);
if (!haveCredentials) console.log("No QA credentials: public screens only.");

/* One long-lived signed-in context per device kind (see signInWithin). */
const signedIn = {};
async function signedInContext(kind) {
  if (!signedIn[kind]) {
    const ctx = await browser.newContext({ ...VIEWPORTS[kind], reducedMotion: "reduce", locale: "en-NG", timezoneId: "Africa/Lagos" });
    await ctx.addCookies([{ name: "vallo_first_run", value: "seen", url: BASE }]);
    await keepUnlocked(ctx);
    await signInWithin(ctx, { fresh: true });
    signedIn[kind] = ctx;
  }
  return signedIn[kind];
}

async function captureOnce(cap, ctx) {
  const theme = cap.theme ?? "dark";
  await ctx.addCookies([{ name: "nf_theme", value: theme, url: BASE }]);
  await ctx.clearCookies({ name: "nf_locale" });
  if (cap.locale) await ctx.addCookies([{ name: "nf_locale", value: cap.locale, url: BASE }]);
  const page = await ctx.newPage();
  await page.addInitScript((t) => { try { localStorage.setItem("nf_theme", t); } catch {} }, theme);
  const signed = cap.auth !== false;
  try {
    await run(page, cap.steps, signed);
    const path = new URL(page.url()).pathname;
    if (signed && (path.startsWith("/sign-in") || !(await hasSession(ctx)))) return { page, signedOut: true };
    if (signed && (await isLocked(page))) return { page, locked: true };
    return { page };
  } catch (error) {
    return { page, error };
  }
}

for (const cap of CAPTURES) {
  if (only && !only.includes(cap.id)) continue;
  const file = join(outFor(cap), `${cap.id}.webp`);
  if (skipExisting && existsSync(file)) continue;
  if (kindOnly && (cap.kind ?? "mobile") !== kindOnly) continue;
  const needsAuth = cap.auth !== false;
  if (needsAuth && !haveCredentials) { console.log(`skip  ${cap.id} (needs the QA account)`); continue; }
  const kind = cap.kind ?? "mobile";
  let result;
  let ctx;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    ctx = needsAuth ? await signedInContext(kind) : await contextFor(browser, { kind, theme: cap.theme ?? "dark", locale: cap.locale });
    result = await captureOnce(cap, ctx);
    if (!result.signedOut && !result.locked) break;
    console.log(`      ${cap.id}: ${result.locked ? "the passcode lock came up" : "the session had ended"}; signing in again`);
    await result.page.close();
    await signInWithin(ctx, { fresh: true });
  }
  const { page, error, signedOut, locked } = result;
  try {
    if (error) throw error;
    if (signedOut) throw new Error("signed out");
    if (locked) throw new Error("passcode lock");
    /* A capture must be the page it names: no error page, nothing blank,
       and a light twin that really is light (some pages keep one theme). */
    const bad = await page.evaluate(() => {
      const text = document.body?.innerText ?? "";
      return ["upstream request failed", "Application error", "Something went wrong", "This page could not be found"].find((t) => text.includes(t)) ?? null;
    });
    if (bad) throw new Error(`the page shows "${bad}"`);
    /* A visible image that failed to load (a broken-image box) fails the capture. */
    const broken = await page.evaluate(() => [...document.images].filter((im) => {
      const r = im.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && im.complete && im.naturalWidth === 0;
    }).map((im) => im.currentSrc || im.src).slice(0, 3));
    if (broken.length) throw new Error(`broken image: ${broken.join(", ")}`);
    await blankEmails(page);
    const shot = await page.screenshot({ type: "png" });
    const webp = await sharp(shot).webp({ quality: 95, effort: 6 }).toBuffer();
    if (webp.length < 50_000) throw new Error(`only ${Math.round(webp.length / 1000)} KB: a blank or broken page`);
    if (cap.id.endsWith("-lt")) {
      const darkFile = join(outFor(cap), `${cap.id.slice(0, -3)}.webp`);
      if (existsSync(darkFile)) {
        const [a, b] = await Promise.all([webp, readFileSync(darkFile)].map((buf) => sharp(buf).resize(64, 64, { fit: "fill" }).greyscale().raw().toBuffer()));
        const mean = (buf) => buf.reduce((sum, v) => sum + v, 0) / buf.length;
        if (Math.abs(mean(a) - mean(b)) < 12) throw new Error("the light twin is as dark as its dark capture: this page keeps one theme");
      }
    }
    /* A guide shot is served on a help page: brought to 2x of the phone
       (880 px) or the desktop width, and a lighter quality. */
    writeFileSync(
      file,
      cap.dest === "guides"
        ? await sharp(webp).resize({ width: kind === "desktop" ? 1440 : 880 }).webp({ quality: 85, effort: 6 }).toBuffer()
        : webp,
    );
    if (cap.full) {
      await loadWholePage(page);
      /* Shot at the device scale, then brought to 2x (880 px wide) for the
         video, which never shows a phone screen wider than that. */
      const whole = await page.screenshot({ type: "png", fullPage: true });
      await sharp(whole, { limitInputPixels: false }).resize({ width: kind === "desktop" ? 2880 : 880 }).webp({ quality: 92, effort: 6 }).toFile(join(OUT, `${cap.id}-full.webp`));
    }
    record(cap.id, { url: page.url().replace(BASE, ""), at: new Date().toISOString(), kind, theme: cap.theme ?? "dark", signedIn: needsAuth, ...(cap.locale ? { locale: cap.locale } : {}), ...(cap.usedBy ? { usedBy: cap.usedBy, dest: "apps/web/public/help/shots" } : {}) });
    console.log(`ok    ${cap.id.padEnd(22)} ${page.url().replace(BASE, "")}`);
  } catch (err) {
    record(cap.id, { failed: String(err.message ?? err).split("\n")[0], at: new Date().toISOString() });
    console.log(`FAIL  ${cap.id.padEnd(22)} ${String(err.message ?? err).split("\n")[0]}`);
  }
  await page.close().catch(() => {});
  if (!needsAuth) await ctx.close();
}
await browser.close();
