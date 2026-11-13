/**
 * TWO STYLESHEETS, ONE CLASS NAME, TWO LAYOUTS.
 *
 * Found 13 November 2026 on the move-in cost page. The deal room's document
 * checklist (components/app/offers/offers.css) declared `.nf-doc` as a
 * two-column grid. The DocumentSheet that draws the move-in "Cost breakdown"
 * (app/css/document.css) is also `.nf-doc`. Next keeps a route's stylesheet
 * in the document after a soft navigation, and offers.css arrives with the
 * listing page, so a member who tapped from a listing to its move-in cost got
 * the paper sheet as `grid-template-columns: 0px 298px`: every label one
 * character wide, the title over the total, the footnote over the rows. A
 * direct load was clean, which is why no sweep that loads pages one at a time
 * ever saw it.
 *
 * CHECK 1, COLLISIONS. Every selector that is a single compound of classes
 * (`.nf-doc`, `.nf-pcard__facts`, `.nf-a.nf-b`) declared in MORE THAN ONE
 * stylesheet, where two files give a LAYOUT property different values. A
 * shared base in one file and a modifier in another is a different selector
 * and is not flagged; two components that happen to share a name are.
 *
 * CHECK 2, UNLAYERED REACH. A rule outside every `@layer` beats every layered
 * rule whatever its specificity. That is what let offers.css win. So a rule
 * outside a layer may only style classes no other stylesheet styles: its
 * subject class (the last compound of the selector) must belong to its own
 * sheet. Every sheet with unlayered rules is listed under --list; the gate
 * fails on the ones that reach another sheet's classes, unless allowlisted
 * with a reason (the deliberate ones: print, reduced motion, data saver).
 *
 * Allowlist: scripts/css-collisions-allow.json, every entry with a reason.
 *   node scripts/check-css-collisions.mjs           the gate
 *   node scripts/check-css-collisions.mjs --list    every finding, allowed too
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import postcss from "postcss";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
const LIST = process.argv.includes("--list");

const LAYOUT = new Set([
  "display", "position", "overflow", "overflow-x", "overflow-y",
  "width", "min-width", "max-width", "inline-size", "min-inline-size", "max-inline-size",
  "flex", "flex-direction", "flex-wrap", "flex-flow", "flex-grow", "flex-shrink", "flex-basis",
  "grid-template-columns", "grid-template-rows", "grid-template-areas", "grid-template",
  "grid-column", "grid-row", "grid-area", "grid-auto-flow", "grid-auto-columns",
  "float", "contain",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

const allow = JSON.parse(readFileSync(join(ROOT, "scripts/css-collisions-allow.json"), "utf8"));
for (const [section, entries] of Object.entries(allow)) {
  if (section.startsWith("//")) continue;
  for (const [key, why] of Object.entries(entries)) {
    if (typeof why !== "string" || why.trim().length < 20) {
      console.error(`css-collisions-allow.json: ${section} "${key}" needs a reason of at least a sentence.`);
      process.exit(1);
    }
  }
}

const SINGLE_COMPOUND = /^(\.[a-zA-Z0-9_-]+)+$/;
/** selector -> file -> { prop: value } */
const decl = new Map();
const unlayered = new Map();
/** class -> files whose rules style it as their subject */
const owners = new Map();
/** file -> classes it styles from outside any layer */
const unlayeredSubjects = new Map();

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (rel.includes(".test.") || rel.includes("/(dev)/")) continue;
  let root;
  try {
    root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  } catch (e) {
    console.error(`${rel}: cannot parse (${e.reason ?? e.message})`);
    process.exit(1);
  }
  root.walkRules((rule) => {
    let layered = false;
    let conditional = false;
    for (let p = rule.parent; p && p.type !== "root"; p = p.parent) {
      if (p.type === "atrule" && p.name === "layer") layered = true;
      if (p.type === "atrule" && /^(media|supports|container)$/.test(p.name)) conditional = true;
      if (p.type === "atrule" && /keyframes$/.test(p.name)) return;
    }
    if (!layered) unlayered.set(rel, (unlayered.get(rel) ?? 0) + 1);
    for (const raw of rule.selectors) {
      const parts = raw.trim().split(/[\s>+~]+/);
      const subject = parts.pop() ?? "";
      /* Scoped under an ancestor class (`.nf-visit > .nf-action-bar-pinned`)
         is the other honest way to keep an unlayered rule to its own
         component, so only an unscoped subject counts as reach. */
      const scoped = parts.some((p) => /\.[a-zA-Z0-9_-]+/.test(p));
      for (const m of subject.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        if (!owners.has(m[1])) owners.set(m[1], new Set());
        owners.get(m[1]).add(rel);
        if (!layered && !scoped) {
          if (!unlayeredSubjects.has(rel)) unlayeredSubjects.set(rel, new Set());
          unlayeredSubjects.get(rel).add(m[1]);
        }
      }
    }
    if (conditional) return;
    for (const raw of rule.selectors) {
      const sel = raw.trim();
      if (!SINGLE_COMPOUND.test(sel)) continue;
      const props = {};
      rule.each((d) => {
        if (d.type === "decl" && LAYOUT.has(d.prop)) props[d.prop] = d.value.replace(/\s+/g, " ").trim();
      });
      if (!Object.keys(props).length) continue;
      if (!decl.has(sel)) decl.set(sel, new Map());
      const byFile = decl.get(sel);
      byFile.set(rel, { ...(byFile.get(rel) ?? {}), ...props });
    }
  });
}

let failures = 0;
const collisions = [];
for (const [sel, byFile] of decl) {
  if (byFile.size < 2) continue;
  const files = [...byFile.keys()];
  const conflicts = [];
  for (let i = 0; i < files.length; i++)
    for (let j = i + 1; j < files.length; j++) {
      const a = byFile.get(files[i]), b = byFile.get(files[j]);
      for (const prop of Object.keys(a)) if (prop in b && a[prop] !== b[prop]) conflicts.push(`${prop}: ${a[prop]} (${files[i]}) vs ${b[prop]} (${files[j]})`);
    }
  if (conflicts.length) collisions.push({ sel, conflicts });
}

for (const { sel, conflicts } of collisions.sort((a, b) => a.sel.localeCompare(b.sel))) {
  const allowed = sel in (allow.collisions ?? {});
  if (allowed && !LIST) continue;
  if (!allowed) failures++;
  console.log(`${allowed ? "allowed  " : "COLLISION"} ${sel}`);
  for (const c of conflicts) console.log(`    ${c}`);
}
const reaching = new Map();
for (const [file, classes] of unlayeredSubjects) {
  const shared = [...classes].filter((c) => [...owners.get(c)].some((f) => f !== file));
  if (shared.length) reaching.set(file, shared.map((c) => `${c} (also ${[...owners.get(c)].filter((f) => f !== file).join(", ")})`));
}
for (const [file, count] of [...unlayered].sort()) {
  const shared = reaching.get(file);
  const allowed = file in (allow.unlayered ?? {});
  if (!shared) {
    if (LIST) console.log(`unlayered ${file}: ${count} rule(s) outside any @layer, all on its own classes`);
    continue;
  }
  if (allowed && !LIST) continue;
  if (!allowed) failures++;
  console.log(`${allowed ? "allowed  " : "UNLAYERED"} ${file}: ${count} rule(s) outside any @layer reach classes other sheets style:`);
  for (const c of shared.slice(0, 12)) console.log(`    ${c}`);
  if (shared.length > 12) console.log(`    ... and ${shared.length - 12} more`);
}
for (const key of Object.keys(allow.collisions ?? {})) if (!collisions.some((c) => c.sel === key)) console.log(`stale allowlist entry (collisions): ${key}`);
for (const key of Object.keys(allow.unlayered ?? {})) if (!reaching.has(key)) console.log(`stale allowlist entry (unlayered): ${key}`);

if (failures) {
  console.log(`\n${failures} finding(s). Rename one of two colliding classes, or put the sheet's rules in @layer components; allowlist only with a reason.`);
  process.exit(1);
}
console.log(`css collisions: ${collisions.length} layout collision(s) across files, all allowlisted; ${unlayered.size} sheet(s) with unlayered rules, ${reaching.size} reaching shared classes, all allowlisted.`);
