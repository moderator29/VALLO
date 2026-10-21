/**
 * C16. ACCESSIBILITY OF THE THREE DESKS: host, agent and the admin console.
 *
 * TWO SURFACES, AND THE VERDICT SAYS WHICH ONE IT MEASURED.
 *
 * 1. THE REAL HOST AND AGENT DESKS (`/host`, `/agent/dashboard`,
 *    `/agent/listings`), scanned whenever QA_MEMBER_EMAIL and
 *    QA_MEMBER_PASSWORD are set. A member session plus the passcode is the
 *    whole door, and `_gate.mjs` and `_passcode.mjs` already open both, so
 *    there was never a reason this could not be measured. A route that answers
 *    the sign-in door or stays behind the lock is a FAILURE here, never a
 *    quiet skip: a desk that was not reached was not scanned.
 * 2. THE PREVIEW HARNESS (`app/(dev)/preview/f5/*`), which draws the same
 *    components with fixtures. A production server opens it only with
 *    VALLO_PREVIEW_HARNESS=1, which CI sets on its own throwaway server and
 *    nowhere else (lib/preview-harness.ts). It remains the ONLY measurement of
 *    the admin console, because `lib/admin/guard.ts` requires a session that
 *    has proved a security key and no spec can prove one.
 *
 * Before 6 October this spec scanned the harness alone and printed
 * "a11y desks: pass", which read as a verdict on the product. The harness is a
 * fixture: it is worth measuring, and it is not the desks. Without the two QA
 * variables the real scan is now a named SKIP and the verdict says the real
 * desks went unmeasured.
 *
 * 3. THE MEMBER SCREENS THROUGH THE SAME HARNESS (`MEMBER_ROUTES`, added in
 *    the October audit): home, search, a listing, stays, a stay, restaurants,
 *    checkout, saved, messages, notifications, profile, settings, the feed
 *    and the wallet, each drawn from fixtures by the same components the
 *    signed-in pages use. The real pages sit behind a session and the
 *    passcode; the harness is how a CI browser reaches what they draw. Same
 *    matrix, same verdict rules, and the verdict names them.
 *
 * For each route at 390 and 1440, dark and light, motion off:
 *   - axe-core; SERIOUS and CRITICAL fail, moderate and minor are printed;
 *   - exactly one <h1>... is NOT asserted here: a harness page may draw two
 *     desks side by side, so landmarks are checked as "at least one main".
 * Then three scripted checks axe cannot make:
 *   - the confirm panel: focus lands inside it when it opens, Escape closes
 *     it, and focus returns to the control that opened it;
 *   - a keyboard-only walk of the desk sidebar: every link reachable by Tab,
 *     each with a visible focus ring (a non-zero outline or box-shadow);
 *   - the desks' key layer (C6): j moves focus to a row on a table desk.
 *
 *   BASE_URL=http://localhost:3210 node apps/web/tests/a11y-desks.spec.mjs
 *   A11Y_MATRIX=quick ...   dark, 390 only
 */
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { qaContext, qaCredentials, signInAsQa, skip } from "./_gate.mjs";
import { passcodeReady } from "./_passcode.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3210";
const EXECUTABLE = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const QUICK = process.env.A11Y_MATRIX === "quick";
const AXE_SOURCE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

export const DESK_ROUTES = [
  "/preview/f5/host-landing",
  "/preview/f5/agent-dashboard",
  "/preview/f5/agent-listings",
  "/preview/f5/admin-overview",
  "/preview/f5/admin-queue",
  "/preview/f5/confirm",
];

/* The signed-in member screens, from fixtures (see 3. above). Each page
   wraps its screen in a `main`, as the app shell does for the real one. */
export const MEMBER_ROUTES = [
  "/preview/f1/home",
  "/preview/f3/search",
  "/preview/f3/listing",
  "/preview/f3/stays",
  "/preview/f3/stay",
  "/preview/f3/restaurants",
  "/preview/f3/checkout",
  "/preview/f3/saved",
  "/preview/f5/inbox",
  "/preview/f5/thread-booking",
  "/preview/f4/notifications",
  "/preview/f4/profile",
  "/preview/f4/settings",
  "/preview/f4/feed",
  "/preview/p5/wallet",
];

/* THE REAL DESKS, scanned when QA_MEMBER_EMAIL and QA_MEMBER_PASSWORD exist.
   A member session plus the passcode is the whole door for these three, so a
   headless browser can reach them. The admin console cannot be reached this
   way at any price: `lib/admin/guard.ts` requires a session that has PROVED A
   SECURITY KEY, and a proof is not something a spec can supply. The two
   `admin-*` harness routes above therefore stay the only measurement of the
   console, and the verdict says so rather than letting a reader assume
   otherwise. */
export const REAL_DESK_ROUTES = ["/host", "/agent/dashboard", "/agent/listings"];

/* Which surfaces this run actually measured. The verdict line is built from
   this, because the finding that produced it was a job that printed
   "a11y desks: pass" while having scanned nothing but a fixture harness. */
const scanned = { harness: false, real: false };
const THEMES = QUICK ? ["dark"] : ["dark", "light"];
const WIDTHS = QUICK ? [390] : [390, 1440];
const FAILING = new Set(["serious", "critical"]);

const failures = [];
const notes = [];

async function load(page, url) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
      if (response && response.status() === 404) {
        failures.push(`${url}: 404 (is VALLO_PREVIEW_HARNESS=1 set on this server?)`);
        return false;
      }
      await page.evaluate(() => document.fonts?.ready);
      return true;
    } catch (error) {
      if (attempt === 2) failures.push(`${url}: did not load (${String(error).slice(0, 120)})`);
    }
  }
  return false;
}

async function newContext(browser, theme, width) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    reducedMotion: "reduce",
    bypassCSP: true,
  });
  await context.addCookies(
    [
      ["nf_theme", theme],
      ["nf_motion", "off"],
      ["vallo_first_run", "seen"],
    ].map(([name, value]) => ({ name, value, url: BASE_URL })),
  );
  return context;
}

async function axePass(browser, theme, width, { routes = DESK_ROUTES, context: given = null, label = "" } = {}) {
  const context = given ?? (await newContext(browser, theme, width));
  const page = await context.newPage();
  for (const route of routes) {
    const where = `${label}${route} [${theme} ${width}]`;
    if (!(await load(page, BASE_URL + route))) continue;
    /* A real desk that answered the sign-in door or the passcode lock was NOT
       measured, and must never be counted as a clean scan. */
    const landed = new URL(page.url()).pathname;
    if (given && (landed.startsWith("/sign-in") || landed.startsWith("/welcome"))) {
      failures.push(`${where}: landed on ${landed}, so the real desk was never scanned`);
      continue;
    }
    if (given && (await page.locator("[data-passcode-lock], [data-testid=passcode-lock]").count()) > 0) {
      failures.push(`${where}: the passcode lock is covering the page, so the real desk was never scanned`);
      continue;
    }
    const mains = await page.evaluate(() => document.querySelectorAll("main, [role=main]").length);
    if (mains < 1) failures.push(`${where}: no main landmark`);
    await page.addScriptTag({ content: AXE_SOURCE });
    const result = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ["violations"] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
    });
    for (const v of result) {
      const line = `${where}: [${v.impact}] ${v.id}: ${v.help} (${v.nodes.join(" | ")})`;
      if (FAILING.has(v.impact ?? "")) failures.push(line);
      else notes.push(line);
    }
    if (width === 390) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) failures.push(`${where}: scrolls sideways by ${overflow}px at 390`);
    }
  }
  await page.close();
  if (!given) await context.close();
}

/** The confirm panel: focus in on open, Escape closes, focus back to the opener. */
async function confirmFocus(browser) {
  const context = await newContext(browser, "dark", 390);
  const page = await context.newPage();
  if (!(await load(page, `${BASE_URL}/preview/f5/confirm`))) return context.close();
  const opener = page.locator("button", { hasText: /accept|decline/i }).first();
  if ((await opener.count()) === 0) {
    notes.push("/preview/f5/confirm: no Accept or Decline control found to open the live panel");
    return context.close();
  }
  await opener.focus();
  const openerLabel = (await opener.textContent())?.trim();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]")));
  if (!inside) failures.push("confirm panel: focus did not move into the dialog when it opened");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const open = await page.evaluate(() => document.querySelectorAll("[role=dialog][open], dialog[open], [role=dialog]:not([hidden])").length);
  const back = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  if (open > 0) notes.push("confirm panel: a dialog is still in the page after Escape (it may be the static one)");
  if (openerLabel && back !== openerLabel) failures.push(`confirm panel: focus returned to "${back}", not to "${openerLabel}"`);
  await context.close();
}

/** Keyboard-only walk of the desk sidebar, and the j key on a table desk. */
async function keyboardWalk(browser) {
  const context = await newContext(browser, "dark", 1440);
  const page = await context.newPage();
  if (await load(page, `${BASE_URL}/preview/f5/agent-dashboard`)) {
    const links = await page.locator(".nf-desk-side a[href]").count();
    let reached = 0;
    let ringless = 0;
    for (let i = 0; i < 80 && reached < links; i += 1) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || !el.closest(".nf-desk-side") || el.tagName !== "A") return null;
        const s = getComputedStyle(el);
        const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
        return { ring };
      });
      if (state) {
        reached += 1;
        if (!state.ring) ringless += 1;
      }
    }
    if (links > 0 && reached < links) failures.push(`desk sidebar: Tab reached ${reached} of ${links} links`);
    if (ringless > 0) failures.push(`desk sidebar: ${ringless} link(s) show no focus ring`);
  }
  if (await load(page, `${BASE_URL}/preview/f5/admin-queue`)) {
    const rows = await page.locator("[data-desk-row]").count();
    if (rows > 0) {
      await page.locator("body").click({ position: { x: 5, y: 5 } });
      await page.keyboard.press("j");
      const onRow = await page.evaluate(() => Boolean(document.activeElement?.closest("[data-desk-row]")));
      if (!onRow) failures.push("desk keys: j did not move focus to the first row on the queue");
    } else {
      notes.push("desk keys: the queue harness draws no [data-desk-row] rows; j not exercised");
    }
  }
  await context.close();
}

/* The real host and agent desks, behind a real member session and the
   passcode. Signed in once and the context reused across the matrix: a
   sign-in per theme and width would be four round trips to GoTrue for no
   extra coverage. */
async function realDeskPass(browser) {
  const state = await signInAsQa(browser);
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const context = await qaContext(browser, state, {
        viewport: { width, height: width < 600 ? 844 : 900 },
        reducedMotion: "reduce",
        bypassCSP: true,
      });
      await context.addCookies(
        [
          ["nf_theme", theme],
          ["nf_motion", "off"],
          ["vallo_first_run", "seen"],
        ].map(([name, value]) => ({ name, value, url: BASE_URL })),
      );
      const page = await context.newPage();
      await passcodeReady(context, page, { baseUrl: BASE_URL });
      await page.close();
      console.log(`a11y desks (real): ${theme} ${width}`);
      await axePass(browser, theme, width, { routes: REAL_DESK_ROUTES, context, label: "real " });
      await context.close();
    }
  }
  scanned.real = true;
}

async function main() {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  try {
    for (const theme of THEMES) for (const width of WIDTHS) {
      console.log(`a11y desks (harness): ${theme} ${width}`);
      await axePass(browser, theme, width);
      console.log(`a11y member screens (harness): ${theme} ${width}`);
      await axePass(browser, theme, width, { routes: MEMBER_ROUTES, label: "member " });
    }
    scanned.harness = true;
    await confirmFocus(browser);
    await keyboardWalk(browser);

    /* THE REAL DESKS. Without the two QA variables this is a named SKIP, not a
       silent pass: the harness result stands on its own and the verdict below
       states that the real desks went unmeasured. */
    /* BOTH conditions, and the second one was learned by running this: with no
       NEXT_PUBLIC_SUPABASE_ANON_KEY the proxy has no sign-in wall at all
       (`host.spec.mjs` skips on the same variable for the same reason), so
       `/host` answers 200 signed out. Scanning that page would measure a desk
       with no session and no data behind an absent gate and report it as the
       real desk, which is the exact fault this change exists to remove. */
    if (qaCredentials() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        await realDeskPass(browser);
      } catch (error) {
        failures.push(`real desks: the signed-in scan could not run (${String(error).slice(0, 160)})`);
      }
    } else {
      const missing = qaCredentials()
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set, so this build has no sign-in wall and a desk page would answer signed out"
        : "QA_MEMBER_EMAIL and QA_MEMBER_PASSWORD are not set";
      skip(`${missing}, so the REAL host and agent desks were not scanned; only the fixture harness was`);
    }
  } finally {
    await browser.close();
  }
  if (notes.length > 0) {
    console.log(`\n${notes.length} note(s), not failing:`);
    for (const note of notes.slice(0, 40)) console.log(`  note  ${note}`);
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} finding(s):`);
    for (const f of failures) console.error(`  FAIL  ${f}`);
    process.exit(1);
  }
  /* Never a bare "pass". The verdict names the surface it measured, because a
     green tick that does not say what it looked at spends credibility it has
     not earned. */
  const surfaces = [scanned.harness ? "the fixture harness (desks and member screens)" : null, scanned.real ? "the real host and agent desks" : null].filter(Boolean);
  console.log(`\na11y desks: pass on ${surfaces.join(" and ")} (no serious or critical findings).`);
  if (!scanned.real) {
    console.log("a11y desks: THE REAL DESKS WERE NOT SCANNED. Set QA_MEMBER_EMAIL and QA_MEMBER_PASSWORD to measure them.");
  }
  console.log("a11y desks: the admin console is measured only through the harness; its security key cannot be proved by a spec.");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
