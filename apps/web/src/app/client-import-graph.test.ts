import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * WHAT A CLIENT MODULE CARRIES INTO THE BROWSER, FOLLOWED THROUGH EVERY FILE.
 *
 * `nf/no-dictionary-in-client` (eslint-rules/) reads one file at a time: a
 * `"use client"` module may not import `@vallo/i18n`. It cannot see the same
 * import one step away. On 17 October 2026 the docs chapter rail, a client
 * component, imported a grouping helper from `chapters.tsx`, which imported
 * `chapters-more.tsx`, which imported `@vallo/i18n`: /docs and every chapter
 * shipped the whole dictionary and zod, about 840 KB of gzipped script, with
 * lint green. The welcome screen's interest cards carried zod the same way,
 * through `lib/interests/schema`.
 *
 * So this walks the graph the bundler walks. From every `"use client"` module
 * it follows each static value import and re-export (type-only imports are
 * erased, so they are skipped) through relative and `@/` paths, and stops at a
 * `"use server"` module, whose exports reach the browser as references and
 * not as code. A dynamic `import()` is not followed: the bundler splits it
 * into a chunk no first load carries, which is how the call stage loads
 * `livekit-client`, the maps load leaflet and checkout loads Paystack.
 *
 * Each package below may reach the browser only through `import()`.
 */
const FORBIDDEN: Record<string, string> = {
  "@vallo/i18n": "the whole dictionary, every locale (398 KB gzipped). Use @vallo/i18n/core and take the words as props.",
  zod: "zod's classic builder (about 85 KB gzipped in a first load). Keep schemas on the server; import a model file's constants.",
  "livekit-client": "the call library: it loads when a call starts, through import() in CallStage.",
  leaflet: "the map library: the maps load it through import().",
  "@paystack/inline-js": "the payment script: it loads on payment, through import() in PaystackCheckout.",
};

/*
 * THE ALLOW-LIST ONLY SHRINKS. A client module here still reaches a package
 * above, statically, and the reason it is tolerated is beside it. Fix the
 * import and delete the line; never add one.
 */
const ALLOWED: Record<string, string> = {
  /* Staff only, one screen: the form imports the signal list and limits from
     the module that also builds the zod input schemas. */
  "app/admin/agreements/settings/RiskSettingsForm.tsx": "zod",
};

const SRC = join(process.cwd(), "src");
const I18N_SRC = resolve(process.cwd(), "../../packages/i18n/src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

function parse(file: string, head = false): ts.SourceFile {
  const text = readFileSync(file, "utf8");
  return ts.createSourceFile(file, head ? text.slice(0, 4000) : text, ts.ScriptTarget.Latest, false, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

const directives = new Map<string, string | null>();
/** The module's directive ("use client", "use server") or null. */
function directiveOf(file: string): string | null {
  if (!directives.has(file)) {
    let found: string | null = null;
    for (const statement of parse(file, true).statements) {
      if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
        if (statement.expression.text === "use client" || statement.expression.text === "use server") {
          found = statement.expression.text;
          break;
        }
        continue;
      }
      break;
    }
    directives.set(file, found);
  }
  return directives.get(file)!;
}

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];
/** A file path, `pkg:<name>` for a package, or null for what is not followed. */
function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith("@vallo/i18n/")) base = join(I18N_SRC, spec.slice("@vallo/i18n/".length));
  else return `pkg:${spec}`;
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate) && statSync(candidate).isFile()) return /\.(css|json|svg)$/.test(candidate) ? null : candidate;
  }
  return null;
}

const edges = new Map<string, string[]>();
function importsOf(file: string): string[] {
  if (edges.has(file)) return edges.get(file)!;
  const specs: string[] = [];
  for (const statement of parse(file).statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      const named = clause?.namedBindings;
      if (clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly)) continue;
      specs.push(statement.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((e) => e.isTypeOnly)) continue;
      specs.push(statement.moduleSpecifier.text);
    }
  }
  const resolved = specs.map((spec) => resolveImport(file, spec)).filter((r): r is string => r !== null);
  edges.set(file, resolved);
  return resolved;
}

/** The shortest chain from `entry` to each forbidden package it reaches. */
function reach(entry: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const seen = new Set([entry]);
  const queue: string[][] = [[entry]];
  while (queue.length > 0) {
    const chain = queue.shift()!;
    const current = chain[chain.length - 1]!;
    if (current.startsWith("pkg:")) {
      const name = current.slice(4);
      if (name in FORBIDDEN && !found.has(name)) found.set(name, chain);
      continue;
    }
    if (current !== entry && directiveOf(current) === "use server") continue;
    for (const next of importsOf(current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([...chain, next]);
    }
  }
  return found;
}

/**
 * Every module some file loads with `import()`. Such a module is a lazy
 * boundary: it may import a heavy package itself, because nothing loads it
 * until it is asked for. If any module imported it statically as well, the
 * walk from that module goes through it and still finds the package.
 */
function lazyTargets(files: string[]): Set<string> {
  const targets = new Set<string>();
  for (const file of files) {
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const [spec] = node.arguments;
        if (spec && ts.isStringLiteralLike(spec)) {
          const target = resolveImport(file, spec.text);
          if (target && !target.startsWith("pkg:")) targets.add(target);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(file));
  }
  return targets;
}

const show = (chain: string[]) => chain.map((p) => (p.startsWith("pkg:") ? p.slice(4) : relative(SRC, p))).join(" -> ");

describe("what a client module carries into the browser", () => {
  const sources = walk(SRC);
  const lazy = lazyTargets(sources);
  const clientModules = sources
    .filter((file) => !relative(SRC, file).startsWith("app/(dev)/"))
    .filter((file) => directiveOf(file) === "use client")
    .filter((file) => !lazy.has(file));

  it("finds the client modules it is meant to check", () => {
    /* A walk that found nothing would pass every assertion below. */
    expect(clientModules.length).toBeGreaterThan(500);
  });

  it("no client module reaches a heavy package except through import()", () => {
    const offences: string[] = [];
    for (const file of clientModules) {
      const key = relative(SRC, file);
      for (const [name, chain] of reach(file)) {
        if (ALLOWED[key] === name) continue;
        offences.push(`${show(chain)}\n    ${FORBIDDEN[name]}`);
      }
    }
    expect(offences, offences.join("\n")).toEqual([]);
  }, 60_000);

  it("the allow-list names only files that still need it", () => {
    for (const [key, name] of Object.entries(ALLOWED)) {
      const file = join(SRC, key);
      expect(existsSync(file), `${key} no longer exists: delete its line`).toBe(true);
      expect(reach(file).has(name), `${key} no longer reaches ${name}: delete its line`).toBe(true);
    }
  });

  it("treats the call library's module as the lazy boundary it is", () => {
    const session = join(SRC, "components/calls/media/session.ts");
    expect(lazy.has(session)).toBe(true);
    expect(reach(session).has("livekit-client")).toBe(true);
  });

  it("follows an import one file away, the case the lint rule cannot see", () => {
    const rail = join(SRC, "app/(site)/docs/DocsSidebar.tsx");
    const chapters = join(SRC, "app/(site)/docs/chapters.tsx");
    expect(directiveOf(rail)).toBe("use client");
    /* The chapters module itself still reaches the dictionary, on the
       server; the rail must not reach the chapters module. */
    expect(importsOf(chapters).some((p) => p.endsWith("chapters-more.tsx"))).toBe(true);
    expect([...reach(rail).keys()]).toEqual([]);
  });
});
