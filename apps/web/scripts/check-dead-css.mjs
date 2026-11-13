/**
 * ===========================================================================
 * CLASS NAMES NO MARKUP CAN MATCH.
 * ===========================================================================
 *
 * WHY THIS SCRIPT EXISTS. Commit `caec1cd15` removed 109 of them and
 * described this detector in its message; the script itself never landed, so
 * the next pass had to start by rebuilding the measurement. It is here now.
 *
 * THE READING RULE THAT MAKES IT HONEST. Class names are taken from SELECTOR
 * PRELUDES only, by walking each stylesheet character by character and
 * tracking braces, strings and comments. A custom property can therefore
 * never be read as a class, because `--nf-gs-layer` only ever appears inside
 * a declaration block. That was the false positive the earlier count carried,
 * and the irony recorded in that commit is worth keeping: `.nf-gs-layer` IS a
 * dead class selector in `welcome.css` AND `--nf-gs-layer` is a live custom
 * property a component sets inline, so only a parser that keeps the two apart
 * can say either thing.
 *
 * USAGE is a whole-word lookup over every file in the repository that is not
 * build output, a dependency or a stylesheet: no word character and no hyphen
 * on either side, so `nf-post` is not counted as used by `nf-post__menu`.
 * That is deliberately generous. A name that appears in a comment, a test, a
 * doc or a string counts as used, because a runtime string can build a class
 * and this script must never be the reason one disappears.
 *
 * WHAT A HIT MEANS, and what it does not. A hit is a name that no file
 * outside the stylesheets mentions at all. It is NOT proof the rule is dead:
 * a name built by concatenation (`"nf-tab--" + kind`) is invisible to any
 * static reader, and so is one that only ever arrives from the database. So a
 * removal needs the reverse check as well, which `check-css-delivery.mjs`
 * does from the other end: it reports a class the live DOM wears that no
 * loaded rule can match. A name this script calls dead and that script never
 * sees is safe to remove; a name either script is unsure about stays.
 *
 * USAGE
 *   node scripts/check-dead-css.mjs            # the report, grouped by file
 *   node scripts/check-dead-css.mjs --budget N # exit 1 above N dead names
 *
 * It prints and exits 0 by default: the count is a number to drive down, and
 * a gate on it belongs in the lead's hands, not in a sweep's.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "apps", "web", "src");

const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  "ios",
  "android",
  "Pods",
]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".next")) continue;
    if (SKIP_DIR.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/**
 * Every class name in the SELECTOR PRELUDES of one stylesheet, with the lines
 * they appear on. Walks the text tracking depth, strings and comments, and
 * only reads names while depth says we are in a prelude rather than inside a
 * declaration block. An at-rule's own prelude (`@media`, `@supports`) is read
 * the same way, which is right: `@container (min-width: 20rem)` has no class
 * in it, and `@media (hover: hover) { .x { } }` has its class at depth 1.
 */
function classesInPreludes(text) {
  const found = new Map();
  let depth = 0;
  let i = 0;
  let line = 1;
  let prelude = "";
  let preludeLine = 1;
  const flush = () => {
    for (const match of prelude.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) {
      const name = match[1];
      if (!found.has(name)) found.set(name, preludeLine);
    }
    prelude = "";
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") line += 1;
    /* A comment, in a prelude or in a block, is never selector text. */
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const chunk = text.slice(i, end === -1 ? text.length : end + 2);
      line += (chunk.match(/\n/g) ?? []).length;
      i += chunk.length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < text.length && text[j] !== quote) {
        if (text[j] === "\\") j += 1;
        if (text[j] === "\n") line += 1;
        j += 1;
      }
      /* A quoted string inside a prelude is an attribute value, never a
         class: `[data-x=".nf-y"]` must not be read as one. */
      i = j + 1;
      continue;
    }
    if (ch === "{") {
      /* ALWAYS flush, at every depth. Nearly every rule in this product sits
         inside `@layer components { ... }`, so a version of this that only
         read depth 0 saw 378 class names in 204 stylesheets instead of
         several thousand, and reported twelve dead names out of a tree that
         has hundreds. A prelude is whatever text precedes a brace; a
         declaration never reaches here because its `;` clears it first. */
      flush();
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === "}") {
      depth = Math.max(0, depth - 1);
      prelude = "";
      i += 1;
      continue;
    }
    if (ch === ";") {
      /* An at-rule with no block (`@import`, `@layer a, b;`). */
      prelude = "";
      i += 1;
      continue;
    }
    if (prelude === "") preludeLine = line;
    prelude += ch;
    i += 1;
  }
  return found;
}

const cssFiles = walk(SRC).filter((f) => f.endsWith(".css"));
const otherFiles = walk(ROOT).filter(
  (f) => !f.endsWith(".css") && /\.(tsx?|jsx?|mjs|cjs|mdx?|json|html|svg|txt|sql|yml|yaml)$/.test(f),
);

/* Every nf- class declared, and where. */
const declared = new Map();
for (const file of cssFiles) {
  const rel = relative(ROOT, file);
  for (const [name, line] of classesInPreludes(readFileSync(file, "utf8"))) {
    if (!name.startsWith("nf-")) continue;
    if (!declared.has(name)) declared.set(name, []);
    declared.get(name).push(`${rel}:${line}`);
  }
}

/* One pass over every non-stylesheet file, collecting the nf- tokens it
   mentions as whole words. One pass rather than one regex per name: 5,000
   names over 5,000 files is 25 million searches and this is one. */
const used = new Set();
/*
 * CLASS NAMES THIS PRODUCT BUILDS AT RUNTIME, AND WHY THEY MATTER MORE THAN
 * ANYTHING ELSE IN THIS SCRIPT.
 *
 * 185 places in the source write a class as a template: `nf-act-pill--${kind}`,
 * `nf-admin-delta--${dir}`, `nf-chart__bar--s${i}`. The finished name never
 * appears in any file, so a whole-word lookup calls `.nf-act-pill--share`,
 * `.nf-admin-delta--good` and `.nf-chart__bar--s0` dead when all three are
 * live on the screen. A first run of this check reported 406 dead names and
 * about a fifth of them were that: deleting on that list would have taken
 * the colour out of every admin delta and every chart bar in the product.
 *
 * So every literal prefix that precedes a `${` is collected, and a declared
 * name that starts with one is reported apart, never as dead. It is a
 * deliberately blunt rule: `nf-chip${...}` makes every name beginning
 * `nf-chip` unprovable, which is the honest answer rather than a guess.
 */
const builtPrefixes = new Set();
for (const file of otherFiles) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!text.includes("nf-")) continue;
  for (const match of text.matchAll(/(?<![\w-])nf-[A-Za-z0-9_-]+(?![\w-])/g)) used.add(match[0]);
  for (const match of text.matchAll(/(?<![\w-])(nf-[A-Za-z0-9_-]*)\$\{/g)) builtPrefixes.add(match[1]);
}

const maybeBuilt = (name) => {
  for (const prefix of builtPrefixes) if (prefix.length > 3 && name.startsWith(prefix)) return prefix;
  return null;
};

const unmentioned = [...declared.keys()].filter((name) => !used.has(name)).sort();
const runtime = unmentioned.filter((name) => maybeBuilt(name));
const dead = unmentioned.filter((name) => !maybeBuilt(name));

const byFile = new Map();
for (const name of dead) {
  for (const place of declared.get(name)) {
    const file = place.split(":")[0];
    if (!byFile.has(file)) byFile.set(file, new Set());
    byFile.get(file).add(name);
  }
}

console.log(
  `dead css: ${declared.size} nf- class names declared in ${cssFiles.length} stylesheets, ` +
    `${used.size} nf- tokens mentioned anywhere outside them. ${unmentioned.length} are never ` +
    `mentioned: ${runtime.length} of those start with one of the ${builtPrefixes.size} prefixes the ` +
    `source builds a class from at runtime and CANNOT BE JUDGED HERE, leaving ${dead.length} ` +
    "that nothing in the repository can produce.",
);
console.log(
  "\nA NAME BELOW IS NOT AUTOMATICALLY SAFE TO DELETE. A class built at\n" +
    "runtime by concatenation, or arriving from the database, is invisible to\n" +
    "any static reader. Check each against the live DOM with\n" +
    "check-css-delivery.mjs before removing its rule, and leave anything the\n" +
    "two scripts disagree about where it is.\n",
);
for (const [file, names] of [...byFile.entries()].sort((a, b) => b[1].size - a[1].size)) {
  const list = [...names].sort();
  console.log(`  ${file}  (${list.length})`);
  console.log(`      ${list.join(", ")}`);
}

if (process.argv.includes("--runtime")) {
  console.log(`\nNEVER MENTIONED BUT POSSIBLY BUILT AT RUNTIME (${runtime.length}), left alone:`);
  for (const name of runtime) console.log(`  ${name}   (prefix ${maybeBuilt(name)})`);
}

const budgetArg = process.argv.indexOf("--budget");
if (budgetArg > -1) {
  const budget = Number(process.argv[budgetArg + 1]);
  if (Number.isFinite(budget) && dead.length > budget) {
    console.error(`\n${dead.length} dead class names, over the budget of ${budget}.\n`);
    process.exit(1);
  }
}
