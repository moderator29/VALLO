#!/usr/bin/env node
/**
 * `scripts/marketing/` STAYS OUT OF THE PRODUCT, AND ITS LOCKFILE IS REAL.
 *
 * It landed on main carrying its own `package-lock.json` and nothing audited
 * it or said why not. This is that answer, in the lightest form that is still
 * a gate rather than a comment.
 *
 * WHAT IT IS. An authoring tool, run by hand, that makes pictures of the live
 * product for other people to look at: App Store and Play screenshots, the
 * social posts and the launch video (`scripts/marketing/DESIGN.md`). Its ten
 * dependencies are a 3D emoji set, Three.js, GSAP, two icon sets, three
 * webfont packages and two map atlases. Every one of them is used to DRAW an
 * image on somebody's laptop. None of them is imported by the application, and
 * the artefacts that reach a visitor are the finished files, not the packages
 * that drew them.
 *
 * SO ITS TREE IS NOT IN THE PRODUCTION AUDIT PATH, AND THAT IS CORRECT RATHER
 * THAN AN OVERSIGHT. `scripts/marketing` is deliberately not one of the root
 * `workspaces` globs (`apps/*`, `packages/*`), so `npm ci` never installs it,
 * no CI job has it on disk, and `npm audit --omit=dev` at the root cannot see
 * it. Pulling it into the workspaces to get it audited would do the opposite of
 * making the product safer: it would put Three.js and a 3D emoji set into the
 * tree every production build resolves from, to gate code that never runs on a
 * server or in a browser a visitor opens.
 *
 * THE GATE IS THEREFORE TWO THINGS, NOT A JOB. CI runs
 * `npm audit --package-lock-only --audit-level=high --prefix scripts/marketing`
 * in the existing, non-required advisories job, which reads the committed
 * lockfile and installs nothing, so the advisories ARE checked. And this script
 * holds the thing that would make that exclusion unsafe if it ever stopped
 * being true: that the tool stays a tool. If one of its packages ever turns up
 * in the shipped dependency tree, or the application ever imports out of
 * `scripts/marketing`, the exclusion above is void and this check is the thing
 * that says so.
 *
 *     node scripts/check-marketing-deps.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKETING = join(ROOT, "scripts", "marketing");

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const problems = [];

/* 1. It is not a workspace, so the production tree never resolves it. */
const root = read(join(ROOT, "package.json"));
const workspaces = root.workspaces ?? [];
if (workspaces.some((glob) => glob.startsWith("scripts"))) {
  problems.push(
    `scripts/marketing is inside a root workspaces glob (${workspaces.join(", ")}). ` +
      "Every production install would then resolve its ten drawing packages. " +
      "If this is deliberate, it must be audited by the root `npm audit --omit=dev` and this script is void.",
  );
}

/* 2. The lockfile exists and describes the dependencies the manifest asks for,
      because the audit step CI runs reads the lockfile and nothing else. */
const manifest = read(join(MARKETING, "package.json"));
const declared = Object.keys(manifest.dependencies ?? {});
const lockPath = join(MARKETING, "package-lock.json");
if (!existsSync(lockPath)) {
  problems.push("scripts/marketing/package-lock.json is missing, so `npm audit --package-lock-only` audits nothing.");
} else {
  const lock = read(lockPath);
  const locked = lock.packages?.[""]?.dependencies ?? {};
  for (const name of declared) {
    if (!(name in locked)) problems.push(`scripts/marketing/package-lock.json is stale: it does not carry ${name}.`);
    else if (!lock.packages[`node_modules/${name}`]) {
      problems.push(`scripts/marketing/package-lock.json names ${name} but resolves no version for it.`);
    }
  }
}

/* 3. None of its packages is in the shipped tree. A dependency in both places
      is not forbidden by itself, but it means the production audit DOES carry
      that package, and the reasoning above has to be revisited. */
const shipped = new Map();
const manifests = [join(ROOT, "apps", "web", "package.json")];
const packagesDir = join(ROOT, "packages");
if (existsSync(packagesDir)) {
  for (const entry of readdirSync(packagesDir)) {
    const candidate = join(packagesDir, entry, "package.json");
    if (existsSync(candidate)) manifests.push(candidate);
  }
}
for (const path of manifests) {
  const json = read(path);
  for (const name of Object.keys(json.dependencies ?? {})) shipped.set(name, relative(ROOT, path));
}
for (const name of declared) {
  if (shipped.has(name)) {
    problems.push(
      `${name} is a dependency of both scripts/marketing and ${shipped.get(name)}. ` +
        "The marketing tool is excluded from the production audit on the grounds that it shares nothing with the product.",
    );
  }
}

/* 4. Nothing shipped imports out of the tool's folder. A test file is not
      shipped (no build includes it), so a test may read the tool's capture
      plan to check the help guides against it
      (`apps/web/src/components/docs/guide-shots.test.ts`, 9 November 2026). */
const SOURCE_ROOTS = [join(ROOT, "apps", "web", "src"), packagesDir];
const SOURCE_EXT = /\.(?:ts|tsx|mjs|js|jsx|css)$/;
const TEST_FILE = /\.(?:test|spec)\.[a-z]+$/;
function walk(dir, found) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (SOURCE_EXT.test(entry) && !TEST_FILE.test(entry) && readFileSync(path, "utf8").includes("scripts/marketing")) {
      found.push(relative(ROOT, path));
    }
  }
  return found;
}
const importers = SOURCE_ROOTS.flatMap((dir) => walk(dir, []));
for (const path of importers) {
  problems.push(`${path} refers to scripts/marketing. The tool must not be reachable from shipped code.`);
}

if (problems.length > 0) {
  console.error("marketing deps: the exclusion recorded in .github/workflows/ci.yml no longer holds.");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `marketing deps: ${declared.length} packages, locked, not a workspace, shared with nothing shipped, imported by nothing shipped.`,
);
