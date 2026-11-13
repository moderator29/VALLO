/**
 * EVERY COMPOSER KEEPS THE KEYBOARD CONTRACT, WHATEVER ELEMENT IT IS.
 *
 * The founder, 12 November 2026: "look at this messaging stuff you only fixed
 * it for me and that users chat, it supposed to be fixed for all messages, any
 * message at all". He was right, and the reason was one word in one selector.
 *
 * A composer pinned above the keyboard pads itself by
 * `env(safe-area-inset-bottom)` so it clears the home indicator. With the keys
 * up the bottom of the viewport is the top of the keyboard, where no home
 * indicator is, so that padding becomes dead air between the bar and the keys.
 * `messages-g1.css` takes it back under `:root[data-keyboard="open"]`.
 *
 * That rule used to read `form.nf-composer`. An element name in a shared
 * contract means the contract is kept by whichever composer happens to be
 * written as a <form> and silently skipped by one written as a <div>, a
 * <section> or a sheet's footer. Measured in WebKit at 390 with the device's
 * 34 points substituted for the headless browser's 0: a composer written as a
 * form collapsed 34px to 8px, and the same markup as a div stayed at 34px.
 *
 * So this file pins the shape of the contract rather than any one surface:
 *
 *   1. the rule names a CLASS and an ATTRIBUTE, never an element
 *   2. every stylesheet rule that pads a composer by the home indicator is
 *      reachable by that rule, and a new one fails here until it is
 *   3. every composer root in the markup carries the class or the attribute
 *
 * Point 2 is the part that stops this recurring: add a composer with a
 * safe-area foot and this test names it until it is under the contract.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function filesUnder(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(path, ext, out);
    else if (entry.name.endsWith(ext)) out.push(path);
  }
  return out;
}

const rel = (path: string) => relative(SRC, path).replace(/\\/g, "/");

/** Does this declaration reserve room at the bottom for the home indicator? */
const padsForHomeIndicator = (decl: Declaration) =>
  /^padding(-block-end|-bottom|-block|)$/.test(decl.prop) && /safe-area-inset-bottom/.test(decl.value);

/** A selector that is about a composer, by its own name. */
/* The underscore matters: `nf-ai__composer` is the assistant's bar, and a
   character class without `_` in it read that name as not a composer at all. */
const namesAComposer = (selector: string) => /\bnf-[a-z0-9_-]*compos/i.test(selector);

/**
 * Composer feet that are under the contract, and how each one qualifies.
 * A class the contract rule matches directly needs nothing; anything else
 * carries `data-composer` in its component, named here so the pairing is
 * reviewable rather than implicit.
 */
const UNDER_CONTRACT: Record<string, string> = {
  ".nf-composer": "the class the contract rule matches",
  ".nf-composer.nf-composer": "the same class, doubled in grade1.css for weight",
  ".nf-compose-page__tools": "components/social/feed/Composer.tsx carries data-composer",
};

/* ------------------------------------------------------- the contract rule */

const MESSAGES_G1 = join(SRC, "app", "css", "messages-g1.css");

function contractRules(): Rule[] {
  const found: Rule[] = [];
  postcss.parse(readFileSync(MESSAGES_G1, "utf8")).walkRules((rule) => {
    if (!/\[data-keyboard=/.test(rule.selector)) return;
    if (!rule.nodes.some((n) => n.type === "decl" && /^padding/.test((n as Declaration).prop))) return;
    found.push(rule);
  });
  return found;
}

describe("the keyboard contract's own shape", () => {
  it("is written once, in messages-g1.css", () => {
    expect(contractRules()).toHaveLength(1);
  });

  it("names a class and an attribute, and never an element", () => {
    const selector = contractRules()[0]!.selector;
    expect(selector).toContain('[data-keyboard="open"]');
    /* The class every chat composer already has, and the attribute a composer
       that is not `.nf-composer` opts in with. */
    expect(selector).toContain(".nf-composer");
    expect(selector).toContain("[data-composer]");
    /* An element name before a class or an attribute is the defect: it makes
       the contract depend on the markup's shape. `form.nf-composer` is what
       this used to say. */
    const elementQualified = /(^|[\s,>+~])[a-z][a-z0-9]*(?=[.[])/.exec(selector);
    expect(elementQualified?.[0] ?? null).toBeNull();
  });

  it("takes the padding back to the resting gap and nothing larger", () => {
    const decl = contractRules()[0]!.nodes.find((n) => n.type === "decl") as Declaration;
    expect(decl.prop).toBe("padding-block-end");
    expect(decl.value).toBe("var(--nf-space-xs)");
  });
});

/* ------------------------------- every composer foot is under the contract */

describe("every composer that reserves the home indicator", () => {
  /** `{ selector, file }` for each composer foot found in the stylesheets. */
  const feet: { selector: string; file: string }[] = [];
  for (const file of filesUnder(SRC, ".css")) {
    postcss.parse(readFileSync(file, "utf8")).walkDecls((decl) => {
      if (!padsForHomeIndicator(decl)) return;
      const rule = decl.parent;
      if (!rule || rule.type !== "rule") return;
      for (const selector of (rule as Rule).selectors) {
        if (!namesAComposer(selector)) continue;
        if (!feet.some((f) => f.selector === selector)) feet.push({ selector, file: rel(file) });
      }
    });
  }

  it("finds the composer feet this contract is about", () => {
    /* A guard on the guard: if this reaches zero the scan has stopped
       working and the assertion below would pass by finding nothing. */
    expect(feet.length).toBeGreaterThan(0);
  });

  it("is reachable by the contract rule, or fails here until it is", () => {
    const loose = feet.filter((f) => !(f.selector in UNDER_CONTRACT));
    expect(
      loose.map((f) => `${f.file}: ${f.selector} pads for the home indicator and is not under the keyboard contract`),
    ).toEqual([]);
  });

  it("lists nothing in the contract that no longer exists", () => {
    const gone = Object.keys(UNDER_CONTRACT).filter((selector) => !feet.some((f) => f.selector === selector));
    expect(gone).toEqual([]);
  });
});

/* ----------------------- no composer rule anywhere is qualified by an element */

/*
 * THE CONTRACT RULE WAS NOT THE ONLY SELECTOR WITH AN ELEMENT IN IT.
 * `grade1.css` dressed the chat box and `input-bar.css` the box, the field
 * and the send disc under `form.nf-composer`, and `input-bar.css` dressed the
 * assistant's whole bar and its 44px disc under `form.nf-ai__composer`. The
 * keyboard foot was moved onto a class in November 2026 and these were left
 * behind, so a composer written as a div would have kept the keyboard
 * behaviour and lost the box and the disc: broken in a different way rather
 * than broken in the same way. Both now double the class instead, which is
 * the same weight with no element in it.
 *
 * This test is about the SHAPE of the selector, not about any one file, so a
 * new composer rule written as `form.nf-whatever-composer` fails here on the
 * day it is written.
 */
describe("every rule that styles a composer", () => {
  it("reaches it by class, never by element name", () => {
    const qualified: string[] = [];
    for (const file of filesUnder(SRC, ".css")) {
      postcss.parse(readFileSync(file, "utf8")).walkRules((rule) => {
        for (const selector of rule.selectors) {
          if (!namesAComposer(selector)) continue;
          /* An element name immediately before a composer class, such as
             `form.nf-composer`. A descendant element is a different thing and
             is not what this is about. */
          if (/(^|[\s,>+~])[a-z][a-z0-9]*\.nf-[a-z0-9_-]*compos/i.test(selector)) {
            qualified.push(`${rel(file)}: ${selector}`);
          }
        }
      });
    }
    expect(qualified).toEqual([]);
  });
});

/* ------------------------------------- every composer root carries the mark */

describe("every composer root in the markup", () => {
  /** The class tokens whose element is the one carrying a safe-area foot. */
  const PADDED_ROOTS = ["nf-composer", "nf-compose-page__tools"];

  it("carries the class or the attribute the contract reads", () => {
    const missing: string[] = [];
    for (const file of filesUnder(SRC, ".tsx")) {
      if (/\.(test|dom\.test)\.tsx$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      /* Every JSX opening tag that names a padded composer root. */
      for (const tag of source.match(/<[A-Za-z][^<>]*?className=\{?["'][^"']*?["'][^<>]*?>/gs) ?? []) {
        const classes = /className=\{?["']([^"']*)["']/.exec(tag)?.[1] ?? "";
        const token = PADDED_ROOTS.find((t) => classes.split(/\s+/).includes(t));
        if (!token) continue;
        if (classes.split(/\s+/).includes("nf-composer")) continue;
        if (/data-composer/.test(tag)) continue;
        missing.push(`${rel(file)}: "${token}" without nf-composer or data-composer`);
      }
    }
    expect(missing).toEqual([]);
  });
});
