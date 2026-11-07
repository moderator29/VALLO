/**
 * Saying something without joining anything first.
 *
 * The owner tapped the plus on the feed and was told to go and join a place:
 * "in feed people can post there already when click +, currently it's saying
 * you need to join etc etc, make it that you can also already post on normal
 * public feed, without joining a places". And separately, of the tabs above the
 * feed: "make the following new and for you clean and make their button smaller
 * and rectangle shape not someone circle".
 *
 * WHAT WAS ACTUALLY WRONG. Nothing in the database ever required a place.
 * `posts.area_id` is nullable, `posts_insert_self` allows a null area outright,
 * `posts_select` shows one to everybody including a signed-out reader, and
 * there is no membership check anywhere in the schema. The requirement lived in
 * exactly three lines of application code: one `.uuid()` on a zod field, one
 * `isMember === false` early return in the composer, and one branch in the dock
 * that turned "you are in no place" into a wall with a directory link on it.
 * Between them they made joining a room the price of speaking, on the first tap
 * of the first session.
 *
 * The database half of this is proved where it can be proved, which is against
 * the real project under the caller's own RLS rather than here. Recorded in the
 * commit: an insert with `area_id = null` as the signed-in user through
 * `private.probe_as` + `set local role authenticated` returns a LIVE row, and
 * `anon` can read it back. This file proves the application half.
 *
 * SINCE THIS WAS WRITTEN. The plus's sheet moved out of `FabDock.tsx` into the
 * create bloom (`components/social/bloom/CreateBloom.tsx`), so the dock
 * checks read that file. `/around` answers a signed-out visitor with the
 * sign-in wall since 23 September (asserted), so the tabs are measured on the
 * preview harness's feed (`/preview/session-b/feed`: the real FeedTabs in the
 * real AppShell), and there are two of them now, For you and Following: New
 * came off the row on purpose (`FeedMasthead.tsx`) and `?tab=new` still
 * answers.
 *
 *   BASE_URL=http://localhost:3210 node apps/web/tests/public-feed.spec.mjs
 */

import { chromium } from "playwright-core";
import { expectSignInWall, openPreview } from "./_gate.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3210";
const EXECUTABLE_PATH = "/opt/pw-browsers/chromium";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const read = (p) => readFileSync(join(SRC, p), "utf8");

/*
 * Read the code, not the prose.
 *
 * Both files that lost a wall carry a comment quoting the wall's exact words,
 * because the reason it was wrong belongs next to the space it left. A grep
 * over the raw text finds that comment and calls the removal a failure, which
 * is the check being wrong rather than the product. So comments come out
 * before any assertion about what a file no longer says.
 */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok      ${name}`);
  } else {
    failures += 1;
    console.log(`  FAILED  ${name}`);
    if (detail) for (const line of [].concat(detail).slice(0, 10)) console.log(`            ${line}`);
  }
}

const schema = read("lib/social/posts-schema.ts");
const actions = read("lib/social/posts-actions.ts");
const composer = read("components/social/feed/Composer.tsx");
const dock = read("components/social/bloom/CreateBloom.tsx");
const feed = read("components/social/feed/Feed.tsx");
const queries = read("lib/social/posts-queries.ts");
const around = read("app/(app)/around/page.tsx");

/* ------------------------------------------------- the three lines that gated */

console.log("\nThe place is no longer the price of speaking");

check(
  "the area is optional on the way in",
  /areaId: z\.string\(\)\.uuid\([^)]*\)\.optional\(\)/.test(schema),
);
check(
  "and the action writes null rather than refusing",
  /area_id: parsed\.data\.areaId \?\? null/.test(actions),
);
check(
  "the composer no longer walls off a non-member",
  !/Join this place first/.test(code(composer)),
);
check(
  "and it sends without an area when there is none",
  /dropPost\(areaId \? \{ areaId, kind, body \} : \{ kind, body \}\)/.test(composer),
);
check(
  "the dock no longer tells somebody to go and join something before writing",
  !/You are not in any place yet/.test(code(dock)),
);
check(
  "everybody is an offered destination, not an absence",
  /post-to-everyone/.test(dock) && /Everyone on Vallo/.test(dock),
);
check(
  "isMember is gone rather than left behind as a dead prop",
  !/isMember[?]?:/.test(code(composer)) && !/isMember[?]?:/.test(code(feed)),
);

/* ----------------------------------------------------- what a feed now reads */

console.log("\nEvery post that may be read, is read");

check(
  "a public post rides along with the places somebody joined",
  /includePublic: true/.test(queries),
);
check(
  "the open feed no longer caps itself at the busiest two dozen places",
  !/\.limit\(24\)/.test(queries) && /getEverywhereFeed/.test(queries),
);
check(
  "and it passes no area predicate at all, so the policy is the filter",
  /readFeedPage\(supabase, viewerId, null,/.test(queries),
);
check(
  "the feed page reads it under both names it needs",
  /getEverywhereFeed\(\)/.test(around) && /getJoinedFeed\(viewerId\)/.test(around),
);
check(
  "the composer appears on a timeline rather than only inside a joined place",
  /canCompose/.test(feed) && /canCompose\b/.test(around),
);

/* -------------------------------------------------------- what a browser sees */

const browser = await chromium.launch({ executablePath: EXECUTABLE_PATH });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

try {
  const page = await context.newPage();
  await expectSignInWall(check, "/around", BASE_URL);

  console.log("\nThe tabs, measured rather than assumed (preview harness)");
  if (!(await openPreview(page, "/preview/session-b/feed", check, { base: BASE_URL, wait: 700 }))) {
    throw Object.assign(new Error("harness closed"), { harnessClosed: true });
  }

  const tabs = await page.locator('[data-testid^="feed-tab-"]').all();
  /* For you, Friends and the three categories (founder, 7 November 2026). */
  check("all five are there, For you, Friends, Properties, Stays, Restaurants", tabs.length === 5, [`${tabs.length}`]);

  const shapes = [];
  for (const tab of tabs) {
    shapes.push(
      await tab.evaluate((el) => {
        const s = getComputedStyle(el);
        const after = getComputedStyle(el, "::after");
        return {
          text: (el.textContent ?? "").trim(),
          radius: parseFloat(s.borderRadius),
          height: Math.round(el.getBoundingClientRect().height),
          /* The overlay is sized by its inset now (`inset: -4.4px 0` on a
             35.2px tab), not by a min-height, so read its used height. */
          hit: Math.max(parseFloat(after.minHeight) || 0, parseFloat(after.height) || 0),
        };
      }),
    );
  }

  /*
   * A pill is a radius of half its height or more. These are rectangles, which
   * is the word the owner used, so the radius has to be well under that. At
   * 34px tall a pill would round at 17; ours rounds at 10.
   */
  check(
    "they are rectangles, not pills",
    shapes.every((s) => s.radius > 0 && s.radius < s.height / 2),
    shapes.map((s) => `${s.text}: radius ${s.radius} on height ${s.height}`),
  );
  check(
    "and they paint on the 40px rung, under the 44px chip they used to be",
    shapes.every((s) => s.height > 0 && s.height <= 40),
    shapes.map((s) => `${s.text}: ${s.height}px`),
  );
  /* Smaller paint must not mean a smaller target. The centred overlay is what
     keeps the 44pt promise while the drawn box shrinks. */
  check(
    "the tap target is still 44pt, through the overlay rather than the paint",
    shapes.every((s) => s.hit >= 44),
    shapes.map((s) => `${s.text}: hit ${s.hit}`),
  );
  check(
    "exactly one is marked as where the reader is",
    (await page.locator('[data-testid^="feed-tab-"][aria-current="page"]').count()) === 1,
  );
} catch (error) {
  if (!error?.harnessClosed) throw error;
} finally {
  await context.close();
  await browser.close();
}

/* ------------------------------------------- the platform's own daily voice */

console.log("\nVallo says one thing a day, and it is a thing that stays true");

/* Found by what it is rather than by one filename: the migration carries its
   name from the live migration history (`..._rentme_says_one_useful_thing_a_day.sql`). */
const MIGRATIONS = join(ROOT, "../../supabase/migrations");
const dailyFile = readdirSync(MIGRATIONS).find((f) => /_says_one_useful_thing_a_day\.sql$/.test(f));
check("the daily-note migration is on disk", Boolean(dailyFile), [String(dailyFile)]);
const daily = dailyFile ? readFileSync(join(MIGRATIONS, dailyFile), "utf8") : "";

check("it posts to everybody rather than into one room", /area_id, author_kind[\s\S]{0,80}?values \(null, 'SYSTEM'/.test(daily));
check(
  "twice in a day is a no-op, so a retry cannot double-post",
  /Africa\/Lagos'\)::date\s*\n?\s*=\s*\(now\(\)/.test(daily),
);
check(
  "a note that cannot verify its own number does not post",
  /if coalesce\(n, 0\) < 3 then return null; end if;/.test(daily),
);
check(
  "and the rotation moves on rather than leaving the day silent",
  /exit when body is not null;/.test(daily),
);
check("nothing about it is callable by a client", /revoke all on function private\.post_daily_note\(\) from public, anon, authenticated/.test(daily));
check("no em dash anywhere in what it says", !daily.includes("—"));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
