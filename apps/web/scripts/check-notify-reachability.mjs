#!/usr/bin/env node
/**
 * THE BYPASSED NOTIFICATION GATE.
 *
 * WHY THIS EXISTS. On 12 November 2026 two real staff members were given a
 * position and never received the letter the platform had written for them.
 * Nothing was broken: template `staff.access_granted` was registered, built
 * and rendered. The only thing that enqueued it was one of the three write
 * paths into `public.staff_grants`, and the path that ran was one of the other
 * two. The defect was not a missing message, it was a message with one caller.
 *
 * `src/lib/notify/templates.test.ts` already holds the registry equal to a
 * HAND WRITTEN list of the templates the migrations enqueue. A hand written
 * list cannot notice the day a template stops being enqueued, because nobody
 * edits a list when they delete a trigger. This reads the SQL instead.
 *
 * WHAT IT CHECKS.
 *
 *   R1 EVERY REGISTERED TEMPLATE HAS AN ENQUEUE SITE. A key in
 *      `OUTBOX_TEMPLATES` that no SQL file and no server file ever names is a
 *      message the platform believes it sends and does not send.
 *
 *   R2 EVERY TEMPLATE A FILE ABOUT TO RUN ENQUEUES IS REGISTERED. A trigger
 *      that writes a template the running build has no entry for fills the
 *      drain's DROPPED column instead of somebody's inbox. This has happened:
 *      five rows in `public.email_outbox` are DROPPED, one of them with
 *      `no template: message.unread`, read off the live database on
 *      13 November 2026.
 *
 *      R2 reads `supabase/migrations/pending/` ONLY, and the reason is worth
 *      stating. An applied migration is history: two files from 23 September
 *      enqueue `escrow.<state>` and `wallet.withdrawal_outcome`, and both
 *      products were retired by later files, so neither name is enqueued by
 *      any function in the live database today (checked against `pg_proc` on
 *      13 November 2026). Reading applied history would report both for ever.
 *
 * WHAT IT CANNOT SEE, said plainly so nobody leans on it for more. It reads
 * text. A template name assembled with `format()` or held in a variable is
 * invisible to it, which is why DYNAMIC below names the ones that are, each
 * with the function that composes them, read out of the live database rather
 * than guessed. It does not prove the enqueue site is itself reachable: a
 * trigger on a table nobody writes passes this and still sends nothing. Use
 * the live database for that question.
 *
 *     node scripts/check-notify-reachability.mjs
 *
 * Exit 0 clean, exit 1 with the list.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, sep as SEP } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(WEB, "..", "..");
const REGISTRY = join(WEB, "src", "lib", "notify", "templates.ts");

/**
 * Templates whose name is composed at runtime, so no file contains the literal
 * at an enqueue site. Each line is the live function that writes it, read from
 * `pg_proc` on project uccixoonmbhrnyczyigt on 13 November 2026. A name may
 * only be added here with that evidence.
 */
const DYNAMIC = new Map([
  ["agreement.waiting", "private.enqueue_agreement_lifecycle_email"],
  ["agreement.submitted", "private.enqueue_agreement_lifecycle_email"],
  ["agreement.cancelled", "private.enqueue_agreement_lifecycle_email"],
  ["agreement.approved", "private.agreement_tell_both"],
  ["agreement.rejected", "private.agreement_tell_both"],
  ["reservation.confirmed", "private.enqueue_reservation_email"],
  ["reservation.cancelled", "private.enqueue_reservation_email"],
  ["payment.rent_receipt", "private.tell_payment_received"],
  ["platform.newsletter", "public.newsletter_enqueue"],
]);

/** Every .sql under supabase/migrations, applied and pending alike. */
function sqlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sqlFiles(path, out);
    else if (name.endsWith(".sql")) out.push(path);
  }
  return out;
}

/** Every server file that could enqueue or insert an outbox row. */
function serverFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) serverFiles(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** The registry's keys, read out of the one object that holds them. */
function registeredKeys(source) {
  const body = /export const OUTBOX_TEMPLATES[^{]*\{([\s\S]*?)\n\};/.exec(source);
  if (!body) {
    console.error("check-notify-reachability: OUTBOX_TEMPLATES could not be read.");
    process.exit(1);
  }
  return [...body[1].matchAll(/^ {2}"([a-z][a-zA-Z0-9_.]*)":/gm)].map((m) => m[1]);
}

const source = readFileSync(REGISTRY, "utf8");
const registered = registeredKeys(source);

/* Where each literal template name appears, outside the registry itself. */
const haystack = [];
for (const path of sqlFiles(join(ROOT, "supabase", "migrations"))) {
  haystack.push([path, readFileSync(path, "utf8")]);
}
for (const path of serverFiles(join(WEB, "src", "lib"))) {
  if (path === REGISTRY) continue;
  haystack.push([path, readFileSync(path, "utf8")]);
}

const problems = [];

/* R1: a registered template nothing names. */
for (const key of registered) {
  if (DYNAMIC.has(key)) continue;
  const found = haystack.some(([, text]) => text.includes(`'${key}'`) || text.includes(`"${key}"`));
  if (!found) {
    problems.push(
      `R1 ${key}: registered in templates.ts and enqueued by nothing. Either wire a caller or take the entry out. If it is composed at runtime, add it to DYNAMIC with the live function that writes it.`,
    );
  }
}

/* R2: a template enqueued in SQL with no registry entry. */
const known = new Set(registered);
for (const [path, text] of haystack) {
  if (!path.endsWith(".sql")) continue;
  if (!path.includes(`${SEP}pending${SEP}`)) continue;
  for (const m of text.matchAll(/email_outbox_enqueue\s*\(\s*[^,()]*,\s*'([a-z][a-zA-Z0-9_.]*)'/g)) {
    if (!known.has(m[1])) {
      problems.push(
        `R2 ${m[1]}: enqueued by ${path.slice(ROOT.length + 1)} with no entry in templates.ts. The drain will DROP every row of it.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("notification reachability: not clean.\n");
  for (const line of [...new Set(problems)].sort()) console.error(`  ${line}`);
  console.error(`\n${new Set(problems).size} finding(s).`);
  process.exit(1);
}

console.log(
  `notification reachability: clean - ${registered.length} registered template(s), ${DYNAMIC.size} composed at runtime, ${haystack.length} file(s) read.`,
);
