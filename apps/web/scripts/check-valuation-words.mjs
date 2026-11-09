/**
 * ===========================================================================
 * THE BUILD FAILS IF THE REGULATED WORD REACHES PRODUCT CODE.
 * ===========================================================================
 *
 * Vallo is not a registered estate surveyor and valuer. Under the Estate
 * Surveyors and Valuers Act the offence is using any name, title, addition or
 * description IMPLYING authorisation to practise, so the offence is in the
 * implication and not in the arithmetic. Price Check reports what places near
 * here are ASKING, and the regulated nouns appear in exactly one place: the
 * sentence that disclaims them, in `src/lib/price-check/disclaimer.ts`.
 *
 * WHAT THIS EXISTS TO STOP, stated as the thing that would actually happen.
 * The tree already sits at that line, by accident rather than by enforcement:
 * two occurrences in `lib/legal/terms.tsx`, both inside sentences saying a
 * Vallo inspection is not one, and one occupation label naming the profession.
 * Nothing holds it there. One future commit writing "Property valuation" into
 * a page title, a push notification, a route segment or an app store listing
 * would be the regulated act, would pass every other check in this repository,
 * and would read as a nice piece of copy in review.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SCRIPT AND NOT AN ESLINT RULE, which is the obvious question.
 *
 * Three reasons and the third is decisive.
 *
 * ESLINT DOES NOT SEE EVERYTHING. The word must not appear in a ROUTE SEGMENT,
 * which is a directory name, and no linter walks directory names. It must not
 * appear in a manifest, a stylesheet class or a locale file outside the app.
 *
 * THE BUDGET IS WHOLE-TREE. "This file may carry three and no more" cannot be
 * answered from inside the file, and a rule that reads the rest of the tree at
 * module load is a rule whose result depends on state it did not declare.
 *
 * AND THE FLOOR IS THE POINT. The most valuable assertion here is not that the
 * word is absent. It is that the DISCLAIMER STILL SAYS IT. Every absence check
 * in this file is satisfied at once by a scan that walks nothing: a broken
 * glob, a renamed directory, an extension dropped from the list, and the gate
 * reports clean in a voice of total confidence. A lint rule has no way to
 * notice that it was never run over the file that mattered. This one does.
 *
 * ---------------------------------------------------------------------------
 * IT RESTATES THE RULES RATHER THAN IMPORTING THEM, ON PURPOSE.
 *
 * `src/lib/price-check/regulated-words.ts` holds the same rules in TypeScript.
 * This file is plain JavaScript and imports nothing from it, for the reason
 * `scripts/check-deep-links.mjs` gives for the same split: a build gate that
 * needs a compile step is a build gate that gets taken out of the build the
 * first morning it is in the way.
 *
 * A HAND COPY OF A RULE IS THE THING THAT DRIFTS, so
 * `src/lib/price-check/regulated-words.test.ts` RUNS this gate, over fixture
 * trees it builds itself and over the real tree, and asserts that this file's
 * verdict and the TypeScript checker's verdict agree problem for problem. It
 * does not assert that this file contains a particular string: a string in a
 * file is not a verdict, and that exact assertion is what let the deep-link
 * gate drift before it was rewritten.
 *
 * ---------------------------------------------------------------------------
 * USAGE
 *
 *   node scripts/check-valuation-words.mjs
 *       Walks the repository. Word budget, disclaimer floor and scan coverage.
 *
 *   node scripts/check-valuation-words.mjs --root <dir>
 *       Walks <dir> instead, applying the word budget ONLY. A fixture tree has
 *       no disclaimer file and no thousand files in it, so running the two
 *       floors over one would fail it for reasons that are not about the
 *       fixture. The TypeScript checker carries the same distinction under the
 *       same name, `wholeTree`.
 *
 * Exit 0 clean, exit 1 with every problem named and its line given.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/* --------------------------------------------------------------- the rules */

const REGULATED_WORDS = [
  "valuation",
  "valuations",
  "valuer",
  "valuers",
  "appraisal",
  "appraisals",
  "appraise",
  "appraised",
  "appraiser",
  "appraisers",
];

/*
 * The registered profession's own name. Naming the profession is the opposite
 * of claiming it: "only an estate surveyor and valuer may do this" is a
 * disclaimer, and an occupation picker offering the label to a user who IS one
 * is a fact about them. A phrase and not a file, so exempting the occupations
 * fixture does not exempt whatever is added to it next.
 */
const ALLOWED_PHRASE = /estate\s+surveyors?\s+and\s+valuers?/gi;

/*
 * The budget, and it is a budget rather than a blanket. "The word is allowed
 * in the disclaimer" and "the word is allowed in the file the disclaimer lives
 * in" are different rules, and only the first one is the ruling. A fourth
 * occurrence fails, and whoever wants it raises this number in a commit with
 * their name on it.
 */
const ALLOWED_FILES = {
  "apps/web/src/lib/price-check/disclaimer.ts": 3,
  "apps/web/src/lib/legal/terms.tsx": 2,
  /* The Circle professional kind `valuer` is a stored enum value naming a
     regulated profession (shown as "Estate surveyor and valuer", the
     allowed phrase), not a claim that Vallo values anything: the key in the
     kinds list and the key of the label map, nothing else. */
  "apps/web/src/lib/features/circle/model.ts": 2,
};

/* The rule's own files. The words are their subject, not their copy. */
const RULE_FILES = [
  "apps/web/src/lib/price-check/regulated-words.ts",
  "apps/web/src/lib/price-check/regulated-words.test.ts",
  "apps/web/scripts/check-valuation-words.mjs",
];

/* The disclaimer has to keep saying the word it disclaims. */
const REQUIRED_FILES = { "apps/web/src/lib/price-check/disclaimer.ts": 1 };

/* A walker that returns nothing reports clean. */
const MINIMUM_FILES_SCANNED = 300;

/* ------------------------------------------------------------- the walking */

const ARGS = process.argv.slice(2);
const rootFlag = ARGS.indexOf("--root");
const FIXTURE_ROOT = rootFlag === -1 ? null : ARGS[rootFlag + 1];
const WHOLE_TREE = FIXTURE_ROOT === null;

/* The repository root, two levels above `apps/web/scripts`. */
const REPO = fileURLToPath(new URL("../../..", import.meta.url));
const WALK_FROM = WHOLE_TREE
  ? [join(REPO, "apps", "web", "src"), join(REPO, "apps", "web", "scripts"), join(REPO, "packages")]
  : [FIXTURE_ROOT];

/*
 * Extensions carrying copy or a name a user can end up seeing. `.css` is here
 * because a class name reaches the DOM; `.json` because a manifest and an app
 * store strings file are copy; `.md` is NOT here, because documentation
 * discussing the rule is the one place the word has to be usable freely.
 */
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "ios", "android"]);

function filesUnder(dir, found = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      /*
       * A DIRECTORY NAME IS A ROUTE SEGMENT, and "the route is /price-check,
       * never /valuation" is the first line of the research file's own list of
       * places the word may not appear. It is checked here rather than in the
       * file scan because a directory has no contents to scan.
       */
      found.push({ path: repoPath(full), text: entry, isPath: true });
      filesUnder(full, found);
      continue;
    }
    if (!EXTENSIONS.some((ext) => entry.endsWith(ext))) continue;
    try {
      found.push({ path: repoPath(full), text: readFileSync(full, "utf8"), isPath: false });
    } catch {
      /* Unreadable is not clean, but it is also not a word violation. */
    }
  }
  return found;
}

function repoPath(full) {
  const base = WHOLE_TREE ? REPO : FIXTURE_ROOT;
  return relative(base, full).split(sep).join("/");
}

/* ------------------------------------------------------------- the reading */

/*
 * Comments are stripped, leaving whitespace of the same shape so line numbers
 * survive. Without this, this file, the checker, every migration header and
 * every explanation of why the rule exists would fail the rule, and a check
 * that fails on a clean checkout is a check somebody deletes rather than
 * obeys.
 *
 * It does not parse strings, so a `//` inside a string literal is treated as a
 * comment. That is the same simplification `check-css-tokens.mjs` makes, and
 * it errs towards MISSING a violation rather than inventing one, which is the
 * right direction for a gate that fails a build.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/*
 * ONE PATTERN PER WORD, AND THE TRAILING BOUNDARY DECIDED IN CODE.
 *
 * `\b(...)\b` has no boundary after "valuation" in `valuationResult`, so
 * every camelCase and snake_case identifier walked through a rule whose whole
 * job is to keep the word out of identifiers. `(?![a-z])` looked like the fix
 * and was worse: under the `i` flag `[a-z]` matches "R". One alternation
 * ordered longest first was subtler still: "ValuationSheet" matches
 * "valuations", the "h" after it is lower case, the longer alternative is
 * rejected, and the position is already consumed so "valuation" is never
 * tried there. All three were caught by
 * `src/lib/price-check/regulated-words.test.ts`, which is the point of it.
 */
function occurrencesIn(file) {
  const text = (file.isPath ? file.text : withoutComments(file.text)).replace(
    ALLOWED_PHRASE,
    (m) => " ".repeat(m.length),
  );
  /* Lower case means lower case: no `i` flag on this one, deliberately. */
  const continuesTheWord = /[a-z]/;
  const byIndex = new Map();

  for (const word of REGULATED_WORDS) {
    const pattern = new RegExp(`\\b${word}`, "gi");
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const after = text[match.index + match[0].length];
      if (after !== undefined && continuesTheWord.test(after)) continue;
      const held = byIndex.get(match.index);
      if (held === undefined || held.length < match[0].length) {
        byIndex.set(match.index, match[0]);
      }
    }
  }

  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, word]) => ({ line: text.slice(0, index).split("\n").length, word }));
}

/* ------------------------------------------------------------- the verdict */

const scanned = WALK_FROM.flatMap((dir) => filesUnder(dir));
const fileCount = scanned.filter((f) => !f.isPath).length;
const problems = [];

for (const file of scanned) {
  if (RULE_FILES.includes(file.path)) continue;
  const hits = occurrencesIn(file);
  const budget = ALLOWED_FILES[file.path] ?? 0;
  if (hits.length <= budget) continue;
  for (const hit of hits.slice(budget)) {
    problems.push({
      file: file.path,
      line: hit.line,
      what:
        budget === 0
          ? `"${hit.word}" is a regulated word and this file has no allowance for it. Price Check reports what places are ASKING.`
          : `"${hit.word}" is one occurrence too many in a file allowed ${budget}. Raise the allowance deliberately or reword this one.`,
    });
  }
}

if (WHOLE_TREE) {
  const counted = new Map();
  for (const file of scanned) counted.set(file.path, occurrencesIn(file).length);

  for (const [path, floor] of Object.entries(REQUIRED_FILES)) {
    const seen = counted.get(path);
    if (seen === undefined) {
      problems.push({
        file: path,
        line: 0,
        what: "the scan never reached this file, so the disclaimer was not checked at all. A scan that sees nothing reports clean, which is why this floor exists.",
      });
    } else if (seen < floor) {
      problems.push({
        file: path,
        line: 0,
        what: `the standing disclaimer must say the word it disclaims, and this file carries ${seen} of the ${floor} it needs.`,
      });
    }
  }

  if (fileCount < MINIMUM_FILES_SCANNED) {
    problems.push({
      file: "(the scan itself)",
      line: 0,
      what: `only ${fileCount} file(s) were scanned and a healthy tree has at least ${MINIMUM_FILES_SCANNED}. A walker that returns nothing reports clean.`,
    });
  }
}

if (problems.length > 0) {
  console.error(
    "\nTHE REGULATED WORD REACHED PRODUCT CODE.\n\n" +
      "Vallo is not a registered estate surveyor and valuer, and under the\n" +
      "Estate Surveyors and Valuers Act the offence is using any name, title,\n" +
      "addition or description IMPLYING authorisation to practise. The offence\n" +
      "is in the implication, not in the arithmetic.\n\n" +
      "Price Check reports what places near here are ASKING. The nouns to reach\n" +
      "for are an asking price range, what it is based on, how sure we are, and\n" +
      "area prices. Never value, never worth, never the regulated word.\n\n" +
      "The one permitted use is the standing disclaimer in\n" +
      "src/lib/price-check/disclaimer.ts, which is budgeted rather than blanket.\n",
  );
  for (const problem of problems) {
    console.error(`  ${problem.file}${problem.line > 0 ? `:${problem.line}` : ""}`);
    console.error(`    what: ${problem.what}`);
  }
  console.error(`\n${problems.length} problem(s).\n`);
  process.exit(1);
}

console.log(
  WHOLE_TREE
    ? `valuation words: clean - ${fileCount} files and every directory name scanned, 0 regulated words outside the budgeted disclaimer surfaces, the standing disclaimer still says the word it disclaims, and the scan reached more than the ${MINIMUM_FILES_SCANNED} file floor. It reads source text with comments stripped: it cannot see a word assembled at runtime or pulled from a database.`
    : `valuation words: clean - ${fileCount} file(s) under ${FIXTURE_ROOT}, word budget only.`,
);
