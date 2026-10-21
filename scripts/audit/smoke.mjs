#!/usr/bin/env node
/**
 * R2 SMOKE TESTS over the critical journeys.
 *
 * This sandbox cannot reach Supabase and holds no session, so a signed-in
 * journey cannot be walked against live data. What CAN be walked is the
 * preview harness at `app/(dev)/preview/**`, which renders the real
 * components on fixtures, plus every signed-out product surface. That is what
 * this script does, and it says plainly which of the two a row came from.
 *
 * For each URL it checks:
 *   - the HTTP status
 *   - that the response is not Next's error overlay or a digest page
 *   - that the page rendered a <main> or the app shell rather than a shell
 *     with nothing in it
 *   - that no rendered anchor carries href="#" or an empty href
 *   - that a named marker the journey depends on is present, where one is
 *     given (`expect`), and absent where one is forbidden (`forbid`)
 *
 * Usage:
 *   NEXT_DIST_DIR=.next-r2 npx next dev -p 3111     # from apps/web
 *   node scripts/audit/smoke.mjs [--base http://127.0.0.1:3111] [--json]
 *                                [--only <substring>]
 *
 * Exit code 1 on any failure.
 */

import { heading } from "./lib/tsx.mjs";

const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
const baseIdx = argv.indexOf("--base");
const BASE = baseIdx >= 0 ? argv[baseIdx + 1] : process.env.R2_BASE || "http://127.0.0.1:3111";
const onlyIdx = argv.indexOf("--only");
const ONLY = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
const TIMEOUT_MS = Number(process.env.R2_TIMEOUT_MS ?? 90000);

/**
 * The journeys. `source` is "product" for a real route served signed out, and
 * "fixture" for a preview route that renders real components on fixtures.
 */
const JOURNEYS = [
  /* ---------------------------------------------------------- discovery -- */
  { name: "landing", url: "/", source: "product", expect: ["Vallo"] },
  { name: "explore (property search)", url: "/search", source: "product" },
  { name: "search with a query", url: "/search?q=Lekki", source: "product" },
  { name: "search with a type filter", url: "/search?type=shortlet", source: "product" },
  { name: "stays root", url: "/stays", source: "product" },
  { name: "stays search", url: "/stays/search", source: "product" },
  { name: "stays search, filtered", url: "/stays/search?minRating=4&verified=1", source: "product" },
  { name: "restaurants", url: "/restaurants", source: "product" },

  /* ------------------------------------------------------------- shells -- */
  { name: "home", url: "/home", source: "product" },
  { name: "saved", url: "/saved", source: "product" },
  { name: "plans", url: "/bookings?side=stays", source: "product" },
  { name: "bookings", url: "/bookings", source: "product" },
  { name: "messages", url: "/messages", source: "product" },
  { name: "notifications", url: "/notifications", source: "product" },
  { name: "assistant", url: "/assistant", source: "product" },
  { name: "wallet", url: "/wallet", source: "product" },
  { name: "around (the feed)", url: "/around", source: "product" },
  { name: "settings", url: "/settings", source: "product" },
  { name: "profile", url: "/profile", source: "product" },

  /* ---------------------------------------------------------------auth -- */
  { name: "sign in", url: "/sign-in", source: "product" },
  { name: "sign up", url: "/sign-up", source: "product" },
  { name: "welcome", url: "/welcome", source: "product" },

  /* ------------------------------------------- marketing and the footer -- */
  { name: "about", url: "/about", source: "product" },
  { name: "help", url: "/help", source: "product" },
  { name: "docs", url: "/docs", source: "product" },
  { name: "safety", url: "/safety", source: "product" },
  { name: "standards", url: "/standards", source: "product" },
  { name: "cancellations", url: "/cancellations", source: "product" },
  { name: "careers", url: "/careers", source: "product" },
  { name: "contact", url: "/contact", source: "product" },
  { name: "terms", url: "/terms", source: "product" },
  { name: "privacy", url: "/privacy", source: "product" },
  /* The footer and the in-app home both offer this. It is not a route. */
  { name: "the agents destination the footer offers", url: "/agents", source: "product", mustExist: true },
  { name: "the reviews destination the profile offers", url: "/reviews", source: "product", mustExist: true },
  { name: "the support destination agent verification offers", url: "/support", source: "product", mustExist: true },

  /* ------------------------------------ the harness: signed-in surfaces -- */
  { name: "fixture: listing detail", url: "/preview/f3/listing", source: "fixture" },
  { name: "fixture: search results", url: "/preview/f3/search", source: "fixture" },
  { name: "fixture: saved board", url: "/preview/f3/saved", source: "fixture" },
  { name: "fixture: stays", url: "/preview/f3/stays", source: "fixture" },
  { name: "fixture: stays search", url: "/preview/f3/stays-search", source: "fixture" },
  { name: "fixture: stay detail", url: "/preview/f3/stay", source: "fixture" },
  { name: "fixture: restaurant", url: "/preview/f3/restaurant", source: "fixture" },
  { name: "fixture: checkout", url: "/preview/f3/checkout", source: "fixture" },
  { name: "fixture: move-in ledger", url: "/preview/f3/move-in", source: "fixture" },
  { name: "fixture: bookings", url: "/preview/f3/bookings", source: "fixture" },
  { name: "fixture: trips", url: "/preview/f3/trips", source: "fixture" },
  { name: "fixture: the feed", url: "/preview/f4/feed", source: "fixture" },
  { name: "fixture: a post thread", url: "/preview/f4/post-thread", source: "fixture" },
  { name: "fixture: profile", url: "/preview/f4/profile", source: "fixture" },
  { name: "fixture: settings", url: "/preview/f4/settings", source: "fixture" },
  { name: "fixture: the inbox", url: "/preview/f5/inbox", source: "fixture" },
  { name: "fixture: a booking thread", url: "/preview/f5/thread-booking", source: "fixture" },
  { name: "fixture: a rental thread", url: "/preview/f5/thread-rental", source: "fixture" },
  { name: "fixture: an inspection", url: "/preview/f5/inspection", source: "fixture" },
  { name: "fixture: the share picker", url: "/preview/f5/share-picker", source: "fixture" },
  { name: "fixture: the admin queue", url: "/preview/f5/admin-queue", source: "fixture" },
  { name: "fixture: the agent dashboard", url: "/preview/f5/agent-dashboard", source: "fixture" },
  { name: "fixture: home", url: "/preview/f1/home", source: "fixture" },
  { name: "fixture: the assistant", url: "/preview/f1/assistant", source: "fixture" },
  { name: "fixture: notifications", url: "/preview/f1/notifications", source: "fixture" },
];

/* Markers that mean Next failed to render rather than the page being empty. */
const ERROR_MARKERS = [
  "Application error: a server-side exception",
  "This page could not be found",
  "__next_error__",
  "nextjs-portal",
  "Internal Server Error",
];

/* Copy the ledger's rule 13 bans outright. Colour is never the only signal,
   and neither is a promise the product cannot keep. */
const BANNED_COPY = /\b(coming soon|not live|lorem ipsum)\b/i;

async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + url, {
      signal: controller.signal,
      headers: { "user-agent": "vallo-r2-smoke" },
      redirect: "manual",
    });
    const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
    return { status: res.status, location: res.headers.get("location"), body };
  } finally {
    clearTimeout(timer);
  }
}

function anchorsWithDeadHref(html) {
  const dead = [];
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/g)) {
    if (m[1] === "#" || m[1] === "" || m[1].startsWith("javascript:")) dead.push(m[0].slice(0, 120));
  }
  return dead;
}

function buttonsWithoutType(html) {
  /* A rendered <button> with neither type nor a form ancestor is a control
     React could only have made live through a handler; this counts them so a
     spike shows up rather than hiding in the noise. */
  return [...html.matchAll(/<button\b(?![^>]*\btype=)[^>]*>/g)].length;
}

const results = [];

for (const j of JOURNEYS) {
  if (ONLY && !j.url.includes(ONLY) && !j.name.includes(ONLY)) continue;
  const row = { ...j, problems: [] };
  let res;
  try {
    res = await get(j.url);
  } catch (err) {
    row.status = 0;
    row.problems.push(`no response: ${err instanceof Error ? err.message : String(err)}`);
    results.push(row);
    continue;
  }
  row.status = res.status;
  row.redirect = res.location ?? null;

  if (j.mustExist) {
    /* These rows exist to prove a link the product offers actually resolves. */
    if (res.status === 404) row.problems.push("404: the product links here and nothing serves it");
    else if (res.status >= 400) row.problems.push(`status ${res.status}`);
    results.push(row);
    continue;
  }

  /*
   * EVERY STATUS THAT IS NOT A PAGE IS A FAILURE, AND THIS USED TO NAME TWO.
   *
   * The rule was `>= 500` or exactly `404`, which left 401, 403, 405, 410 and
   * 429 falling through to no problem at all. The body checks below could not
   * catch them either: the `<main>` check is guarded on a 200, so a route that
   * started answering 403 to a signed-out visitor walked this smoke run as
   * `ok  403`. A journey that answers a refusal is not a journey that
   * rendered, whatever the number on it.
   */
  if (res.status >= 400) row.problems.push(res.status === 404 ? "404" : `status ${res.status}`);
  else if (res.status >= 300) row.note = `redirects to ${res.location}`;
  else if (res.status < 200) row.problems.push(`status ${res.status}`);

  if (res.body) {
    for (const marker of ERROR_MARKERS) {
      if (res.body.includes(marker)) row.problems.push(`error overlay: ${marker}`);
    }
    const dead = anchorsWithDeadHref(res.body);
    if (dead.length) row.problems.push(`${dead.length} rendered anchor(s) with a dead href`);
    row.deadAnchors = dead;
    row.looseButtons = buttonsWithoutType(res.body);
    const banned = res.body.match(BANNED_COPY);
    if (banned) row.problems.push(`banned copy rendered: ${banned[0]}`);
    if (!/<main\b/.test(res.body) && res.status === 200) {
      row.problems.push("no <main> in the response");
    }
    for (const marker of j.expect ?? []) {
      if (!res.body.includes(marker)) row.problems.push(`missing expected marker ${JSON.stringify(marker)}`);
    }
    for (const marker of j.forbid ?? []) {
      if (res.body.includes(marker)) row.problems.push(`forbidden marker present ${JSON.stringify(marker)}`);
    }
  }
  results.push(row);
}

const failures = results.filter((r) => r.problems.length > 0);

if (AS_JSON) {
  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
} else {
  console.log(heading("R2 smoke tests"));
  console.log(`Base ${BASE}. "fixture" rows render the real components on the preview harness,`);
  console.log(`because this sandbox reaches no database and holds no session.\n`);
  for (const r of results) {
    const flag = r.problems.length ? "FAIL" : "ok  ";
    console.log(
      `  ${flag} ${String(r.status).padEnd(4)} ${r.source.padEnd(8)} ${r.url.padEnd(38)} ${r.name}${r.note ? `  (${r.note})` : ""}`,
    );
    for (const p of r.problems) console.log(`        - ${p}`);
    for (const a of r.deadAnchors ?? []) console.log(`          ${a}`);
  }
  console.log(heading("Summary"));
  console.log(`  journeys walked   ${results.length}`);
  console.log(`  failures          ${failures.length}`);
  console.log(
    failures.length === 0 ? "\nPASS: every journey walked rendered.\n" : `\nFAIL: ${failures.length} journeys.\n`,
  );
}

process.exit(failures.length ? 1 : 0);
