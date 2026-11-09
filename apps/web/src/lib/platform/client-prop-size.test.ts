import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";

/**
 * NO CLIENT COMPONENT IS HANDED A HUGE PROP BY A SERVER FILE (Agent NATIVE,
 * performance audit, 7 November 2026).
 *
 * Every prop a server component gives a client component is serialised into
 * the page's flight payload, downloaded and parsed on the phone before the
 * page is whole. /welcome once handed `FirstRun` the whole dictionary:
 * 202 KB gzipped of a 222 KB document, about 1.1 s on Fast 3G (SIMULATED,
 * PERFORMANCE_REPORT.md). The dictionary is the one prop whose size is known
 * without a database, so this test reads every server file, finds each JSX
 * element whose component comes from a `"use client"` module, and measures
 * every prop that is the dictionary or a slice of it (`t`, `t.section`,
 * `t.a.b`) serialised from the English dictionary. Over 50 KB fails.
 *
 * Data props (listings, threads, rows) are measured on a running build by
 * `scripts/check-flight-props.mjs`, the same 50 KB line.
 *
 * Not seen here: a server component that forwards `t` to a client child it
 * imports (only the first hop is followed), and a slice built by a call such
 * as `shellDictionary(t)` (a function is how a slice is MADE small, so it is
 * trusted).
 */

const LIMIT = 50 * 1024;
const SRC = resolve(__dirname, "../..");

/**
 * Exceptions, `file -> component.prop`, each with its reason. NONE OF THE
 * ENTRIES BELOW IS JUSTIFIED: they are the whole dictionary (about 656 KB raw,
 * about 200 KB gzipped) found by this test's first run, listed so the suite
 * stays green while the owners pass slices instead (Agent NATIVE's hand-off,
 * 7 November 2026). Live /sign-in measured 220 KB gzipped of document, 681 KB
 * of flight, 670 KB of it this prop (SIMULATED fetch, flight.py). Delete a
 * line when its fix lands; the third test fails on a line that is no longer
 * found.
 */
const PENDING = "whole dictionary, fix requested (Agent NATIVE, 7 Nov 2026)";
const ALLOW: Record<string, string> = {
  "components/promotion/PromotedSlot.tsx -> ListingCard.t": PENDING,
};

const dictionary = getDictionary("en") as unknown as Record<string, unknown>;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") && !/\.test\.tsx$/.test(p)) out.push(p);
  }
  return out;
}

const textCache = new Map<string, string>();
const read = (p: string) => {
  if (!textCache.has(p)) textCache.set(p, readFileSync(p, "utf8"));
  return textCache.get(p)!;
};

/** A module is a client module when its first statement is the directive. */
function isClient(text: string): boolean {
  return /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/.test(text);
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** `t`, `t.a`, `t.a.b` as a key path, or null for anything else. */
function dictionaryPath(expr: ts.Expression): string[] | null {
  if (ts.isIdentifier(expr)) return expr.text === "t" ? [] : null;
  if (ts.isPropertyAccessExpression(expr)) {
    const head = dictionaryPath(expr.expression);
    return head ? [...head, expr.name.text] : null;
  }
  if (ts.isParenthesizedExpression(expr)) return dictionaryPath(expr.expression);
  return null;
}

function sizeOf(path: string[]): number {
  let node: unknown = dictionary;
  for (const key of path) {
    if (!node || typeof node !== "object") return 0;
    node = (node as Record<string, unknown>)[key];
  }
  if (node === undefined || typeof node === "function") return 0;
  return Buffer.byteLength(JSON.stringify(node) ?? "", "utf8");
}

type Finding = { file: string; component: string; prop: string; expr: string; bytes: number };

/** Value imports of a file: local name to resolved file. */
function importsOf(file: string): Map<string, string> {
  const sf = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map<string, string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || st.importClause?.isTypeOnly) continue;
    const target = resolveImport(file, st.moduleSpecifier.text);
    if (!target) continue;
    const clause = st.importClause;
    if (!clause) continue;
    if (clause.name) imports.set(clause.name.text, target);
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) if (!el.isTypeOnly) imports.set(el.name.text, target);
    }
  }
  return imports;
}

/** Every module a `"use client"` module reaches: rendered in the browser, never serialised. */
function clientGraph(files: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = files.filter((f) => isClient(read(f)));
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (!/\.tsx?$/.test(f)) continue;
    for (const target of importsOf(f).values()) if (!seen.has(target)) stack.push(target);
  }
  return seen;
}

/** Route files are always server entries, whatever else imports them. */
const ROUTE_FILE = /\/(page|layout|template|loading|error|not-found|default)\.tsx$/;

/** `t` in this file is the whole dictionary (a slice type, or a slice made by a call, is not). */
function tIsDictionary(text: string): boolean {
  return /\bt\s*:\s*Dictionary\b(?!\s*\[)/.test(text) || /\bconst\s+t\s*(?::\s*Dictionary\s*)?=\s*(?:await\s+)?getDictionary\(/.test(text);
}

function scan(): { findings: Finding[]; checked: number } {
  const findings: Finding[] = [];
  let checked = 0;
  /* The preview harness (`app/(dev)`) is never served to a member. */
  const files = walk(SRC).filter((f) => !f.includes(`${join("app", "(dev)")}`));
  const browser = clientGraph(walk(SRC));
  for (const file of files) {
    const text = read(file);
    if (isClient(text) || !/=\{t[.}]/.test(text) || !tIsDictionary(text)) continue;
    if (browser.has(file) && !ROUTE_FILE.test(file)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imports = importsOf(file);
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(sf).split(".")[0]!;
        const target = imports.get(tag);
        if (target && isClient(read(target))) {
          for (const attr of node.attributes.properties) {
            if (!ts.isJsxAttribute(attr) || !attr.initializer || !ts.isJsxExpression(attr.initializer)) continue;
            const expr = attr.initializer.expression;
            const path = expr ? dictionaryPath(expr) : null;
            if (!path) continue;
            checked++;
            findings.push({
              file: relative(SRC, file),
              component: node.tagName.getText(sf),
              prop: attr.name.getText(sf),
              expr: expr!.getText(sf),
              bytes: sizeOf(path),
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { findings, checked };
}

describe("server to client props stay under 50 KB serialised", () => {
  const { findings, checked } = scan();

  it("finds the dictionary props it is meant to measure", () => {
    /* A scanner that silently matches nothing would pass for ever. */
    expect(checked).toBeGreaterThan(50);
  });

  it("no dictionary prop handed to a client component is over 50 KB", () => {
    const over = findings
      .filter((f) => f.bytes > LIMIT && !ALLOW[`${f.file} -> ${f.component}.${f.prop}`])
      .map((f) => `${f.file}: <${f.component} ${f.prop}={${f.expr}}> is ${Math.round(f.bytes / 1024)} KB`);
    expect(over, "pass the sections the component reads, not the dictionary").toEqual([]);
  });

  it("every allowed exception still exists, so the list cannot rot", () => {
    const live = new Set(findings.map((f) => `${f.file} -> ${f.component}.${f.prop}`));
    expect(Object.keys(ALLOW).filter((k) => !live.has(k))).toEqual([]);
  });
});
