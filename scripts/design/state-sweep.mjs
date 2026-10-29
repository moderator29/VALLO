#!/usr/bin/env node
/**
 * THE STATE SWEEP (V-97): every loading, empty, offline, error and done state
 * the source can show, held to the voice rules.
 *
 *   node scripts/design/state-sweep.mjs
 *
 * WHAT IT WALKS. Every `.tsx` under `apps/web/src` that opens one of the state
 * components (`<State`, and the wrappers still migrating onto it: `<EmptyState`,
 * `<EmptyPanel`), the shared 404, and the kit's own copy in the trustVisible
 * namespace. For each call site it reads the literal props it can see.
 *
 * WHAT FAILS IT, from `apps/web/src/lib/design/voice.ts`, read as text so the
 * numbers live in one place:
 *   - a literal title over TITLE_MAX or body over BODY_MAX characters (on a
 *     wrapper still migrating, only past LEGACY_BUDGET: see the ratchet)
 *   - a banned phrase in a literal title, body or label, or on the 404
 *   - an action label that names no destination ("OK", "Continue")
 *   - a `<State kind="empty|offline|error">` with no `primary` and no `action`
 *   - fewer call sites than the floor: a sweep that walked nothing would
 *     report clean in a voice of total confidence, so walking too little fails
 *
 * WHAT IT CANNOT SEE. Copy passed as an expression (`title={t.x.y}`) is not
 * resolved here; `voice.test.ts` checks the kit's own copy through the
 * dictionary, and the call sites move onto the kit route by route. It reads
 * source text only and proves nothing about what a browser rendered.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SRC = join(ROOT, "apps/web/src");
const VOICE = readFileSync(join(SRC, "lib/design/voice.ts"), "utf8");

const TITLE_MAX = Number(/export const TITLE_MAX = (\d+)/.exec(VOICE)?.[1]);
const BODY_MAX = Number(/export const BODY_MAX = (\d+)/.exec(VOICE)?.[1]);
const BANNED = [...VOICE.matchAll(/\{ phrase: "([^"]+)", why: "([^"]+)" \}/g)].map((m) => ({ phrase: m[1], why: m[2] }));
const EMPTY_LABELS = new Set(
  [...(/EMPTY_LABELS[^=]*= new Set\(\[([^\]]+)\]/.exec(VOICE)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]),
);
const NEEDING = new Set(
  [...(/KINDS_NEEDING_AN_ACTION[^=]*= new Set\(\[([^\]]+)\]/.exec(VOICE)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]),
);
/** Fewer state call sites than this and the walk, not the copy, is broken. */
const FLOOR = 50;
/**
 * THE RATCHET. The wrappers still migrating onto the kit carry copy written
 * before the rules were: ten long titles and bodies on 24 September 2026, and
 * three after the host, agent and feed lines were rewritten the same day. The
 * three left are on the wallet screens, which are the audit session's to
 * change. They are listed, not failed, and this
 * number may only go down: a new problem on a wrapper fails the sweep, and so
 * does any problem at all on a `<State>` call site. Lower it as each is fixed.
 */
const LEGACY_BUDGET = 3;

if (!TITLE_MAX || !BODY_MAX || BANNED.length < 5 || EMPTY_LABELS.size < 3 || NEEDING.size < 2) {
  console.error("state sweep: could not read the rules from lib/design/voice.ts; the sweep would check nothing.");
  process.exit(1);
}

function banned(text) {
  const normal = text.replace(/[\u2018\u2019]/g, "'");
  return BANNED.filter(({ phrase }) => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normal));
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) out.push(path);
  }
  return out;
}

/** The text of a JSX opening tag from `start`, to its closing `>` at depth 0. */
function openingTag(source, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === quote && source[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === ">" && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

const literal = (tag, prop) => new RegExp(`\\b${prop}="([^"]*)"`).exec(tag)?.[1];
const hasProp = (tag, prop) => new RegExp(`\\b${prop}[=\\s/>]`).test(tag);
const labelsIn = (tag) => [...tag.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

const failures = [];
const legacy = [];
let sites = 0;
let literalCopy = 0;
const fail = (file, what) => failures.push(`${relative(ROOT, file)}: ${what}`);
const owe = (file, what) => legacy.push(`${relative(ROOT, file)}: ${what}`);

for (const file of walk(SRC)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/<(State|StateMoment|EmptyState|EmptyPanel)\b(?=[\s/>])/g)) {
    const tag = openingTag(source, match.index);
    sites += 1;
    /* The kit fails outright; a wrapper still migrating goes on the ratchet. */
    const report = match[1] === "State" || match[1] === "StateMoment" ? fail : owe;
    const title = literal(tag, "title");
    const body = literal(tag, "body");
    if (title !== undefined || body !== undefined) literalCopy += 1;
    if (title && title.length > TITLE_MAX) report(file, `title over ${TITLE_MAX} (${title.length}): "${title}"`);
    if (body && body.length > BODY_MAX) report(file, `body over ${BODY_MAX} (${body.length})`);
    for (const label of labelsIn(tag)) {
      if (EMPTY_LABELS.has(label.toLowerCase())) fail(file, `an action labelled "${label}" names no destination`);
    }
    for (const hit of banned(`${title ?? ""} ${body ?? ""} ${labelsIn(tag).join(" ")}`)) {
      fail(file, `"${hit.phrase}": ${hit.why}`);
    }
    if (match[1] === "State" || match[1] === "StateMoment") {
      const kind = literal(tag, "kind");
      /* A compact state is a quiet line inside a card whose own controls are the way onward. */
      if (kind && NEEDING.has(kind) && !hasProp(tag, "compact") && !hasProp(tag, "primary") && !hasProp(tag, "action") && !hasProp(tag, "actions")) {
        fail(file, `${kind === "error" || kind === "empty" || kind === "offline" ? "an" : "a"} ${kind} state with no way onward`);
      }
    }
  }
}

const notFound = join(SRC, "app/not-found.tsx");
for (const hit of banned(readFileSync(notFound, "utf8"))) fail(notFound, `"${hit.phrase}": ${hit.why}`);

const kitCopy = join(ROOT, "packages/i18n/src/locales/trust-visible.en.ts");
const stateBlock = /\n  state: \{([\s\S]*?)\n  \},/.exec(readFileSync(kitCopy, "utf8"))?.[1];
if (!stateBlock) fail(kitCopy, "the trustVisible.state copy is missing");
else {
  for (const m of stateBlock.matchAll(/(\w+):\s*"([^"]*)"/g)) {
    const [, key, text] = m;
    if (/Title$/.test(key) && text.length > TITLE_MAX) fail(kitCopy, `${key} over ${TITLE_MAX}`);
    if (/Body$/.test(key) && text.length > BODY_MAX) fail(kitCopy, `${key} over ${BODY_MAX}`);
    for (const hit of banned(text)) fail(kitCopy, `${key}: "${hit.phrase}": ${hit.why}`);
  }
}

if (legacy.length > LEGACY_BUDGET) {
  fail(SRC, `${legacy.length} long titles or bodies on wrappers still migrating, over the budget of ${LEGACY_BUDGET}: a new one was written`);
}
/*
 * EVERY ROUTE LOADING STATE ANNOUNCES THROUGH THE KIT: directly, or through a
 * shared shell that renders it (LoadingShell, and QueueSkeleton,
 * AgentScreenSkeleton, LoadingPeople, AuthScreenSkeleton, AuthWait, MoneyWait, VisitLoading and
 * HostScreenSkeleton over it). One is still its own, the
 * share door's card (`app/s/[token]`), which is builder-owned and new; it is
 * the whole of LOADING_BUDGET, and the number may only go down.
 */
const LOADING_BUDGET = 1;
const KIT_LOADERS = /\b(State|LoadingShell|QueueSkeleton|AgentScreenSkeleton|LoadingPeople|AuthScreenSkeleton|AuthWait|HostScreenSkeleton|MoneyWait|VisitLoading)\b/;
const loose = walk(join(SRC, "app")).filter((f) => f.endsWith("/loading.tsx") && !KIT_LOADERS.test(readFileSync(f, "utf8")));
if (loose.length > LOADING_BUDGET) {
  for (const f of loose) fail(f, "a loading state that does not announce through the kit");
}
if (sites < FLOOR) fail(SRC, `only ${sites} state call sites walked, under the floor of ${FLOOR}: the walk is broken`);

if (failures.length > 0) {
  console.error(`state sweep: ${failures.length} problem(s)`);
  for (const line of legacy) console.error(`  (owed) ${line}`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
for (const line of legacy) console.log(`  owed: ${line}`);
if (legacy.length < LEGACY_BUDGET) {
  console.log(`  the owed list is ${legacy.length}, under the budget of ${LEGACY_BUDGET}: lower LEGACY_BUDGET to hold the gain.`);
}
console.log(
  `state sweep: clean - ${sites} state call sites walked, ${loose.length} loading route(s) outside the kit (budget ${LOADING_BUDGET}) (${literalCopy} with literal copy), the 404 and the kit's own copy; ` +
    `titles to ${TITLE_MAX}, bodies to ${BODY_MAX}, ${BANNED.length} banned phrases, every stuck state offers a way onward. ` +
    "Copy passed as an expression is not resolved here, and none of this proves what a browser rendered.",
);
