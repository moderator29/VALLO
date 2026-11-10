/**
 * One signed-in browser for every capture. Credentials come from the
 * environment (QA_MEMBER_EMAIL, QA_MEMBER_PASSWORD) and live only in memory.
 *
 * Behind the build environment's egress proxy Chromium is pointed at
 * HTTPS_PROXY, and the proxy's certificate authority must be in Chromium's
 * NSS store (~/.pki/nssdb); on a normal machine neither applies.
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

export const BASE = process.env.BASE_URL ?? "https://www.vallospaces.com";
export const NATIVE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 VALLO-NATIVE";
export const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

/* The 6.9" iPhone's web view (440 x 956 points, less the 62-point status bar
   the native shell draws above it), and a 1440 x 900 laptop. */
export const VIEWPORTS = {
  mobile: { viewport: { width: 440, height: 894 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: NATIVE_UA },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false, userAgent: DESKTOP_UA },
};

export async function launch() {
  const executablePath = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
  /* The browser's own language sets how native fields print: without it a
     date input reads 10/16/2026 even in an en-NG context. Nigerians read
     16/10/2026, so the whole browser runs in British English. */
  return chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    args: ["--lang=en-GB"],
    env: { ...process.env, LANG: "en_GB.UTF-8", LANGUAGE: "en_GB" },
  });
}

/* The sign-in form keeps its values in React state, which only follows real
   key presses: a programmatic fill leaves the state empty and the submit
   does nothing. So the fields are typed, and the form is sent with Enter. */
async function typeInto(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 90_000 });
  const field = page.locator(selector);
  await field.click();
  await field.press("Control+A");
  await field.press("Backspace");
  await field.pressSequentially(value, { delay: 25 });
}

/** Signs in and returns the storage state, or null without credentials. */
export async function signIn(browser, { email = process.env.QA_MEMBER_EMAIL, password = process.env.QA_MEMBER_PASSWORD } = {}) {
  if (!email || !password) return null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    /* Reduced motion also skips the opening animation (November upgrade), which
       otherwise sits over the form for several seconds and swallows its taps. */
    const ctx = await browser.newContext({ ...VIEWPORTS.mobile, reducedMotion: "reduce" });
    /* The cookie notice (added in the November upgrade) sits over the sign-in form and
       swallows its taps. "Only necessary" is what a member who declines chooses: it
       writes vallo_consent=1.00, and so does this. */
    await ctx.addCookies([{ name: "vallo_first_run", value: "seen", url: BASE }, { name: "vallo_consent", value: "1.00", url: BASE }]);
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/sign-in`, { waitUntil: "load", timeout: 90_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForSelector("#email, #auth-email", { timeout: 90_000 });
      await page.waitForTimeout(3000);
      if (await page.locator("#auth-email").count()) {
        await typeInto(page, "#auth-email", email);
        await page.click("button:has-text('Continue')");
      } else {
        await typeInto(page, "#email", email);
      }
      await typeInto(page, "#password", password);
      await page.waitForTimeout(800);
      await page.locator("#password").press("Enter");
      let ok = false;
      for (let i = 0; i < 90 && !ok; i += 1) {
        await page.waitForTimeout(1000);
        ok = !new URL(page.url()).pathname.startsWith("/sign-in");
      }
      if (ok) {
        const state = await ctx.storageState();
        await ctx.close();
        return state;
      }
      console.error(`sign-in attempt ${attempt} stayed on ${page.url()}`);
    } catch (error) {
      console.error(`sign-in attempt ${attempt}: ${error.message.split("\n")[0]}`);
    }
    await ctx.close();
  }
  throw new Error("could not sign in");
}

/** Is this context holding a Supabase session cookie? */
export async function hasSession(ctx) {
  return (await ctx.cookies(BASE)).some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}

/**
 * Signs in inside an existing context, so every later page in it shares one
 * live session. Sharing a stored session between many contexts does not
 * work: the product rotates the session's refresh token, and a context that
 * presents a token another context already spent is signed out (and so are
 * the others).
 */
export async function signInWithin(ctx, { email = process.env.QA_MEMBER_EMAIL, password = process.env.QA_MEMBER_PASSWORD, fresh = false } = {}) {
  if (!email || !password) throw new Error("QA_MEMBER_EMAIL and QA_MEMBER_PASSWORD are needed");
  /* A fresh sign-in (the password typed now) is what reopens a passcode lock. */
  if (fresh) await ctx.clearCookies({ name: /^sb-/ });
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/sign-in`, { waitUntil: "load", timeout: 90_000 });
      await page.waitForTimeout(2500);
      if (!new URL(page.url()).pathname.startsWith("/sign-in")) { await page.close(); return; }
      await page.waitForSelector("#email, #auth-email", { timeout: 90_000 });
      if (await page.locator("#auth-email").count()) {
        await typeInto(page, "#auth-email", email);
        await page.click("button:has-text('Continue')");
      } else {
        await typeInto(page, "#email", email);
      }
      await typeInto(page, "#password", password);
      await page.waitForTimeout(800);
      await page.locator("#password").press("Enter");
      for (let i = 0; i < 90; i += 1) {
        await page.waitForTimeout(1000);
        if (!new URL(page.url()).pathname.startsWith("/sign-in")) { await page.close(); return; }
      }
      console.error(`sign-in attempt ${attempt} stayed on ${page.url()}`);
    } catch (error) {
      console.error(`sign-in attempt ${attempt}: ${error.message.split("\n")[0]}`);
    }
    await page.close().catch(() => {});
  }
  throw new Error("could not sign in");
}

/*
 * The app's passcode lock (docs/PASSCODE.md). A tab without the "unlocked"
 * mark in its sessionStorage locks itself on arrival, and a tab that locks
 * itself ends the unlock for every tab. Every capture opens a new tab, so a
 * signed-in context marks each tab before the page's own scripts run, and
 * the unlock is slid with the app's own heartbeat after each page load, as
 * the app does while its member is active. A sign-in in the last five
 * minutes unlocks by itself and mints the sliding unlock.
 */
export async function keepUnlocked(ctx) {
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem("vallo.passcode.tab", "1"); } catch {}
  });
}

/** The heartbeat: "unlocked", "locked", "signed-out" or "error". */
export async function touchUnlock(page) {
  return page
    .evaluate(() =>
      fetch("/api/passcode/touch", { method: "POST", credentials: "same-origin", cache: "no-store" })
        .then((r) => r.json())
        .then((b) => b.state ?? "unknown"),
    )
    .catch(() => "error");
}

/** Is the lock's keypad in front of the page? */
export async function isLocked(page) {
  return (await page.locator("dialog.nf-passcode--overlay").count().catch(() => 0)) > 0;
}

/** A context for one capture: viewport kind, theme, language, signed in or not. */
export async function contextFor(browser, { kind = "mobile", theme = "dark", locale, state }) {
  const ctx = await browser.newContext({
    ...VIEWPORTS[kind],
    colorScheme: theme,
    reducedMotion: "reduce",
    locale: "en-NG",
    timezoneId: "Africa/Lagos",
    ...(state ? { storageState: state } : {}),
  });
  await ctx.addCookies([
    { name: "vallo_first_run", value: "seen", url: BASE },
    { name: "vallo_consent", value: "1.00", url: BASE },
    { name: "nf_theme", value: theme, url: BASE },
    ...(locale ? [{ name: "nf_locale", value: locale, url: BASE }] : []),
  ]);
  await ctx.addInitScript((t) => {
    try { localStorage.setItem("nf_theme", t); } catch {}
  }, theme);
  return ctx;
}

export async function settle(page, extra = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(extra);
}
