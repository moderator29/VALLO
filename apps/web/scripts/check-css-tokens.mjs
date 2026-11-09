/**
 * ===========================================================================
 * THE SILENT FAULT FAMILY, AND WHY FIVE CHECKS LIVE IN ONE SCRIPT.
 * ===========================================================================
 *
 * This file exists because of one shape of bug, and the shape is worth naming
 * before the checks are read, because it is the only reason any of them are
 * here and it will outlive all of them.
 *
 * THE FAMILY: something in the repository ASSERTS a fact about the repository,
 * the fact is false, and nothing fails. No error, no warning, no failing test,
 * no visual difference a reviewer would look for. The assertion is believed
 * precisely because it is written down, and the more carefully it is written
 * the longer it survives.
 *
 * It is not a CSS problem. Every instance below was found in a different
 * mechanism, by a different kind of search, and only one of the five is about
 * stylesheets at all.
 *
 * ---------------------------------------------------------------------------
 * THE SIX INSTANCES FOUND SO FAR, IN THE ORDER THEY TURNED UP.
 *
 * 1. A DECLARATION NAMING A TOKEN THAT DOES NOT EXIST.
 *    `.nf-feedtabs` wrote `var(--nf-surface-glass)` and `var(--nf-blur-sm)`.
 *    Neither name has ever been defined. An unresolved `var()` with no fallback
 *    makes the WHOLE declaration invalid at computed-value time, so the track
 *    painted nothing, under a comment describing the track it painted.
 *    CAUGHT BY A MACHINE: yes, check 4 below.
 *
 * 2. A DECLARATION NAMING A TOKEN OF THE WRONG TYPE.
 *    `.nf-rows-sheet` wrote `background: var(--nf-elev-3)`. That token is a
 *    three-layer box-shadow. The name is real and correctly spelled, so check 4
 *    passed it, and the declaration was still dropped in silence: the settings
 *    sheet had a border, a radius, a shadow, an entrance animation and no fill,
 *    with the page showing through it. Confirmed in a browser afterwards at
 *    `rgba(0, 0, 0, 0)`.
 *    CAUGHT BY A MACHINE: yes, check 5 below, which exists because of it.
 *
 * 3. A CUSTOM PROPERTY DECLARED TWICE IN ONE RULE, THE LIVE COPY BEING WRONG.
 *    Five `--nf-media-*` tokens appeared twice in the same `:root`, seventeen
 *    lines apart, under a character-for-character copy of the same thirteen-line
 *    comment, with all five values different. The later copy wins, so a retune
 *    that the file's own prose describes ("every part of the building below has
 *    been lifted to match") had never once rendered.
 *    CAUGHT BY A MACHINE: yes, and it is twenty lines. Walk brace depth,
 *    collect `--*` declarations per block, report any name declared twice. Run
 *    once over `tokens.css` and all of `app/css`, it found this and nothing
 *    else. NOT YET A STANDING CHECK. It should be.
 *
 * 4. A COMMENT DESCRIBING A MECHANISM THE CODE NO LONGER HAS.
 *    Three comments stated in the present tense that brand objects carry
 *    `mix-blend-mode: multiply`. The blend mode had been deleted; only the prose
 *    survived. One of them gave ADVICE built on it: "use the approach in
 *    `.nf-page-scene`, which turns multiply off on the night theme".
 *    I reported one of these to my own coordinator as live code, in a report
 *    about this exact fault. Reading a comment and reporting it as behaviour is
 *    the failure mode, and knowing about the family does not protect you.
 *    CAUGHT BY A MACHINE: no, and probably never. A comment is prose. What
 *    helps is a convention: write history in the PAST tense and current
 *    behaviour in the present, so tense alone tells a reader which it is.
 *
 * 5. A CROSS-REFERENCE TO A FILE THAT DOES NOT EXIST.
 *    `.nf-onboarding` was introduced by "see components/site/Onboarding.tsx for
 *    the honest, localStorage-gated, reduced-motion-skipping trigger", and
 *    `.nf-status-assemble` by "see app/agents/status/StatusIcon.tsx for the
 *    honest, one-shot trigger". Neither file exists anywhere under `src`. Both
 *    were eleven and four rules of dead CSS, and both read as obviously live,
 *    because a named component is the strongest evidence a reader gets that a
 *    rule is wired up.
 *    CAUGHT BY A MACHINE: yes, easily, and nothing does it. Extract paths that
 *    look like source files from comments and stat them. Roughly thirty lines.
 *    NOT YET A STANDING CHECK. It should be.
 *
 * 6. TWO BLOCKS IN ONE FILE DESCRIBING THE SAME THING IN CONTRADICTORY TERMS.
 *    `map.css` introduced `.nf-map-pin` with "Price pins on the live map.
 *    Rendered by Leaflet divIcons." Six lines later the next block begins
 *    "Marks are ordinary React buttons projected onto the frame every frame,
 *    NOT Leaflet divIcons". Both were true statements about different eras and
 *    only one was true about the present.
 *    CAUGHT BY A MACHINE: no. This one needs a reader, and it is the argument
 *    for reading a whole file before editing part of it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE FAMILY TEACHES, WHICH IS THE TRANSFERABLE PART.
 *
 * SILENCE IS NOT EVIDENCE. Every one of the six produced exactly the signal a
 * correct repository produces: nothing. The absence of a failure is only
 * information if something was capable of failing.
 *
 * A GUARD IS AN ASSERTION TOO, SO CHECK ITS OUTPUT AND NOT ITS EXISTENCE. The
 * first draft of check 5 passed the very bug it was written for, because the
 * shadow it was looking for begins `0 2px 4px` and the pattern demanded a unit
 * on the first length. The check was green and the sheet was still transparent.
 * Separately, `withoutComments` deleted comment blocks outright, so every line
 * number this script had ever printed was wrong, by up to 187 lines. Separately
 * again, the raw-colour check reported a COUNT and no location for its whole
 * life. And the first run of check 2 returned nine violations of which two were
 * prose. None of those four would have been found by asking "does the guard
 * fire". All four were found by reading what it printed.
 *
 * THEREFORE: run every new guard against the fault that motivated it, expect
 * the failure, and read the report rather than the exit code.
 *
 * SEARCH ON WORD BOUNDARIES, NOT SUBSTRINGS. A census of unused CSS classes
 * found 54 of 232 with no call site, and three of the dead ones had survived
 * review because a substring search finds a living neighbour: `nf-dock` finds
 * `nf-dock-island`, `nf-action-bar` finds `nf-action-bar-pinned`, `nf-map-pin`
 * finds `nf-map-pin-breathe`. In each case the live thing is a whole class name
 * and not a modifier of the dead one, and in each case a reviewer checking "is
 * this used" would have got a yes.
 *
 * QUIETENING IS NOT REMOVING. Four dead things in this tree had been optimised,
 * slowed, or set to `animation: none` by somebody who had noticed they were
 * unused and fixed the cost instead of the existence. `.nf-hero-scene` was
 * tuned three separate times, each one written up, on a class nothing renders.
 * When a rule keeps coming back for tuning, the cheap question is not "how do I
 * make this cheaper", it is "what renders this".
 *
 * ---------------------------------------------------------------------------
 *
 * Layer-1 guard, raw-literal guard and unresolved-token guard for the
 * stylesheets.
 *
 * ESLint cannot see CSS, and the component stylesheets are where half the
 * platform's colour actually lives: `src/app/css/*.css` is nineteen partials
 * and `globals.css` states in its own header that nothing below it may
 * introduce a raw colour. Nothing had ever checked that claim.
 *
 * SIX CHECKS NOW, AND THEY GREW ONE AT A TIME OUT OF THE FAMILY ABOVE.
 *
 *   1  a stylesheet reading a layer-1 palette token       ADR-002
 *   2  a COMPONENT reading one, which nothing could see   ADR-002
 *   3  a raw colour literal in a stylesheet
 *   4  a var() naming a token that does not exist         instance 1
 *   5  a var() naming a token of the wrong type           instance 2
 *   6  does the whole stylesheet still parse              the worst failure
 *
 * 1, 2 and 3 are about where a value came from. 4 and 5 are about whether the
 * value can be used at all. 6 is about whether the product boots. All six are
 * here rather than in ESLint for the reason given in full below: ESLint cannot
 * see CSS.
 *
 * ---------------------------------------------------------------------------
 * 1. A LAYER-1 PALETTE TOKEN read from a stylesheet that is not the token file.
 *
 * FATAL FOR THE WHOLE OF `src/app`, and the `SOFT` predicate that used to
 * exempt the four loose stylesheets is gone with it. They are at zero.
 *
 * ---------------------------------------------------------------------------
 * 2. A RAW COLOUR LITERAL, `#0C39EF` or `rgb(...)`, in a stylesheet.
 *
 * FATAL FOR THE WHOLE OF `src/app`, in two steps, and this is the second.
 *
 * It used to be counted and not enforced anywhere, and the reasoning was
 * written here at some length: there were several hundred of them, almost all
 * white and black at an alpha, and "a check that fails on a clean checkout is a
 * check somebody deletes rather than obeys". That was correct while the number
 * was several hundred. It became fatal for `src/app/css/**` when those nineteen
 * partials reached zero, and the four loose stylesheets stayed counted because
 * their 74 literals belonged to nobody and failing a build on their behalf is
 * how a check gets deleted rather than obeyed.
 *
 * THOSE 74 ARE NOW ZERO TOO. `social-feed.css` held 64, `social.css` 7 and
 * `settings-rows.css` 3, and the useful thing about doing them was what they
 * turned out to be: the assistant post's card was painted ENTIRELY out of the
 * palette already - `rgb(12 57 239)` is `--nf-electric-400` is the glow ink, so
 * its bloom stops were the glow ladder's rungs written as numbers - and the
 * story viewer needed one extra ink tier and two washes over media, which it
 * had been hand-writing at six and seven different alphas. Four themed pairs
 * were being stated twice each, once in a default rule and once in a
 * `:root[data-theme="light"]` rule, with nothing marking them as twins.
 *
 * So the `SOFT` predicate is deleted rather than narrowed. Every stylesheet
 * under `src/app` is now held to the same line for all three checks.
 *
 * ---------------------------------------------------------------------------
 * 3. A `var(--nf-...)` REFERENCING A PROPERTY THAT IS DEFINED NOWHERE, with no
 *    fallback. FATAL for `src/app/css/**`.
 *
 * THIS IS THE CHECK THAT WOULD HAVE CAUGHT `.nf-feedtabs`, and it is worth
 * setting out what happened, because the failure mode is the point.
 *
 * `chips.css` drew the feed's segmented tab track like this:
 *
 *     background: var(--nf-surface-glass);
 *     backdrop-filter: blur(var(--nf-blur-sm));
 *
 * Neither token exists. There is no `--nf-surface-glass` and no `--nf-blur-sm`
 * in `packages/design-tokens/src/tokens.css`, and there never has been; the
 * fill is `--nf-glass-fill` and the blur ladder is `--nf-glass-blur-thin`,
 * `--nf-glass-blur` and `--nf-glass-blur-strong`. Somebody typed two plausible
 * names.
 *
 * What CSS does with an undefined custom property and no fallback is the whole
 * problem: the `var()` resolves to the guaranteed-invalid value, which makes
 * the ENTIRE DECLARATION invalid at computed-value time, which for `background`
 * means it falls back to the initial value. So the track painted TRANSPARENT
 * and the backdrop filter was dropped outright. Directly above the rule sat a
 * long comment describing "one track, three equal segments, and the live one
 * carries a solid brand pill that moves along the track". There was no track.
 * Three bare labels and a pill.
 *
 * Nothing reported it, and nothing could have. The stylesheet parses. The page
 * renders. No console warning exists for this in any browser, because an
 * unknown custom property is legal CSS - it might be set later by script, by an
 * inline style, or by a class that has not applied yet. The only signal is a
 * control that looks slightly wrong to somebody who already knew what it was
 * supposed to look like. It was found by an audit that was looking for
 * something else entirely.
 *
 * WHY THIS IS A SCRIPT CHECK AND NOT AN ESLINT RULE, which is what was
 * originally asked for.
 *
 * Two reasons, and the first is decisive on its own.
 *
 * ESLINT DOES NOT SEE CSS. The bug was in a stylesheet. An `nf/` rule walking
 * string literals in TS and TSX would not have caught this one, nor the next
 * one, because every glass surface, every chrome bar and every elevation rung
 * in this product is declared in `src/app/css/*.css`. Writing the rule where it
 * cannot look at the file the bug was in would be doing the reassuring half of
 * the job, which is the same shape of mistake as a lint rule that was named in
 * three documents and never written.
 *
 * AND RESOLUTION IS WHOLE-TREE, WHICH IS THE WRONG SHAPE FOR A LINTER. Whether
 * `var(--nf-x)` is safe cannot be answered from the file containing it. The
 * property may be defined in `tokens.css`, or declared by an `@property` block
 * in another partial, or written onto an element at runtime by a component -
 * `--nf-sheet-y` comes from `Sheet.tsx`, `--nf-rise-i` from a `home/page.tsx`
 * style prop, `--nf-tab-i` from `MobileTabBar.tsx`. ESLint lints one file at a
 * time and caches per file; a rule that reads the rest of the repository at
 * module load is a rule whose result depends on state it did not declare and
 * which goes stale the moment a token is added. This script already walks the
 * whole tree, so the answer is a set lookup rather than an architecture.
 *
 * WHAT COUNTS AS DEFINED, deliberately generously, because a false positive
 * here fails the build on working code:
 *   - a declaration anywhere in `packages/design-tokens/**\/*.css`
 *   - a declaration in any stylesheet under `src/app`
 *   - an `@property --nf-x` block in any of those
 *   - the name appearing as a quoted string anywhere in `src/**\/*.{ts,tsx}`,
 *     which covers `style={{ "--nf-x": v }}` and `el.style.setProperty("--nf-x")`
 *
 * A `var(--nf-x, something)` with a fallback is never reported, whether or not
 * `--nf-x` resolves. That is the documented way to say "this may not be set",
 * and it is what makes the declaration survive either way.
 *
 * AND IT CHECKS THE TOKEN PACKAGE ITSELF, which is where it matters most.
 *
 * Two surfaces there can go stale in silence and both are checked:
 *
 * `tokens.css` defines tokens IN TERMS OF other tokens -
 * `--nf-glass-shadow: var(--nf-elev-2)`, `--nf-font-display:
 * var(--nf-font-poppins), ...`. A typo in one of those breaks every rule
 * downstream of it and the stylesheet still parses.
 *
 * `index.ts` is a TypeScript MIRROR of the token names, as strings:
 * `contentInverse: "var(--nf-content-inverse)"`. TypeScript cannot check a
 * string against a CSS file, so deleting a token leaves the mirror compiling
 * happily and exporting a `var()` that resolves to nothing. That file's own
 * comments record it having drifted before - eight inks and five mists left
 * holding pre-rebrand purple-tinted greys, so anything drawing an SVG from it
 * painted the old brand - which is precisely this failure with a different
 * cause. This sweep would have caught the deletions the same day.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TOKENS = fileURLToPath(new URL("../../../packages/design-tokens/src", import.meta.url));
const ROOTS = ["src/app"];

const LAYER_ONE =
  /--nf-(?:ink|mist|royal|electric|cyan|crimson|emerald|rose|sky)-\d{2,3}\b/g;
const RAW_COLOUR = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?)\s*\(/g;

/** A custom property being DEFINED: `--nf-x:` or `@property --nf-x`. */
const DEFINITION = /(?:@property\s+)?(--nf-[a-z0-9-]+)\s*[:{]/g;
/** The same name written as a quoted string, which is how JS sets one. */
const JS_DEFINITION = /["'`](--nf-[a-z0-9-]+)["'`]/g;
/** `var(--nf-x` plus whatever comes next, so the fallback can be detected. */
const REFERENCE = /var\(\s*(--nf-[a-z0-9-]+)\s*([,)])/g;

/**
 * Strip /* … *\/ comments, so a note explaining a literal is not a literal.
 *
 * THE NEWLINES ARE KEPT, AND EVERY LINE NUMBER THIS FILE HAS EVER PRINTED WAS
 * WRONG WITHOUT THEM. The comments came out and the lines after them moved up
 * by however many lines the comment had been, so a violation in a file with two
 * hundred lines of prose above it was reported hundreds of lines from where it
 * is. In this codebase, where the comments are usually longer than the code,
 * the error was large enough that the number was not so much inaccurate as
 * useless: the first real report from the fourth check named line 287 for a
 * fault that is on line 474.
 *
 * Replacing each comment with its own newlines keeps every subsequent line
 * exactly where it was, and all four checks report a number somebody can open.
 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (block) => "\n".repeat((block.match(/\n/g) ?? []).length));
}

function filesUnder(dir, extensions, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".next")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) filesUnder(path, extensions, found);
    else if (extensions.some((e) => entry.endsWith(e))) found.push(path);
  }
  return found;
}

/* ------------------------------------------------------- what is defined */

const defined = new Set();

/*
 * What SHAPE each token's value is, which is the fourth check's whole basis.
 *
 * A token name says what a value is FOR. It does not say what the value IS, and
 * CSS will happily let you write one into a property that cannot take it. The
 * value is read from the token files only: those are the two surfaces where a
 * `--nf-*` is authored, and a component setting one at runtime has no static
 * value to classify, so it is left unclassified and never reported.
 *
 *   shadow     three or more space-separated lengths, or anything with `inset`
 *   gradient   contains `gradient(`
 *   colour     a hex, an rgb/hsl function, or a color-mix
 *
 * Anything else, including an alias of another token, is "unknown" and passes.
 * Following aliases would be better and is deliberately not done: an alias
 * chain crosses theme blocks, so a token can be a colour at night and an alias
 * in daylight, and a check that has to resolve the cascade to decide is a check
 * that will one day be wrong in a way nobody can read. Direct values only.
 */
const shapeOf = new Map();

function classifyValue(value) {
  const v = value.replace(/\s+/g, " ").trim();
  if (/gradient\(/.test(v)) return "gradient";
  /* A shadow layer is two or more lengths in a row, optionally after `inset`.
     A LENGTH HERE INCLUDES A BARE `0`, and leaving that out is what made the
     first draft of this check pass the very bug it was written for:
     `--nf-elev-3` begins `0 2px 4px`, so a pattern demanding a unit on the
     first length classified a three-layer shadow as "unknown" and reported
     nothing. The check was green and the sheet was still transparent. */
  const LENGTH = String.raw`(?:-?[\d.]+(?:px|rem|em)|0)`;
  if (new RegExp(String.raw`(?:^|,)\s*(?:inset\s+)?${LENGTH}\s+${LENGTH}(\s|,|$)`).test(v))
    return "shadow";
  if (/^(#|rgba?\(|hsla?\(|color-mix\()/.test(v)) return "colour";
  return "unknown";
}

/** `--nf-x: <value>;` with the value captured, across line breaks. */
const VALUED_DEFINITION = /(--nf-[a-z0-9-]+)\s*:\s*([^;{}]+);/g;

for (const file of filesUnder(TOKENS, [".css"])) {
  const source = withoutComments(readFileSync(file, "utf8"));
  for (const hit of source.matchAll(DEFINITION)) defined.add(hit[1]);
  for (const hit of source.matchAll(VALUED_DEFINITION)) {
    const shape = classifyValue(hit[2]);
    if (shape === "unknown") continue;
    /* A token declared in both theme blocks must agree with itself, and if it
       does not, this check says nothing about it rather than guessing. */
    const seen = shapeOf.get(hit[1]);
    if (seen && seen !== shape) shapeOf.set(hit[1], "unknown");
    else shapeOf.set(hit[1], shape);
  }
}
for (const dir of ROOTS) {
  for (const file of filesUnder(join(ROOT, dir), [".css"])) {
    const source = withoutComments(readFileSync(file, "utf8"));
    for (const hit of source.matchAll(DEFINITION)) defined.add(hit[1]);
  }
}
/* Components write custom properties onto elements. `--nf-sheet-y`,
   `--nf-rise-i`, `--nf-tab-i`, `--nf-undo-window` and `--nf-moment-color` all
   arrive this way and are correct; the stylesheet is the consumer, not the
   owner. Comments are not stripped here because a name inside a comment in a
   component file is still evidence the name is real. */
for (const file of filesUnder(join(ROOT, "src"), [".ts", ".tsx"])) {
  const source = readFileSync(file, "utf8");
  for (const hit of source.matchAll(JS_DEFINITION)) defined.add(hit[1]);
}

/* ------------------------------------------------------------ the checks */

const failures = [];
const componentFailures = [];
const unresolved = [];
const mistyped = [];
const dullControls = [];
/*
 * THE RAW-COLOUR CHECK USED TO REPORT A COUNT AND NOT A PLACE.
 *
 * It was `rawColours += [...matchAll].length` and the report said "3
 * literal(s)" with nothing else, which sends the reader to grep the whole of
 * `src/app` for a hex. The other three checks all name a file and a line, and
 * this one asks the most work of whoever has to act on it, because a literal is
 * the easiest of the four to have introduced by accident and the hardest to
 * find by eye. Found by running all four checks against a probe and reading
 * what each one actually printed, rather than that each one fired.
 */
const rawColours = [];

/*
 * Which properties can take which shape.
 *
 * Only the cases where the answer is unambiguous, because a check that fires on
 * something arguable gets switched off. `background` is on the colour list AND
 * accepts a gradient, so a gradient there is fine and only a shadow is wrong.
 */
const WANTS_COLOUR = new Set([
  "color",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "fill",
  "stroke",
  "caret-color",
  "text-decoration-color",
  "accent-color",
]);
const WANTS_PAINT = new Set(["background", "background-image"]);
const WANTS_SHADOW = new Set(["box-shadow", "text-shadow"]);

/*
 * `property: var(--nf-x);` alone on the right-hand side, which is the only form
 * where the token's shape IS the declaration's value. A token inside a larger
 * value may legitimately be one part of a list and is not checked.
 *
 * IT ALSO HAS TO BE ALONE ON ITS LINE, and that is a real limit rather than an
 * oversight. Every stylesheet in this tree is formatted one declaration per
 * line, so the limit costs nothing today and a single-line rule written in
 * passing would slip through it. Widening the pattern to find declarations
 * mid-line means splitting on semicolons, which means knowing which semicolons
 * are inside a `url()` or a quoted string, which is a CSS parser. The check is
 * worth having at this precision and is not worth a parser; if the formatting
 * convention ever changes, this is the line that has to change with it.
 */
const SOLE_VAR = /^\s*([a-z-]+)\s*:\s*var\(\s*(--nf-[a-z0-9-]+)\s*\)\s*;/;

/** A whole `box-shadow` / `text-shadow` declaration, value captured, across line breaks. */
const SHADOW_DECLARATION = /\b(box-shadow|text-shadow)\s*:\s*([^;{}]+);/g;

/** Split a shadow value on its top-level commas; `color-mix()` has its own. */
function topLevelLayers(value) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

function typeFault(property, token) {
  const shape = shapeOf.get(token);
  if (!shape || shape === "unknown") return null;
  if (WANTS_COLOUR.has(property) && shape !== "colour")
    return `a ${shape} value in \`${property}\`, which only takes a colour`;
  if (WANTS_PAINT.has(property) && shape === "shadow")
    return `a shadow value in \`${property}\`, which takes a colour or an image`;
  /*
   * A SHADOW PROPERTY TAKES A SHADOW, AND A BARE COLOUR IS NOT ONE.
   *
   * This clause used to read `shape === "gradient"`, which failed the case
   * nobody wrote and passed the case that actually happened eleven times.
   * `--nf-shadow-on-paper` is `rgb(18 21 26 / 0.18)`, a shadow COLOUR with a
   * shadow's NAME, and eleven light-theme rules wrote it as the whole
   * `box-shadow` value. CONFIRMED IN CHROMIUM on 22 September rather than read
   * off the grammar: `box-shadow: rgb(18 21 26 / 0.18)` computes to `none`,
   * the declaration never reaches the CSSOM, and an invalid layer takes its
   * VALID siblings down with it, so
   * `box-shadow: inset 4px 0 0 <ink>, var(--nf-shadow-on-paper)` also computes
   * to `none` and the flagged admin stat card lost the 4px rule that is its
   * flag. So the test is the positive one: anything that is not a shadow is a
   * fault here.
   */
  if (WANTS_SHADOW.has(property) && shape !== "shadow")
    return `a ${shape} value in \`${property}\`, which takes a shadow list (a bare colour is dropped by the parser, confirmed in Chromium, and it takes any valid layer beside it with it)`;
  return null;
}

for (const dir of ROOTS) {
  for (const file of filesUnder(join(ROOT, dir), [".css"])) {
    const source = withoutComments(readFileSync(file, "utf8"));
    const where = relative(ROOT, file);

    source.split("\n").forEach((line, index) => {
      for (const hit of line.matchAll(LAYER_ONE)) {
        failures.push(`${where}:${index + 1}  ${hit[0]}`);
      }
      for (const hit of line.matchAll(REFERENCE)) {
        /* A fallback is the documented way to say "this may not be set", and it
           keeps the declaration valid either way, so it is never reported. */
        if (hit[2] === ",") continue;
        if (defined.has(hit[1])) continue;
        unresolved.push(`${where}:${index + 1}  var(${hit[1]})`);
      }
      const sole = SOLE_VAR.exec(line);
      /* A shadow property's sole var() IS a one-layer list, and the layer scan
         below reports it, so reporting it here too would name every one twice. */
      if (sole && !WANTS_SHADOW.has(sole[1])) {
        const fault = typeFault(sole[1], sole[2]);
        if (fault) {
          mistyped.push(`${where}:${index + 1}  ${sole[1]}: var(${sole[2]})  -  ${fault}`);
        }
      }
    });

    /*
     * AND THE SAME FAULT INSIDE A MULTI-LAYER SHADOW LIST, WHICH IS WHERE THE
     * WORST INSTANCE OF IT LIVED AND WHERE `SOLE_VAR` CANNOT REACH.
     *
     * `SOLE_VAR` only sees `property: var(--nf-x);` alone on its line. The
     * eleventh and most expensive instance of the bare-colour shadow was
     * `admin.css:941-945`, which writes TWO layers:
     *
     *   box-shadow:
     *     inset var(--nf-admin-stat-rule) 0 0 var(--nf-admin-stat-ink),
     *     var(--nf-shadow-on-paper);
     *
     * One invalid layer invalidates the WHOLE declaration, so the first
     * layer - the 4px inset rule that IS the flagged card's flag - was dropped
     * with it. Confirmed in Chromium: that exact pair computes to `none`. A
     * check that catches ten of eleven and misses the one that loses
     * information is not the check this was written for.
     *
     * So: gather each `box-shadow` / `text-shadow` declaration whole, split it
     * on TOP-LEVEL commas only (a `color-mix(in oklab, a, b)` carries commas of
     * its own), and report any layer that is nothing but a var() whose token is
     * not a shadow. A var() that is one PART of a layer, such as the colour in
     * `0 1px 2px var(--nf-shadow-on-paper)`, is correct and is not reported.
     */
    for (const hit of source.matchAll(SHADOW_DECLARATION)) {
      const line = source.slice(0, hit.index).split("\n").length;
      for (const layer of topLevelLayers(hit[2])) {
        const lone = /^var\(\s*(--nf-[a-z0-9-]+)\s*\)$/.exec(layer.trim());
        if (!lone) continue;
        const fault = typeFault(hit[1], lone[1]);
        if (fault) {
          mistyped.push(`${where}:${line}  ${hit[1]} layer: var(${lone[1]})  -  ${fault}`);
        }
      }
    }

    /*
     * A MASK CHANNEL IS NOT A COLOUR, and this is the exception that says so.
     *
     * `mask-image: linear-gradient(transparent 0, #000 16px, ...)` uses the
     * alpha of each stop to decide what shows through. The `#000` there is not
     * painted, is never seen, and has no light twin: in both themes the only
     * thing that matters is that the stop is fully opaque. There is no token
     * for it and there should not be one, because a token named for a colour
     * that is not a colour would be read as a colour by the next person.
     *
     * Without this exception the rule was pushing authors towards the two
     * things it exists to prevent: inventing a fake token to satisfy a
     * checker, or reaching for `--nf-ink-950` in a mask, where a near-black
     * that is not quite opaque silently fades the edge of the content it is
     * supposed to reveal in full.
     *
     * The exception is narrow on purpose. It covers only the lines a
     * `mask-image` or `-webkit-mask-image` declaration actually spans, from
     * the property to its semicolon, so a literal anywhere else in the same
     * rule is still reported.
     */
    const masked = new Set();
    {
      const lines = source.split("\n");
      let inMask = false;
      lines.forEach((line, index) => {
        if (!inMask && /(^|[\s;{])(-webkit-)?mask(-image)?\s*:/.test(line)) inMask = true;
        if (inMask) {
          masked.add(index);
          if (line.includes(";")) inMask = false;
        }
      });
    }

    source.split("\n").forEach((line, index) => {
      for (const hit of line.matchAll(RAW_COLOUR)) {
        if (masked.has(index)) continue;
        rawColours.push(`${where}:${index + 1}  ${hit[0]}`);
      }
    });

  }
}

/*
 * ------------------------------- A GREY EDGE ON A RESTING CONTROL
 *
 * The neutral border family is white at 8, 11, 13 and 22 per cent. On the
 * deep navy canvas every one of those is a grey hairline, and in every
 * governing reference a resting chip, tile, plate, icon button and secondary
 * carries a BLUE outline. R1's audit of 19 September called the gap between
 * those two facts "the biggest single reason the product still does not read
 * as its renders": a screen with one lit primary and eleven grey boxes reads
 * as a prototype with one finished control.
 *
 * The sweep that fixed it is the easy half. This is the half that makes it
 * stay fixed, because the next chip somebody adds will be copied from
 * whatever chip is nearest, and for a long time that was a grey one.
 *
 * FOUR TOKENS, NOT ONE. The first version of this check watched
 * `--nf-glass-border` alone, and `.nf-chip` - the shared primitive behind the
 * bookings tabs, the host wizard's kind chips, the reviews filter and four
 * more surfaces F5 found - rested on `--nf-border-default` and walked
 * straight past it. Two greys with different names is the obvious next
 * mistake, so the whole neutral family is watched.
 *
 * WHAT COUNTS AS A CONTROL, and why it is decided from the SELECTOR.
 *
 * There is no way to know from CSS alone whether an element is interactive.
 * What there is, in this codebase, is a naming convention that has held
 * across every partial: a control is named for what it does. `__btn`,
 * `--chip`, `__tab`, `__tile`, `__toggle`, `-island`, `-pill`, `__option`.
 * A rule whose selector carries one of those, or that declares
 * `cursor: pointer`, is a control. Anything else - a divider, a section edge,
 * a scrim, a skeleton, a row of actions - keeps the hairline, because a
 * hairline is exactly right for a line that separates two things.
 *
 * AND ONLY ITS RESTING RULE, WHICH IS THE WHOLE PRECISION OF THIS CHECK.
 *
 * The first version treated `:hover`, `:active`, `:focus` and
 * `[aria-pressed]` as EVIDENCE that a rule was a control, which is true and
 * is the wrong way round: the fault the founder photographed is a resting
 * control that looks unfinished, and a state rule is not the resting state.
 * A hover that darkens toward a neutral, a focus ring that sets a border, a
 * disabled button that goes grey on purpose are legitimate, and flagging
 * thirty of them
 * is how a check gets switched off in a week - which this file's own header
 * warns about at length.
 *
 * So a state selector is EXCLUDED, and
 * what is left is exactly the fault: the edge a control wears when nothing
 * is happening to it.
 *
 * THE PARSE IS DELIBERATELY CRUDE, on the same argument `SOLE_VAR` above
 * makes for itself: brace depth and the text before `{`. It cannot see a rule
 * written inline. An over-eager report names a file and a line that a reader
 * can look at and dismiss, which is the right way round for a check to be
 * wrong.
 */
const CONTROL_SELECTOR =
  /(__btn|-btn\b|--btn|\bbtn\b|chip|__tab\b|--tab\b|__tile|-tile\b|toggle|switch|__pill|-pill\b|island|__option|__control)/;
/*
 * A STATE. NOT A THEME.
 *
 * `\[data-theme` used to sit in this list, on the argument that a designed
 * paper twin is legitimate. That was true and the conclusion drawn from it was
 * wrong: a paper twin edged in a neutral border token is the SAME defect this
 * check exists to catch, wearing the one selector the check could not see, and
 * that is how a whole theme went untested for the life of it.
 *
 * THE THEME IS GONE NOW, removed by the founder on 23 September 2026, so this
 * particular blind spot cannot recur. The paragraph stays because the lesson
 * does not depend on the theme: an exclusion added to stop a check being noisy
 * is an exclusion that hides exactly the rules nobody is looking at. Only
 * genuine STATES are in the list.
 */
const NOT_RESTING =
  /(:hover|:active|:focus|:disabled|\[aria-pressed|\[aria-current|\[aria-disabled|\[data-on\b|\[data-loading|\[disabled)/;
const BORDER_GLASS =
  /border(?:-[a-z]+)?\s*:[^;]*var\(\s*--nf-(?:glass-border|border-subtle|border-default|border-strong)\s*\)/;
const POINTER = /cursor\s*:\s*pointer/;

/*
 * THE EXCEPTIONS, KEYED ON FILE AND SELECTOR, EACH WITH ITS REASON.
 *
 * Two kinds, and they are deliberately in one list so that nobody can add to
 * it without writing which kind they are adding.
 *
 * PERMANENT: the check is wrong about these, and the reason is about
 * semantics rather than taste. (`.nf-tag-pill--neutral` and `.nf-option`
 * were listed here until R3-18 deleted both rules: neither had a consumer.)
 *
 *   `.nf-switch`, in both files that draw one, is a TRACK in its off
 *   position. Grey off and brand on is the entire semantics of a switch; a
 *   blue track would say the switch is on before anybody touched it.
 *
 * DEBT: real instances of the fault in a file this sweep did not own. They
 * are listed so the gate stays green for their owner today and so the rule is
 * already live for everything else. A LISTED ENTRY IS A JOB, NOT A RULING:
 * delete it when the edge is swept, and never add one to make a build pass.
 *
 *   `catalogue.css` (F3): the shelf sort control and two card chips. The
 *   stays render `FD3DFE84` draws those amenity chips with a soft blue
 *   outline, so all three are the same fault, not exceptions.
 */
const DULL_ALLOWED = new Set([
  "src/app/css/controls.css  .nf-switch",
  "src/app/settings-rows.css  .nf-switch",
  /*
   * The media pill (the founder's pump.fun share control, 9 November 2026):
   * a neutral capsule that leads with a round piece of media and names what it
   * picks. Its resting edge is the plain hairline, not the blue control edge,
   * because a blue outline would read as "selected" on a control whose whole
   * job is to sit quietly and show the current choice (background, account,
   * area) inside itself. The pressed and selected states DO take the blue ring.
   */
  "src/app/css/share.css  .nf-media-pill",
  /*
   * A THIRD SWITCH ENTRY LIVED HERE AND IS GONE WITH THE RULE IT EXCUSED. It
   * named `controls.css  :root[data-theme="light"] .nf-switch`, the same track
   * as the two entries above reached through its paper twin. Light mode was
   * removed on 23 September 2026 and every `[data-theme="light"]` rule in this
   * tree with it, so the selector no longer exists and an exception for it
   * would be an assertion about a rule nobody can read.
   */
  /*
   * THE THIRD SWITCH ENTRY WAS REMOVED ON 23 SEPTEMBER AND THIS NOTE IS WHAT IS
   * LEFT OF IT, because a spent exception is the same fault family as a comment
   * describing a mechanism the code no longer has.
   *
   * `light.css  :root[data-theme="light"] .nf-switch:not([aria-checked="true"])`
   * was excused here while it raised the off track's hairline from
   * `--nf-border-default` at 1.31:1 to `--nf-border-strong` at 1.61:1. Both are
   * rungs of the neutral BORDER ladder, which is why this check saw it, and
   * 1.61 was still a long way under the 3:1 boundary floor. That rule now paints
   * `--nf-content-muted`, 5.16:1 on a white card, which is the same ink the
   * thumb's own outline uses and is not a border token at all, so the check no
   * longer matches the selector and the exception had nothing left to excuse.
   * Deleting it means a future revert to a border token fires here again, which
   * is the whole point of the list.
   */
  "src/app/css/catalogue.css  .nf-shelf-sort > summary",
  "src/app/css/catalogue.css  .nf-stay-card__chip",
  "src/app/css/catalogue.css  .nf-tenancy-chip",
]);

/*
 * ONE WALKER, TWO RULES, AND THAT IS THE POINT.
 *
 * Rule 9 below asks whether a resting control wears a grey hairline. Rule 10
 * asks whether a resting control wears a capsule. They are the same question
 * about the same set of rules, so they read the same selector vocabulary,
 * the same state exclusion and the same crude brace walk, and they differ
 * only in the declaration they look for and the exception list they honour.
 *
 * Written as two functions they would have drifted: the first version of rule
 * 9 watched one border token and `.nf-chip` walked past it on a second, and
 * a second copy of this walk would acquire its own version of that mistake on
 * its own schedule. A caller passes `test` and `allowed` and nothing else.
 */
function restingControlFaults(source, where, test, allowed, permits = () => false) {
  const found = [];
  /* A stack, so `@layer components { .nf-chip { ... } }` reports `.nf-chip`
     and not the layer. Every partial in this repository is wrapped in a
     layer, so without this every report named the same six characters. */
  const stack = [];
  source.split("\n").forEach((line, index) => {
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;
    if (opens > 0) {
      stack.push({
        selector: line.slice(0, line.indexOf("{")).trim(),
        pointer: false,
        hit: -1,
      });
    }
    const top = stack[stack.length - 1];
    if (top && opens === 0) {
      if (POINTER.test(line)) top.pointer = true;
      if (test.test(line) && top.hit < 0) top.hit = index;
    }
    for (let i = 0; i < closes; i += 1) {
      const rule = stack.pop();
      if (!rule) break;
      const resting = !NOT_RESTING.test(rule.selector);
      if (
        rule.hit >= 0 &&
        resting &&
        (CONTROL_SELECTOR.test(rule.selector) || rule.pointer) &&
        !permits(rule.selector) &&
        /* Keyed on file and selector rather than on a line number, because a
           line number moves every time somebody edits above it and an
           exception that silently stops matching is worse than no exception. */
        !allowed.has(`${where}  ${rule.selector}`)
      ) {
        found.push(`${where}:${rule.hit + 1}  ${rule.selector}`);
      }
    }
  });
  return found;
}

function dullControlsIn(source, where) {
  return restingControlFaults(source, where, BORDER_GLASS, DULL_ALLOWED);
}

/* A pass of its own, after the patterns above are in scope. Same files, same
   comment stripping, so a hairline argued about in prose is never reported. */
for (const dir of ROOTS) {
  for (const file of filesUnder(join(ROOT, dir), [".css"])) {
    const source = withoutComments(readFileSync(file, "utf8"));
    for (const fault of dullControlsIn(source, relative(ROOT, file))) dullControls.push(fault);
  }
}

/*
 * ------------------------------- CHECK TEN: A CAPSULE ON A CONTROL
 *
 * THE LAW IT ENFORCES, which is a founder ruling of 19 September and is
 * written up in `docs/DESIGN_DIRECTION.md` section 1.
 *
 * Any control that carries TEXT is a ROUNDED RECTANGLE on
 * `--nf-radius-control`. Every button, chip, segment, tab, filter chip,
 * input, dock label, sheet action and admin control. Two exceptions and no
 * others: an avatar, and a bare icon button carrying no text that a governing
 * image draws round, which today is the landing nav's search glyph and
 * nothing else. `GOVERNING-landing-desktop-hero.png` has no capsule anywhere
 * in it and one circle, that glyph; `GOVERNING-chat-booking-card.png` draws
 * send, back, call and overflow as rounded squares and keeps the circle for
 * avatars.
 *
 * WHY IT IS A CHECK AND NOT A SWEEP. The capsule was never a decision
 * anybody took per control. `tokens.css` records it: `--nf-radius-pill` was
 * for a long time the only token name that meant "a control", so every button
 * and chip became a 999px capsule by having nowhere else to point. A sweep
 * fixes today's call sites. It does not fix the next chip, which will be
 * copied from whatever chip is nearest, and this rule exists so that the
 * nearest chip can never again be a capsule.
 *
 * IT DECIDES "CONTROL" EXACTLY AS CHECK NINE DOES, through the same
 * `restingControlFaults` walk: the same `CONTROL_SELECTOR` vocabulary, the
 * same `cursor: pointer` fallback, the same `NOT_RESTING` exclusion of state
 * and paper-twin selectors. A second vocabulary for the same question is how
 * two checks come to disagree about what a control is, and check nine already
 * learned that lesson once when it watched a single border token and `.nf-chip`
 * rested on a different one.
 *
 * WHAT A PILL RADIUS IS, for this check: `var(--nf-radius-pill)`,
 * `var(--nf-radius-control-pill)`, and a literal `999px` or `9999px`.
 *
 * `50%` AND `--nf-radius-circle` ARE NOT REPORTED, deliberately. That is how
 * an avatar, a status dot and a count badge are drawn and they are correct as
 * circles; the ruling's own words are that a dot, a spinner, a progress ring,
 * an avatar ring and a story ring are not controls. A circle token on a rule
 * whose selector carries a control word is the one hole left open here, and it
 * is open because closing it would fire on every avatar in the tree.
 *
 * AND IT RUNS OVER TSX TOO, which is new for a shape rule and is where the
 * sweep that motivated it did most of its work. There the question "is this a
 * control" has a better answer than a selector: the radius is written in the
 * opening tag of an element, and the element has a NAME. A `rounded-full` in
 * the opening tag of a `button`, `a`, `Link`, `input`, `select`, `textarea`,
 * `summary`, `Button`, `ButtonLink` or `Chip` is a capsule on a control. The
 * same class on a `span` or a `div` is not reported, because that is an
 * avatar, a dot, a bar, a ring or a skeleton nine times in ten and this check
 * would be switched off inside a week if it said otherwise.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS RULE CANNOT SEE, AND IT IS MORE THAN THE OTHERS CANNOT SEE.
 *
 * THIS SCRIPT GREPS SOURCE TEXT. IT CANNOT PROVE WHAT THE BROWSER RESOLVED.
 * That sentence belongs at the top of this file rather than in one check, and
 * it is here because it was paid for today: a single unlayered
 * `* { border-color: ... }` in `base.css` was outranking every layered brand
 * edge in the product, and every check in this file passed the whole time,
 * correctly, because the source text each of them reads was right. Cascade,
 * layer order, specificity and inheritance are all invisible here. A green run
 * of this file means the text is right. It does not mean the screen is.
 *
 * So, specifically, this check does not see:
 *
 *   A RADIUS THAT ARRIVES FROM SOMEWHERE ELSE. `<button className="nf-chip">`
 *   is reported only if `.nf-chip` itself is caught in the stylesheet pass.
 *   A capsule reaching a control through a shared class, a cascade, an inline
 *   style computed at runtime, or a `style` prop holding a variable, is
 *   outside it.
 *
 *   WHETHER THE CONTROL CARRIES TEXT. The ruling's line is drawn at text and
 *   this check is drawn at controls, which is the wider set. An icon-only
 *   button written as a circle is reported. That is deliberate: the two
 *   exceptions the ruling allows are an avatar and one nav glyph, both of
 *   which are drawn in CSS on rules that name them, so a TSX control asking
 *   for a capsule is a fault every time so far. If a genuine round icon
 *   control ever needs to live in TSX, it goes in `PILL_ALLOWED_TSX` below
 *   with its reason, and the reason has to name the governing image.
 *
 *   A RULE WRITTEN INLINE, on one line with its selector, or a selector split
 *   across lines. Same crude brace walk as check nine, same argument for it.
 *
 *   A `shape="pill"` PROP. `Button`, `Chip` and `StatusPill` each still carry
 *   one, and it maps to a class rather than to a radius, so nothing here can
 *   read it. All three are marked `@deprecated` and no surface outside
 *   `app/(dev)/preview/g1/` passes one; what closes that door properly is this
 *   check firing on `nf-btn--pill` and `nf-chip--pill` in the stylesheets, and
 *   their owners deleting the rules.
 */
const PILL_RADIUS =
  /border(?:-[a-z]+)*-radius\s*:[^;]*(?:var\(\s*--nf-radius-(?:pill|control-pill|button|segment)\s*\)|\b9{3,4}px\b)/;

/*
 * THE BUTTON IS THE ONE CONTROL ALLOWED A CAPSULE (founder references 44 and
 * 45, 30 September 2026; CLEAN_UNIFIED_DIRECTION.md section 17: "the capsule
 * ban on controls is lifted for buttons"). A rule is a BUTTON rule when every
 * selector in its list ends on a compound that names `.nf-btn` or one of its
 * variants (`.nf-btn--primary`, `.nf-btn--sm`, ...), never an element of it
 * (`.nf-btn__label`) and never a chip, tab, field or segment that happens to
 * sit near one. `--nf-radius-button` counts as a pill radius above, so the
 * button's own token cannot be borrowed by a chip without this check firing.
 * Every other control keeps the rule exactly as it was.
 */
const BUTTON_COMPOUND = /\.nf-btn(?:--[a-z0-9-]+)?(?![a-z0-9_-])/;
function isButtonRule(selector) {
  return selector
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .every((part) => {
      const compounds = part.split(/\s+|\s*[>+~]\s*/).filter(Boolean);
      const last = compounds[compounds.length - 1] ?? "";
      return BUTTON_COMPOUND.test(last) && !/\.nf-btn__/.test(last);
    });
}

/*
 * THE EXCEPTIONS, keyed on file and selector, each with its reason, exactly as
 * check nine's are and for the same reason: nobody can add one without saying
 * which kind it is.
 *
 * PERMANENT: the check is wrong about these. A capsule is the SHAPE of the
 * object rather than a decision about a control, which is the distinction the
 * ruling itself draws when it says a dot, a spinner, a progress ring and a
 * story ring are not controls.
 *
 * DEBT: a real capsule on a real control, in a stylesheet this sweep did not
 * own. Listed so the gate stays green for its owner tonight and so the rule is
 * live for everything else. A LISTED ENTRY IS A JOB, NOT A RULING: delete it
 * when the control is squared off, and never add one to make a build pass.
 */
const PILL_ALLOWED = new Set([
  /*
   * PERMANENT, by founder directive D2 of 5 October 2026, which supersedes the
   * 19 September ruling for this one role: "the pill is reserved for chips,
   * filters, SEGMENTED CONTROLS and circular icon controls, so that seeing a
   * pill tells a person the thing is selectable" (north star 5A, the
   * segmented role: pill track, pill thumb). The segmented control's radius is
   * its own token, `--nf-radius-segment`, which PILL_RADIUS now recognises, so
   * this permission is enforced and visible rather than passing unseen. Every
   * other control keeps the rectangle.
   */
  "src/app/css/chips.css  .nf-segmented--pill",
  /*
   * PERMANENT, by the founder's Plasma ruling D74 of 7 October 2026
   * (`docs/design/references/2026-10-07/GOVERNING-plasma-rewards-platinum.jpg`,
   * `-tiers-cards.jpg`, `-withdraw-anytime.jpg`): the one primary action on an
   * explainer or a payoff is "the capsule with a reflection", a full-width
   * capsule with a mirrored glow on the floor beneath it, one per screen
   * (PREMIUM-STANDARD.md, "The governing level"). Every other control keeps
   * the rectangle.
   */
  "src/app/css/premium-moments.css  .nf-capsule",
  /* PERMANENT, the same D74 ruling: the invite's share moment is one white
     capsule with a round green button at its end
     (`docs/design/references/2026-10-07/invite-ready-pill.jpg`). */
  "src/app/css/money-layer.css  .nf-ready__pill",
  /*
   * PERMANENT. The dock island is 56px square, holds one glyph and carries no
   * word, so it is the ruling's second exception: a bare icon button, the same
   * species as the landing nav's search glyph. Its own rule in `chrome.css`
   * says so in a comment written when the ruling landed, and the bar it sits
   * beside, `.nf-tabbar`, is a rounded rectangle.
   */
  "src/app/css/chrome.css  .nf-dock-island",
  /*
   * PERMANENT, by founder directive D72 of 7 October 2026 and his feed
   * reference (PREMIUM-STANDARD.md reference 2): "under the post, the action
   * row is four separate dark capsules (reply with count, repost, like with
   * count, bookmark) and a round share button, each a soft charcoal pill
   * with a thin outline icon and a tabular count. That is the feed's action
   * row." A glyph and a number, never a word, on the segment role's token.
   */
  "src/app/social-feed.css  .nf-act-pill",
  /*
   * PERMANENT, by founder directive of 9 November 2026 from the pump.fun share
   * surface: the share composer's controls are capsules. The media pill (the
   * "Background" button: a round piece of media, a label, room for a chevron
   * or a toggle) is one he asked for "in many places", so it is a named
   * control family, not a one-off. The capsule tells a person it is a picker,
   * the same signal the chip and the segment give. Every other control keeps
   * the rectangle.
   */
  "src/app/css/share.css  .nf-media-pill",
  "src/app/css/share.css  .nf-share-card__handle",
  /*
   * PERMANENT, and it is the SAME OBJECT as the one `PILL_ALLOWED_TSX` already
   * excuses below: `components/ui/Switch.tsx` is a switch track drawn as a
   * capsule, and this is the settings hub's copy of it, reached through its
   * stylesheet instead of through a component.
   *
   * The exemption list in `DESIGN_DIRECTION.md` section 1.4 names this object
   * in terms - "a dot, a spinner, a progress bar, a range track, a sheet grip,
   * A SWITCH TRACK AND KNOB, an avatar ring, a story ring and a skeleton
   * placeholder are SHAPES and not controls, and this law does not reach them"
   * - so the capsule is the shape of the object and not a decision about a
   * control. The track carries no text; the word beside it is a label element.
   *
   * IT ARRIVED HERE FROM `--nf-radius-control`, which measured 50 x 30 with
   * 14px of corner on a production page: ratio 0.467, two pixels of flat edge,
   * a capsule that missed. Matching `Switch.tsx` is what removes the second
   * drawing of one object, and THIS LINE IS A RECORD OF A PERMITTED SHAPE,
   * NOT AN EXCEPTION BOUGHT TO MAKE A BUILD PASS. Nothing is being silenced:
   * delete it only if the direction ever stops naming a switch track.
   */
  "src/app/settings-rows.css  .nf-switch",
  /*
   * PERMANENT, by the founder's Track M ruling of 25 September 2026: the
   * dock is the pump.fun capsule, a true pill, and the highlight that travels
   * inside it carries no word, only a glyph. It follows the capsule's shape
   * the way the island beside it does.
   */
  "src/app/css/shell-m.css  .nf-tabbar__pill",
  /*
   * PERMANENT, by the founder's Slate ruling of 29 September 2026: the doors
   * (sign in, sign up, the reset, first run's intro, the passcode screen) are
   * rebuilt to `docs/design/references/2026-09-29/12-slate-login-empty.png`
   * and `14-slate-login-typing.png`, "98% close", and the governing image's
   * primary action is a full-width capsule. One rule, the shared Slate pill
   * in `auth.css`; every other control on those screens (the fields, the
   * language control) stays on the control radius.
   */
  "src/app/css/auth.css  .nf-slate .nf-slate-pill.nf-btn",
  /*
   * PERMANENT, by section 17 (buttons are full pills): the listing review's
   * Approve, Ask for more and Reject are buttons drawn by the review desk's
   * own class (`nf-rv-btn`, review.css) rather than `.nf-btn`, so the button
   * test above cannot see them. They are buttons; nothing else wears it.
   */
  "src/app/admin/_review/review.css  .nf-rv-btn",
  /*
   * PERMANENT, by D81 (8 October 2026), which supersedes D80's glass
   * capsules: the founder's governing Wallet
   * (`docs/design/references/2026-10-08/GOVERNING-wallet-overview-transactions.png`,
   * the right-hand phone). Its Overview | Transactions tabs are the
   * segmented role (a pill track, a pill thumb, D2), and its filter chips
   * (All, Received, Sent, Withdrawals), the move-money screens' quick amounts
   * and reason chips are the chip role D2 reserves the pill for. The two
   * bottom capsules (Withdraw, Send), Add money on the card and the banner's
   * Learn more are buttons drawn by the Wallet's own classes rather than
   * `.nf-btn`, which is why the button test above cannot see them.
   */
  "src/app/css/money-wallet.css  .nf-mw-tabs__tab",
  "src/app/css/money-wallet.css  .nf-mw-chip",
  "src/app/css/money-wallet.css  .nf-mw-cap",
  "src/app/css/money-wallet.css  .nf-mw-add",
  "src/app/css/money-wallet.css  .nf-mw-banner__cta",
  /*
   * PERMANENT, by the founder's video calling brief of 8 October 2026
   * (`docs/video-calling/BRIEF.md`, phase 2 and phase 11: "premium incoming
   * and outgoing screens ... elegant controls ... camera and microphone
   * controls; camera switch; speaker; end call") and D2's own words: the pill
   * is reserved for "circular icon controls". Every call control (accept,
   * decline, end, mute, camera, switch, output) is a 56 to 72px round button
   * holding ONE glyph and no word; its caption is a separate element under
   * it. This is the round icon control every phone's call screen draws, and
   * the reason it is visible here rather than drawn with the circle token,
   * which this check does not read: a permission said out loud. Nothing else
   * in `calls.css` wears a capsule.
   */
  "src/app/css/calls.css  .nf-call-btn",
]);

/* The TSX half of the same list, and it has one entry. The two round things
   the ruling allows, the avatar and the landing nav's search glyph, are both
   drawn in CSS on rules that name them, so a TSX entry has to argue for itself
   on other grounds. */
const PILL_ALLOWED_TSX = new Set([
  /*
   * PERMANENT, and it is the same object check nine already excuses as
   * `.nf-switch` in DULL_ALLOWED, reached through its component instead of
   * through its stylesheet. This `button` is a switch TRACK: `role="switch"`,
   * a thumb that travels along it, and a capsule is what a track IS. A
   * rectangle here would not be a squarer control, it would be a different
   * object. The word beside a switch is a label element, not the control.
   */
  "src/components/ui/Switch.tsx  <button> nf-switch",
]);

const pillControls = [];

for (const dir of ROOTS) {
  for (const file of filesUnder(join(ROOT, dir), [".css"])) {
    const source = withoutComments(readFileSync(file, "utf8"));
    const where = relative(ROOT, file);
    for (const fault of restingControlFaults(source, where, PILL_RADIUS, PILL_ALLOWED, isButtonRule)) {
      pillControls.push(fault);
    }
  }
}

/*
 * The TSX half. A pill radius written in the OPENING TAG of a control element.
 *
 * The scan walks the file once and, at every `<Name`, reads forward to that
 * tag's own `>`, skipping any `>` inside a string or inside braces, because
 * `onClick={() => f()}` and `style={{ ... }}` both contain one and a naive
 * scan ends the tag in the middle of its attributes. What is between the two
 * is the element's attributes and nothing else, so a match inside it belongs
 * to that element rather than to a neighbour, which is the whole reason this
 * is a small state machine rather than "walk back fifteen lines and hope".
 */
const CONTROL_TAG =
  /^(?:button|a|input|select|textarea|summary|option|Link|Button|ButtonLink|Chip)$/;
const PILL_IN_TSX =
  /\brounded-full\b|rounded-\[\s*(?:var\(\s*--nf-radius-(?:pill|control-pill)\s*\)|9{3,4}px)\s*\]|borderRadius\s*:\s*["'`]\s*(?:9{3,4}px|var\(\s*--nf-radius-(?:pill|control-pill)\s*\))\s*["'`]/;

function pillControlsInTsx(source, where) {
  const found = [];
  const lineStarts = [0];
  for (let k = 0; k < source.length; k += 1) if (source[k] === "\n") lineStarts.push(k + 1);
  const lineAt = (offset) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  let i = 0;
  while (i < source.length) {
    if (source[i] !== "<" || !/[A-Za-z]/.test(source[i + 1] ?? "")) {
      i += 1;
      continue;
    }
    const name = /^<([A-Za-z][A-Za-z0-9_.]*)/.exec(source.slice(i, i + 64));
    if (!name) {
      i += 1;
      continue;
    }
    let j = i + name[0].length;
    let depth = 0;
    let quote = null;
    while (j < source.length) {
      const c = source[j];
      if (quote) {
        if (c === "\\") {
          j += 2;
          continue;
        }
        /* A `"` or `'` attribute string never contains a newline, so a
           newline ends it. Without this one line a single unbalanced quote
           anywhere runs the scan to the end of the file and reports the wrong
           element: the first run of this check printed `<input>` for a `<span>`
           nine hundred lines further down. A template literal is allowed to
           span lines and is not reset. */
        if (c === "\n" && quote !== "`") quote = null;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") {
        quote = c;
      } else if (c === "{") {
        depth += 1;
      } else if (c === "}") {
        depth -= 1;
      } else if (c === ">" && depth === 0) {
        break;
      }
      j += 1;
    }
    const attributes = source.slice(i, j);
    if (CONTROL_TAG.test(name[1])) {
      const hit = PILL_IN_TSX.exec(attributes);
      /* The element's first `nf-` class, so an exception can name ONE control
         in a file rather than every control of that tag in it. A line number
         would have been the precise key and it moves the moment somebody edits
         above it, which is the argument check nine's exception list already
         makes for itself. An element with no `nf-` class keys on its tag alone,
         which is coarser, and an exception for one of those has to say so. */
      const marker = /\bnf-[a-z0-9-]+/.exec(attributes)?.[0] ?? "";
      const key = `${where}  <${name[1]}> ${marker}`.trimEnd();
      /* Section 17: a button may be a pill, so the shared `Button` and
         `ButtonLink`, and a hand-written element whose first class is the
         button's own, are left alone. Chips, fields and links are not. */
      const isButton = name[1] === "Button" || name[1] === "ButtonLink" || marker === "nf-btn";
      if (hit && !isButton && !PILL_ALLOWED_TSX.has(key)) {
        found.push(`${where}:${lineAt(i + hit.index)}  <${name[1]}> ${marker}  ${hit[0].trim()}`);
      }
    }
    i = j + 1;
  }
  return found;
}

for (const file of filesUnder(join(ROOT, "src"), [".tsx"])) {
  const source = withoutJsComments(readFileSync(file, "utf8"));
  for (const fault of pillControlsInTsx(source, relative(ROOT, file))) pillControls.push(fault);
}

/*
 * LAYER 1 READ FROM A COMPONENT, which no guard in this repository could see
 * until today.
 *
 * The check above has always run over stylesheets only. `nf/no-raw-colour`
 * catches a literal in a component and has nothing to say about a token name.
 * So ADR-002 was enforced in CSS and unenforced in TSX, which is where most of
 * the product's colour decisions are actually written, and seven components had
 * been reading the raw ramps directly for long enough that one of them carries a
 * comment saying so: `app/agent/list/ListingWizard.tsx` notes that reading
 * `--nf-electric-300` "is the one thing ADR-002 forbids". Somebody knew, wrote
 * it down beside the code, and nothing turned that into a failing check.
 *
 * It was found as a side effect of proposing a rename, not by looking. That is
 * the argument for the check rather than for fixing the seven: a rule enforced
 * on one file type and not the other is not a rule, it is a habit that holds
 * wherever somebody happens to be looking.
 *
 * ONLY `var(--nf-x)` COUNTS, not the bare name. This codebase explains itself by
 * quoting the token it replaced, so a name inside a backtick is evidence of an
 * argument rather than of a reference, and a check that punished that would be
 * switched off within a week. The same reasoning is why the three `nf/` lint
 * rules walk the AST instead of the source.
 *
 * AND COMMENTS HAD TO BE STRIPPED, WHICH THE FIRST RUN OF THIS CHECK PROVED
 * RATHER THAN THE FIRST DRAFT PREDICTING IT. The paragraph above was written
 * before the check ran and it says a name in a comment is not a reference. It
 * was not enough: this file's comments quote the FULL `var(--nf-cyan-400)` form
 * while explaining a token chain, because that is how you write down what a
 * token resolves to. Nine violations came back and two were prose, in
 * `admin/_components/ui.tsx` and `components/app/ResultSheet.tsx`, both of them
 * notes arguing that `--nf-state-warning` and `--nf-status-pending` are the same
 * value under two names.
 *
 * 22 per cent noise on the first run of a check whose whole purpose is to be
 * believed. It was caught by reading what the check PRINTED rather than
 * confirming that it printed something, which is the one habit this file is
 * worth reading for.
 *
 * The stripping is deliberately conservative: block comments, and lines whose
 * first non-space character is `//` or `*`. It will not catch a `var()` in a
 * trailing comment after code on the same line. That is rare, and the failure
 * mode is a visible false positive that the reader can see is prose, which is
 * the right way round for a check to be wrong.
 */
/*
 * AND `accept="image/*"` USED TO SWALLOW NINE HUNDRED LINES OF A COMPONENT.
 *
 * The first version opened a block comment at any `/*`. `ListingWizard.tsx`
 * writes `accept="image/*"` on its file input, so the stripper opened a
 * comment inside a string literal and closed it at the next real `*\/`, which
 * was 900 lines later. Everything between was blanked, so check 2 could not
 * have reported a layer-1 token anywhere in it, and nothing said so: the
 * check ran, printed nothing, and the silence read as a pass. That is this
 * file's own fault family, in this file's own helper, and it was found by
 * check 10 printing a `<input>` for a `<span>` and the report being read
 * rather than counted.
 *
 * A comment opener is now one that FOLLOWS nothing, whitespace, or an opening
 * bracket, comma, semicolon, colon or `=`. A `/*` that follows a word
 * character, which is what a glob in a MIME type or a URL looks like, is not
 * a comment. The captured character is put back so offsets do not move.
 */
function withoutJsComments(source) {
  return source
    .replace(/(^|[\s({[,;:=])\/\*[\s\S]*?\*\//g, (block, before) =>
      before + "\n".repeat((block.match(/\n/g) ?? []).length),
    )
    .split("\n")
    .map((line) => (/^\s*(\/\/|\*)/.test(line) ? "" : line))
    .join("\n");
}

for (const file of filesUnder(join(ROOT, "src"), [".ts", ".tsx"])) {
  const source = withoutJsComments(readFileSync(file, "utf8"));
  const where = relative(ROOT, file);
  source.split("\n").forEach((line, index) => {
    for (const hit of line.matchAll(/var\(\s*(--nf-(?:ink|mist|royal|electric|cyan|crimson|emerald|rose|sky)-\d{2,3})\s*[,)]/g)) {
      componentFailures.push(`${where}:${index + 1}  var(${hit[1]})`);
    }
  });
}

/*
 * The token package's own two surfaces. Fatal without exception: this IS the
 * design system, and a token that resolves to nothing here is wrong everywhere
 * downstream at once. `index.ts` is scanned WITHOUT stripping comments, because
 * a token name quoted in a comment there is still a claim about what exists.
 */
for (const file of filesUnder(TOKENS, [".css", ".ts"])) {
  const isCss = file.endsWith(".css");
  const source = isCss ? withoutComments(readFileSync(file, "utf8")) : readFileSync(file, "utf8");
  const where = relative(ROOT, file);
  source.split("\n").forEach((line, index) => {
    for (const hit of line.matchAll(REFERENCE)) {
      if (hit[2] === ",") continue;
      if (defined.has(hit[1])) continue;
      unresolved.push(`${where}:${index + 1}  var(${hit[1]})`);
    }
  });
}

/*
 * CHECK SEVEN: THE SAME CUSTOM PROPERTY DECLARED TWICE IN ONE RULE.
 *
 * Instance 3 of the family at the top of this file. Five `--nf-media-*` tokens
 * appeared twice in the same `:root`, seventeen lines apart, under a
 * character-for-character copy of the same thirteen-line comment, with all five
 * values different. Later declaration wins, so a retune that the file's own
 * prose describes had never once rendered, and the values that DID paint were
 * the ones the prose calls wrong.
 *
 * Nothing warns about it. A repeated custom property is legal CSS, `tokens.css`
 * is two and a half thousand lines, and a duplicated comment makes the second
 * block look like the first at a glance rather than like a second definition of
 * it.
 *
 * PER RULE, NOT PER FILE, and that is the whole difficulty. `--nf-surface-canvas`
 * is declared in the night `:root` and again in the daylight block, which is the
 * theming mechanism and is correct; declared twice in ONE of them, it is a bug.
 * So this walks brace depth and keys by the block a declaration sits in.
 *
 * `@media` and `@supports` wrappers count as blocks of their own, which is
 * conservative in the right direction: a token redeclared inside a media query
 * is a deliberate override of the rule outside it, and this will not report it.
 */
const duplicates = [];

for (const file of [...filesUnder(TOKENS, [".css"]), ...ROOTS.flatMap((dir) => filesUnder(join(ROOT, dir), [".css"]))]) {
  const source = withoutComments(readFileSync(file, "utf8"));
  const where = relative(ROOT, file);
  /* One entry per open brace, holding what that block has declared so far. */
  const stack = [];
  let buffer = "";
  let line = 1;
  for (const character of source) {
    if (character === "\n") line += 1;
    if (character === "{") {
      stack.push(new Map());
      buffer = "";
    } else if (character === "}") {
      stack.pop();
      buffer = "";
    } else if (character === ";") {
      const match = /^\s*(--nf-[a-z0-9-]+)\s*:/.exec(buffer);
      const block = stack[stack.length - 1];
      if (match && block) {
        const first = block.get(match[1]);
        if (first === undefined) block.set(match[1], line);
        else duplicates.push(`${where}  ${match[1]}  declared at line ${first} and again at line ${line}`);
      }
      buffer = "";
    } else {
      buffer += character;
    }
  }
}

/*
 * CHECK EIGHT: A COMMENT POINTING AT A SOURCE FILE THAT DOES NOT EXIST.
 *
 * Instance 5, and it is the one that cost the most. `.nf-onboarding` was
 * introduced by "see components/site/Onboarding.tsx for the honest,
 * localStorage-gated, reduced-motion-skipping trigger" and `.nf-status-assemble`
 * by "see app/agents/status/StatusIcon.tsx for the honest, one-shot trigger".
 * Neither file has ever existed. Between them they vouched for fifteen rules of
 * dead CSS, and both read as obviously live, because a named component is the
 * strongest evidence a reader gets that a rule is wired up. Both were written by
 * somebody describing a file they were about to create.
 *
 * WHAT COUNTS AS A PATH. A slash, and an extension this repository actually
 * uses. That is deliberately narrow: `BRIEF section 2.3` and `inbox item
 * 226` are references to things outside the tree and are none of this check's
 * business, and a check that reported them would be switched off in a week.
 *
 * WHERE IT LOOKS. A comment writes the path from wherever the author was
 * standing, so `components/ui/Field.tsx`, `src/app/css/glass.css` and
 * `apps/web/scripts/check-css-tokens.mjs` all appear and all are real. Each
 * candidate is tried against every plausible root and only reported if NONE of
 * them resolve. A false negative here costs nothing; a false positive costs the
 * check its credibility.
 */
const missingPaths = [];
const PATH_ROOTS = [
  join(ROOT, "src"),
  ROOT,
  join(ROOT, ".."),
  join(ROOT, "../.."),
  join(ROOT, "src/app"),
  /*
   * THE LAST THREE WERE THE DIFFERENCE BETWEEN A CHECK AND A NUISANCE, and the
   * first run proved it: 14 hits of which 5 were real files written from where
   * the author was standing. `light.css` says `ui/ActionBar.tsx`,
   * `UiIcon.tsx` says `wallet/BalanceCard.tsx`, `lib/email/listings.ts` says
   * `email/recipients.ts`. All three exist; none of them resolve from `src`.
   *
   * The fix is a longer root list and not a looser pattern, which is the same
   * shape as stripping comments out of the layer-1 scan: an incomplete resolver
   * is a bug in the check, and lowering the bar to hide it would have thrown
   * away the real findings with the noise.
   */
  join(ROOT, "src/components"),
  join(ROOT, "src/components/app"),
  join(ROOT, "src/lib"),
  join(ROOT, "src/design-system"),
];
const PATH_IN_PROSE = /(?:^|[\s"'`(\[])((?:[\w.-]+\/)+[\w.-]+\.(?:tsx?|css|mjs|json))/g;

function commentsOf(source, isCss) {
  const blocks = [...source.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => m[0]);
  if (isCss) return blocks;
  return blocks.concat(
    source.split("\n").filter((l) => /^\s*\/\//.test(l)),
  );
}

for (const file of [
  ...filesUnder(TOKENS, [".css"]),
  ...ROOTS.flatMap((dir) => filesUnder(join(ROOT, dir), [".css"])),
  ...filesUnder(join(ROOT, "src"), [".ts", ".tsx"]),
]) {
  const source = readFileSync(file, "utf8");
  const where = relative(ROOT, file);
  const seen = new Set();
  for (const comment of commentsOf(source, file.endsWith(".css"))) {
    for (const hit of comment.matchAll(PATH_IN_PROSE)) {
      const candidate = hit[1];
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      /*
       * THE FILE'S OWN DIRECTORY IS TRIED FIRST, AND LEAVING IT OUT IS WHAT
       * MADE THIS CHECK RED ON MAIN FOR NOTHING.
       *
       * The note above says a comment writes the path from wherever the author
       * was standing, and then lists eight roots, none of which is the place
       * the author was ACTUALLY standing: the directory of the file they were
       * writing in. So `./x.ts` and `../x.tsx`, the two spellings that say
       * "relative to me" out loud, were the only two this resolver could not
       * follow.
       *
       * It reported exactly two paths on main, and BOTH WERE REAL FILES:
       * `../page.tsx` from `app/(app)/crypto/[id]/page.tsx`, which is
       * `app/(app)/crypto/page.tsx`, and `./blocks-copy.ts` from
       * `lib/safety/blocks-actions.ts`, which is `lib/safety/blocks-copy.ts`.
       * Both sitting there, both named correctly by their authors.
       *
       * THIS IS THE SAME FAULT AS THE DAY'S OTHERS, WEARING THE OPPOSITE
       * COLOUR. A check that cannot see what it reports on is worthless green
       * or red: green it misses faults, red it manufactures them, and a red
       * that is always wrong gets switched off, after which it misses faults
       * too. `npm run lint --workspace @vallo/web` runs this script, so main
       * has not passed its own lint script for as long as those two honest
       * comments have existed.
       *
       * The fix is a longer root list and not a looser pattern, which is the
       * rule this resolver already set for itself the last time it was
       * incomplete.
       */
      const roots = [dirname(file), ...PATH_ROOTS];
      if (roots.some((root) => existsSync(join(root, candidate)))) continue;
      const atLine = source.split("\n").findIndex((l) => l.includes(candidate)) + 1;
      missingPaths.push(`${where}:${atLine}  ${candidate}`);
    }
  }
}

/*
 * CHECK SIX: DOES THE WHOLE STYLESHEET STILL PARSE, FROM THE ENTRY POINT.
 *
 * I WROTE THIS BECAUSE I BROKE IT. Deleting a dead rule from `motion.css` left
 * an orphaned keyframe body behind - a `{ ... }` with no selector in front of
 * it - and `globals.css` runs every partial through one PostCSS pass, so a
 * syntax error in any one of the 24 takes down EVERY ROUTE with a 500. Not the
 * pages that use the partial. All of them. It is the most severe failure mode
 * anything in this directory can produce and it was invisible to all five
 * checks above, to tsc, to eslint and to the test suite, because none of them
 * parse CSS.
 *
 * FROM THE ENTRY POINT, not file by file. I had been parsing each partial on
 * its own after editing it, which is what caught this one in the end, but a
 * per-file pass cannot see an unclosed brace that swallows the next file, and
 * it only runs over the files somebody remembered to list. Following
 * `globals.css`'s own `@import` graph tests what the product actually compiles.
 *
 * `@import "tailwindcss"` and the token package are resolved by the bundler and
 * not by us, so only the relative partials are followed; those are the ones this
 * queue writes.
 *
 * IT DEGRADES TO A SKIP. `lightningcss` is here because Next depends on it, not
 * because this script does. If it cannot be loaded the check says so and passes,
 * because a check that fails on a clean checkout is a check somebody deletes
 * rather than obeys, and this file's own header has said that since it was
 * written.
 */
let parseError = null;
try {
  const { bundle } = await import("lightningcss");
  const entry = join(ROOT, "src/app/globals.css");
  /* Route stylesheets: partials a route layout or a component imports
     instead of `globals.css` (B-4 moved admin.css; C12 moved landing,
     landing-rooms, public-doors, agent, stays, map and feed-m; LandingBody
     imports landing-3d.css). They are parsed after the global graph, which
     is the order the browser receives them in. The named ones are listed so
     they are parsed even if an import is lost; any other `app/css/*.css` a
     TS file imports is found by the scan, so a new entry point is covered
     without anyone remembering to add it here. */
  const ROUTE_STYLESHEETS = [
    "./css/admin.css",
    "./css/landing-3d.css",
    "./css/landing.css",
    "./css/landing-rooms.css",
    "./css/public-doors.css",
    "./css/agent.css",
    "./css/stays.css",
    "./css/map.css",
    "./css/feed-m.css",
  ];
  const imported = filesUnder(join(ROOT, "src"), [".ts", ".tsx"])
    .flatMap((file) => [...readFileSync(file, "utf8").matchAll(/import\s+"@\/app\/(css\/[\w.-]+\.css)"/g)].map((m) => `./${m[1]}`));
  const globalGraph = readFileSync(entry, "utf8")
    .split("\n")
    .flatMap((line) => [...line.matchAll(/@import\s+"(\.\/[^"]+)"/g)].map((m) => m[1]));
  const graph = [...new Set([...globalGraph, ...ROUTE_STYLESHEETS, ...imported])];
  const shim = join(ROOT, "src/app", ".parse-check.css");
  writeFileSync(shim, graph.map((f) => `@import "${f}";`).join("\n"));
  try {
    bundle({ filename: shim, minify: false });
    console.log(`css parse: ${graph.length} partials bundle cleanly (${globalGraph.length} from globals.css, ${graph.length - globalGraph.length} route sheets).`);
  } finally {
    rmSync(shim, { force: true });
  }
} catch (error) {
  if (error?.code === "ERR_MODULE_NOT_FOUND") {
    console.log("css parse: skipped, lightningcss not available.");
  } else {
    parseError = error;
  }
}

/* ------------------------------------------------------------ the report */

let failed = false;

/*
 * The parse result is REPORTED here rather than where it is produced, and that
 * ordering is not cosmetic: `failed` is declared below the checks and the first
 * draft of this block sat above it, so the moment the check actually caught a
 * syntax error it threw `ReferenceError: Cannot access 'failed' before
 * initialization` instead of printing the failure. A guard that crashes on the
 * fault it was written for is worse than no guard, because the stack trace it
 * prints is about this file rather than about the stylesheet.
 *
 * Found, again, by reintroducing the fault and reading the output. Three
 * separate checks in this file have now been wrong on their first run and every
 * one was caught the same way.
 */
if (parseError) {
  failed = true;
  console.error(
    "\nA STYLESHEET DOES NOT PARSE, and this is the one failure here that takes\n" +
      "the whole product down. `globals.css` runs all its partials through one\n" +
      "PostCSS pass, so a syntax error in any of them 500s EVERY route, not the\n" +
      "pages that use it. Nothing else in this repository parses CSS: not tsc,\n" +
      "not eslint, not the tests, and not the five checks above.\n\n" +
      "The usual cause is an edit that removed a rule and left its body, or a\n" +
      "comment closed in the wrong place.\n",
  );
  console.error(`  ${parseError.fileName ?? "?"}:${parseError.loc?.line ?? "?"}  ${parseError.message}`);
  console.error("");
}


if (failures.length > 0) {
  failed = true;
  console.error(
    "\nLayer-1 palette tokens in a stylesheet (ADR-002). Stylesheets read the\n" +
      "layer-2 semantic tokens, exactly as components do. The raw ramps exist so\n" +
      "the semantic layer has somewhere to resolve to, not so surfaces can read\n" +
      "them directly.\n",
  );
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`\n${failures.length} violation(s).\n`);
}

if (duplicates.length > 0) {
  failed = true;
  console.error(
    "\nTHE SAME CUSTOM PROPERTY DECLARED TWICE IN ONE RULE. Later wins, so the\n" +
      "first declaration is dead and the value that paints is the second one,\n" +
      "whichever that turns out to be. Nothing warns: a repeated custom property\n" +
      "is legal CSS.\n\n" +
      "This is worth reading rather than fixing blind. When it last happened, five\n" +
      "tokens were duplicated seventeen lines apart under a copy of the same\n" +
      "comment, and the copy that WON was the one the file's own prose describes\n" +
      "as wrong: a retune that had been written up and reviewed had never once\n" +
      "rendered. Decide which value is the intended one before deleting either.\n",
  );
  for (const entry of duplicates) console.error(`  ${entry}`);
  console.error(`\n${duplicates.length} duplicate declaration(s).\n`);
}

/*
 * CHECK EIGHT REPORTS AND DOES NOT FAIL, AND THAT IS A JUDGEMENT ABOUT WHAT A
 * MACHINE CAN KNOW RATHER THAN A SOFTENING OF IT.
 *
 * Every other check here is decidable. A `var()` either names a defined token or
 * it does not; a property either takes a shadow or it does not. A path in prose
 * is not, because whether it is a FAULT depends entirely on the tense of the
 * sentence around it, and prose has no syntax for tense that a regular
 * expression can read. The first run of this check found four kinds and only two
 * of them are wrong:
 *
 *   VOUCHING    "see components/site/Onboarding.tsx for the honest trigger"
 *               Asserts the file exists now. It never has. FAULT, and this is
 *               the one the check was built for: it vouched for eleven rules of
 *               dead CSS and read as obviously live.
 *
 *   STALE       "lib/agent/repository.ts had already decided the principle"
 *               Asserts the file exists now. It does not. FAULT, or the path is
 *               mistyped, and either way somebody will go looking.
 *
 *   HISTORICAL  "everything below arrived from components/app/assistant/glyphs.tsx"
 *               Correct. The file is gone BECAUSE of the change being described.
 *
 *   FORWARD     "delete this the day AgentShell moves into app/agent/layout.tsx"
 *               Correct. The file does not exist yet and that is the point.
 *
 * So it prints its list and exits zero, because a check that fails on correct
 * prose is one somebody deletes rather than obeys, and that rule is older than
 * this check.
 *
 * IT IS FATAL NOW, AND THE CONDITION BELOW IS WHY. The two correct kinds only
 * need an extensioned path because we habitually write one. Name the DIRECTORY,
 * or drop the extension, when you are recalling a file or predicting one:
 * "arrived from `components/app/assistant/`" says the same thing and cannot be
 * mistaken for a live reference by a reader either. Write a full path with an
 * extension only when you are asserting that the file is there to be opened.
 * THE CONDITION WAS "once the tree is clean under that convention", and it was
 * met three references later: the design system's own files were converted the
 * day the check was written, and the last three, two stale and one forward, were
 * cleared by their owner in the block after. So this fails now. A check held at
 * report-only past the point where it is clean is a check nobody will ever
 * promote, because there is never a better moment than the one where the count
 * is zero.
 *
 * The convention it enforces is written up in
 * `packages/design-tokens/README.md` under "Writing about a file in a comment",
 * with the table of four kinds. If this fires on a comment that is recalling or
 * predicting a file, the fix is to name the directory or drop the extension,
 * not to add the path to an exception list.
 */
if (missingPaths.length > 0) {
  failed = true;
  console.error(
    "\nA COMMENT NAMES A SOURCE FILE THAT DOES NOT EXIST. Read each one: this\n" +
      "check cannot tell an assertion from a recollection, and the note above it\n" +
      "in this file says which kinds are faults and which are fine.\n\n" +
      "The fault to look for is a comment VOUCHING for a file, because a named\n" +
      "component is the strongest evidence a reader gets that a rule is wired up.\n" +
      "Two dead animations survived that way, both introduced by 'see X for the\n" +
      "honest trigger', neither X ever written.\n",
  );
  for (const entry of missingPaths) console.error(`  ${entry}`);
  console.error(`\n${missingPaths.length} unresolved path(s) in comments.\n`);
}

if (componentFailures.length > 0) {
  failed = true;
  console.error(
    "\nA COMPONENT reading a layer-1 palette token (ADR-002). Same rule as the\n" +
      "check above and the same reasoning: the raw ramps exist so the semantic\n" +
      "layer has somewhere to resolve to. A component that reads one is pinned to\n" +
      "a colour rather than to a role, so it cannot follow the theme and cannot\n" +
      "follow a retune of the ramp.\n\n" +
      "This check is new. It is not new behaviour: these have been here for as\n" +
      "long as the files have, invisible because the layer-1 rule was enforced in\n" +
      "stylesheets and nowhere else.\n\n" +
      "Reach for the semantic token that names what the colour is DOING.\n" +
      "Link or action text is `--nf-content-link`. A focus ring is\n" +
      "`--nf-focus-ring`. The brand at reading weight, when it is genuinely none\n" +
      "of the named roles, is `--nf-brand-quiet`.\n",
  );
  for (const entry of componentFailures) console.error(`  ${entry}`);
  console.error(`\n${componentFailures.length} component violation(s).\n`);
}

if (unresolved.length > 0) {
  failed = true;
  console.error(
    "\nA var() reading a custom property that is defined NOWHERE, with no\n" +
      "fallback. This does not degrade: an unresolved var() with no fallback\n" +
      "makes the whole declaration invalid at computed-value time, so the\n" +
      "property falls back to its initial value and the rule silently draws\n" +
      "nothing. No browser warns about it. `.nf-feedtabs` painted a transparent\n" +
      "track with no blur this way, under a comment describing the track.\n\n" +
      "Either the name is a typo - check it against\n" +
      "packages/design-tokens/src/tokens.css - or the property is genuinely set\n" +
      "at runtime, in which case give it a fallback so the declaration survives\n" +
      "when it is not: var(--nf-thing, <sensible default>).\n",
  );
  for (const entry of unresolved) console.error(`  ${entry}`);
  console.error(`\n${unresolved.length} unresolved reference(s).\n`);
}

if (mistyped.length > 0) {
  failed = true;
  console.error(
    "\nA var() that RESOLVES and resolves to the wrong kind of value. This is\n" +
      "the check above's twin and the reason it exists separately: the token is\n" +
      "real, it is spelled correctly, and the third check passes it, but the\n" +
      "value it holds cannot be used in the property it was written into. The\n" +
      "declaration is invalid at computed-value time and the browser drops it in\n" +
      "silence, exactly as an unresolved var() does.\n\n" +
      "It was found by `background: var(--nf-elev-3)` in settings-rows.css.\n" +
      "`--nf-elev-3` is a three-layer BOX-SHADOW, so that sheet had one\n" +
      "background declaration and it was void: a settings sheet with a border, a\n" +
      "radius, a shadow, an entrance animation and no fill at all, with the page\n" +
      "showing through it. Nothing caught it, because every guard in this file\n" +
      "asked whether the name was real and this name is real.\n\n" +
      "Fix it by writing the token the property actually wants. A surface that\n" +
      "wants rung 3's LOOK wants `background: var(--nf-surface-elevated)` and\n" +
      "`box-shadow: var(--nf-elev-3-rim), var(--nf-elev-3)`; the rung is the\n" +
      "shadow pair, never the fill.\n",
  );
  for (const entry of mistyped) console.error(`  ${entry}`);
  console.error(`\n${mistyped.length} mistyped reference(s).\n`);
}

if (rawColours.length > 0) {
  failed = true;
  console.error(
    "\nRaw colour literal in a stylesheet under src/app. Every one of them\n" +
      "reached zero and this is enforced from that point: a literal cannot follow\n" +
      "the theme, and dark is the default theme rather than the only one. Use a\n" +
      "layer-2 token, or add one to packages/design-tokens and answer it in BOTH\n" +
      "theme blocks.\n" +
      "\nIf what you want is a colour over a PHOTOGRAPH, the --nf-*-on-media\n" +
      "family is deliberately theme-independent and is almost certainly what you\n" +
      "are reaching for.\n",
  );
  for (const entry of rawColours) console.error(`  ${entry}`);
  console.error(`\n${rawColours.length} literal(s).\n`);
}

if (dullControls.length > 0) {
  failed = true;
  console.error(
    "\nA GREY HAIRLINE ON A CONTROL. `--nf-glass-border` is 11 per cent white,\n" +
      "which on the navy canvas is grey, and every governing reference draws a\n" +
      "resting chip, tile, plate, icon button and secondary with a BLUE outline\n" +
      "carrying light. A screen with one lit primary and eleven grey boxes reads\n" +
      "as a prototype with one finished control, which is what the founder\n" +
      "photographed and what R1 called the single biggest visual gap.\n\n" +
      "The substitution: `border-color: var(--nf-brand-edge)` plus\n" +
      "`box-shadow: var(--nf-glow-edge)`, which is the lit top rim, the full\n" +
      "brand ring and one near bloom, composed once in the token layer.\n\n" +
      "IF WHAT YOU HAVE IS A DIVIDER, this check is wrong about it: the hairline\n" +
      "is right for a line between two things, and what made it look like a\n" +
      "control was the selector. Rename it, or say in a comment why the rule\n" +
      "carries a control word and is not one.\n",
  );
  for (const entry of dullControls) console.error(`  ${entry}`);
  console.error(`\n${dullControls.length} dull control(s).\n`);
}

if (pillControls.length > 0) {
  failed = true;
  console.error(
    "\nA CAPSULE ON A CONTROL. The founder's ruling of 19 September, written\n" +
      "up in docs/DESIGN_DIRECTION.md section 1: any control that carries text\n" +
      "is a ROUNDED RECTANGLE on --nf-radius-control. Every button, chip,\n" +
      "segment, tab, filter chip, input, dock label, sheet action and admin\n" +
      "control. GOVERNING-landing-desktop-hero.png has no capsule anywhere in\n" +
      "it, and its one circle is the nav search glyph.\n\n" +
      "Two exceptions and no others: an avatar, and a bare icon button that\n" +
      "carries no text and is drawn round in a governing image. A dot, a\n" +
      "spinner, a progress bar, a range track, a sheet grip, a switch track and\n" +
      "an avatar or story ring are SHAPES rather than controls, and this rule\n" +
      "is wrong about any of them it names: give the rule a selector that says\n" +
      "what it is, or list it in PILL_ALLOWED with the reason.\n\n" +
      "The fix is one token. --nf-radius-control, not --nf-radius-pill, not\n" +
      "--nf-radius-control-pill, and never a literal 999px.\n\n" +
      "WHAT THIS CHECK DOES NOT PROVE: it greps source text. It cannot see a\n" +
      "radius that reaches a control through a shared class, a cascade or a\n" +
      "runtime style, and it cannot see what the browser computed. A single\n" +
      "unlayered rule outranked every layered brand edge in this product today\n" +
      "with every check in this file green, because the source text was right.\n",
  );
  for (const entry of pillControls) console.error(`  ${entry}`);
  console.error(`\n${pillControls.length} capsule(s) on a control.\n`);
}

if (failed) process.exit(1);

console.log(
  "css tokens: clean - 0 layer-1 references in stylesheets, 0 in components, " +
    "0 raw colour literals, 0 unresolved var() references, 0 var() references " +
    "of the wrong type, 0 duplicate declarations, 0 comment paths that do not " +
    `resolve, 0 resting controls edged in a neutral border token (${DULL_ALLOWED.size} ` +
    "listed exceptions, see DULL_ALLOWED), 0 capsules on a control in the " +
    `stylesheets or in TSX (${PILL_ALLOWED.size + PILL_ALLOWED_TSX.size} listed exceptions, see PILL_ALLOWED), ` +
    "and every partial parses. All ten are enforced. None of them proves what " +
    "the browser computed: this script reads source text only.",
);
