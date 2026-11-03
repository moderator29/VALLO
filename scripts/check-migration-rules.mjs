#!/usr/bin/env node
/**
 * THE MIGRATION CONTENT RULES. V-51.
 *
 * `scripts/check-migrations.mjs` is the pipeline's gate (OPS-08: names, one
 * file per version, applied files immutable) and runs in CI. This file holds
 * the rules that read what a migration SAYS (M1 to M4), beside it, so the two
 * never fight over one file. It repeats M5 and M6 so it still stands alone.
 *
 * The eleven-and-a-half-hour catalogue outage of 22 to 23 September
 * (`docs/BUILD_07_LEDGER.md` section 67) was two lines of SQL a machine would
 * have caught: a revoke on a load-bearing RLS helper, and a column added to
 * `listings` without the anon column grant the catalogue read needs. The
 * ledger's own lesson was "it was in prose where it needed to be in a check".
 * This is the check. It reads migration TEXT only, needs no database and no
 * network, and runs in about a second, so it can run on every commit, in CI
 * when CI exists again, and by hand:
 *
 *     node scripts/check-migration-rules.mjs                 every migration
 *     node scripts/check-migration-rules.mjs --since 20260924000000
 *     node scripts/check-migration-rules.mjs --base origin/main   also refuse edits
 *
 * THE RULES, each named with the reason it exists.
 *
 *   M1 load-bearing revoke. `20260730021956_anon_execute_on_rls_helpers.sql`
 *      grants anon EXECUTE on four private helpers because permissive RLS
 *      policies are OR-ed, and a row that fails the public policy makes
 *      Postgres evaluate the next one, which calls the helper; without
 *      EXECUTE the WHOLE anonymous read raises 42501. A revoke of any of the
 *      four from anon (or of every function in `private` from anon) fails.
 *   M2 a listing column the catalogue reads, added without its anon grant.
 *      Anon holds a COLUMN list on `public.listings`, not the table, so a new
 *      column in `LISTING_SELECT` (`apps/web/src/lib/listings/
 *      supabase-repository.ts`, read here, not copied) that is not granted in
 *      the same file makes every anonymous catalogue read fail.
 *   M3 a new table in `public` without `enable row level security` in the
 *      same file. `pg_default_acl` hands every new public table to anon and
 *      authenticated; without RLS that is the whole table.
 *   M4 a SECURITY DEFINER function without a pinned `search_path`.
 *   M5 a file name that is not `<14 digits>_<snake_case>.sql`, or a timestamp
 *      two files share. Supabase orders by the prefix; a collision is an
 *      ordering nobody chose.
 *   M6 (with --base) an applied migration EDITED or DELETED. History is not
 *      rewritten; a fix is a new file.
 *
 * WHAT IT CANNOT SEE, said so nobody leans on it for more. It reads text, so
 * SQL assembled with `format()` and `execute` is invisible to it (the
 * `track_g_7` grant is exactly that, and is why M2 also accepts a grant
 * written as `execute format(...)` naming the column). It does not apply
 * anything; the probes in `scripts/probes/` and a real Postgres are the
 * second half of V-51 and are described in the report, not faked here.
 *
 * HISTORY. Migrations already applied before this gate existed are checked
 * too, and anything they trip is listed in KNOWN below with the reason it is
 * tolerated. The list may only shrink.
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "supabase", "migrations");
const REPOSITORY = join(ROOT, "apps", "web", "src", "lib", "listings", "supabase-repository.ts");

export const LOAD_BEARING = ["has_role", "owns_listing", "in_conversation", "is_booking_host"];

/*
 * WHEN EACH RULE BEGAN TO MEAN SOMETHING. Before the anon grant on the four
 * helpers (M1) there was nothing to revoke; before anon's table grant on
 * `listings` became a column list (M2) a new column was readable by default.
 * A rule applied to history older than its reason would be a false alarm.
 */
export const M1_FROM = "20260730021956";
export const M2_FROM = "20260809100105";

/** `LISTING_SELECT`'s plain columns, read from the source of truth. */
export function listingColumns(source) {
  const match = /const LISTING_SELECT = `([\s\S]*?)`;/.exec(source);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /^[a-z_][a-z0-9_]*$/.test(part));
}

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** Every rule over one file's text. Returns `[rule, message]` pairs. */
export function checkText(name, raw, columns) {
  const problems = [];
  const sql = stripComments(raw).toLowerCase();

  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) {
    problems.push(["M5", "file name is not <14 digits>_<snake_case>.sql"]);
  }

  const stamp = name.slice(0, 14);

  /* M1. Revokes are split per statement so a grant elsewhere cannot hide one. */
  for (const statement of stamp > M1_FROM ? sql.split(";") : []) {
    if (!/\brevoke\b/.test(statement) || !/\bfrom\b[^]*\banon\b/.test(statement)) continue;
    if (/on\s+all\s+functions\s+in\s+schema\s+private/.test(statement)) {
      problems.push(["M1", "revokes every private function from anon, including the four load-bearing RLS helpers"]);
      continue;
    }
    for (const helper of LOAD_BEARING) {
      if (new RegExp(`on\\s+function\\s+"?private"?\\s*\\.\\s*"?${helper}"?\\b`).test(statement)) {
        problems.push(["M1", `revokes private.${helper} from anon; RLS on listings needs it (20260730021956)`]);
      }
    }
  }

  /* M2. */
  const added = new Set();
  const addPattern = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?listings\b([^;]*)/g;
  let alter = addPattern.exec(sql);
  while (alter !== null) {
    const addColumn = /add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/g;
    let col = addColumn.exec(alter[1]);
    while (col !== null) {
      added.add(col[1]);
      col = addColumn.exec(alter[1]);
    }
    alter = addPattern.exec(sql);
  }
  for (const column of added) {
    if (stamp <= M2_FROM || !columns.includes(column)) continue;
    const granted = new RegExp(
      `grant\\s+select\\s*\\([^)]*\\b${column}\\b[^)]*\\)\\s*on\\s+(?:table\\s+)?(?:public\\.)?listings\\s+to\\s+[^;]*\\banon\\b`,
    ).test(sql);
    const formatted = /execute\s+format\s*\(\s*'grant\s+select/.test(sql) && sql.includes(`'${column}'`);
    if (!granted && !formatted) {
      problems.push(["M2", `adds listings.${column}, which the catalogue selects, without granting it to anon`]);
    }
  }

  /* M3. */
  const tablePattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/g;
  let table = tablePattern.exec(sql);
  while (table !== null) {
    const name = table[1];
    const direct = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${name}\\s+enable\\s+row\\s+level\\s+security`).test(sql);
    /* As M2: a loop `execute format('alter table public.%I enable row level
       security', t)` over an array that names the table, in the same file. */
    const formatted =
      /execute\s+format\s*\(\s*'alter\s+table\s+public\.%i\s+enable\s+row\s+level\s+security'/.test(sql) && sql.includes(`'${name}'`);
    if (!direct && !formatted) {
      problems.push(["M3", `creates public.${name} without enabling row level security in the same file`]);
    }
    table = tablePattern.exec(sql);
  }

  /* M4. The header of each function: from `create ... function` to its body. */
  const fnPattern = /create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_."]+)\s*\(([\s\S]*?)\bas\s+(\$[a-z_]*\$|')/g;
  let fn = fnPattern.exec(sql);
  while (fn !== null) {
    const header = fn[2];
    if (/\bsecurity\s+definer\b/.test(header) && !/\bset\s+search_path\b/.test(header)) {
      problems.push(["M4", `security definer ${fn[1]} does not pin search_path`]);
    }
    fn = fnPattern.exec(sql);
  }

  return problems;
}

/*
 * Applied before this gate existed, each tolerated for a stated reason. The
 * list may only shrink: a new file never goes in it.
 */
export const KNOWN = new Map([
  /* The section 67 outage itself: the two lines this gate exists to catch.
     Both were repaired by 20260923103430 (track_g_7), which re-grants
     owns_listing to anon and grants listing_role. */
  ["20260922230200_track_g_3_the_pair_axis_the_listing_says_what_its_lister_is.sql:M2", "section 67; repaired by 20260923103430"],
  ["20260922230500_track_g_6_the_firm_arm_on_owns_listing_and_the_publish_gate.sql:M1", "section 67; repaired by 20260923103430"],
  /* RLS for the five story tables was enabled one file later, in
     20260804143318_stories_rules_counters_and_safety.sql. */
  ["20260804143149_stories_are_their_own_thing.sql:M3", "RLS enabled in 20260804143318"],
  /* The listing page now reads lister_confirmed_at for "Confirmed available";
     the grant to anon, on that one date column only, is 20261029134320. */
  ["20260930102453_c5_lister_confirms_still_available.sql:M2", "anon read of the date column granted in 20261029134320"],
]);

/**
 * Run M1 to M5 over every file (or every file from `since`), returning the
 * failures and which tolerated historic findings were actually hit. A KNOWN
 * entry that no longer occurs is itself a failure: the list may only shrink,
 * and it shrinks by deleting the entry, not by it going quietly stale.
 */
export function scan({ since = null } = {}) {
  const columns = listingColumns(readFileSync(REPOSITORY, "utf8"));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const failures = [];
  const hit = new Set();
  const seen = new Map();
  let checked = 0;
  for (const file of files) {
    const stamp = file.slice(0, 14);
    if (seen.has(stamp)) failures.push([file, "M5", `timestamp ${stamp} is also used by ${seen.get(stamp)}`]);
    seen.set(stamp, file);
    if (since && stamp < since) continue;
    checked += 1;
    for (const [rule, message] of checkText(file, readFileSync(join(DIR, file), "utf8"), columns)) {
      const key = `${file}:${rule}`;
      if (KNOWN.has(key)) {
        hit.add(key);
        continue;
      }
      failures.push([file, rule, message]);
    }
  }
  if (!since) {
    for (const key of KNOWN.keys()) {
      if (!hit.has(key)) failures.push([key.split(":")[0], "KNOWN", "a tolerated finding no longer occurs; delete it from KNOWN"]);
    }
  }
  return { columns, checked, failures, hit };
}

function main(argv) {
  const since = argv.includes("--since") ? argv[argv.indexOf("--since") + 1] : null;
  const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : null;
  const { columns, checked, failures, hit } = scan({ since });
  if (columns.length < 20) {
    console.error(`migrations: could not read LISTING_SELECT (${columns.length} columns); refusing to pass blind`);
    process.exit(2);
  }

  if (base) {
    try {
      const out = execSync(`git diff --name-status ${base} -- supabase/migrations`, { cwd: ROOT, encoding: "utf8" });
      for (const line of out.split("\n")) {
        const [status, path] = line.split("\t");
        if (!status || !path || !path.endsWith(".sql") || path.includes("/pending/")) continue;
        if (status.startsWith("M") || status.startsWith("D") || status.startsWith("R")) {
          failures.push([path, "M6", "an applied migration was edited, renamed or deleted; write a new one instead"]);
        }
      }
    } catch (error) {
      console.error(`migrations: --base ${base} could not be compared (${error.message.split("\n")[0]})`);
      process.exit(2);
    }
  }

  if (failures.length > 0) {
    for (const [file, rule, message] of failures) console.error(`  ${rule}  ${file}\n      ${message}`);
    console.error(`migrations: ${failures.length} problem(s) in ${checked} checked file(s).`);
    process.exit(1);
  }
  console.log(
    `migrations: clean - ${checked} file(s) checked against M1 to M5${base ? " and M6" : ""}, ${columns.length} catalogue columns read from LISTING_SELECT, ${hit.size} tolerated historic finding(s) hit, each named in KNOWN. Reads text only: SQL built at runtime is not seen.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
