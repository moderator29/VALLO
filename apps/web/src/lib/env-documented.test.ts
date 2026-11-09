import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every environment variable the application reads is documented in both
 * places an operator looks: the one template (`apps/web/.env.example`), as an
 * assignment line, and the operator's reference (`docs/ENVIRONMENT.md`), as a
 * code-formatted name.
 *
 * DOC-16: `ENVIRONMENT.md` had drifted to omit VAPID, the auth hook secret,
 * Yellow Card, the inspection report switch and the store and social URLs, and
 * the template omitted Yellow Card and the inspection switch. A variable that
 * is read and not documented is a capability nobody knows how to switch on.
 *
 * How names are found, and why an unexplained indirect read fails the test:
 *   - `process.env.NAME` and `process.env["NAME"]`;
 *   - `env.NAME`, for functions that take the environment as a parameter;
 *   - `*_VAR = "NAME"` constants, which the push transports read through;
 *   - a helper whose body reads `process.env[<its parameter>]`, called with a
 *     string literal in the same file (e.g. `envInt("BOT_INPUT_KOBO_PER_MTOK")`).
 * Any other `process.env[<expression>]` is a read this scan cannot name, so it
 * is reported rather than silently missed.
 */
const WEB = join(__dirname, "..", "..");
const ROOT = join(WEB, "..", "..");

/** Set by Next.js or Vercel; documented as such in ENVIRONMENT.md, never in the template. */
const PLATFORM = new Set([
  "NODE_ENV",
  "NEXT_RUNTIME",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_PROJECT_PRODUCTION_URL",
  /* Injected by the platform at build and deploy time, never set by hand: the
     deploy's own id, and the build id the client stamps on error reports. */
  "VERCEL_DEPLOYMENT_ID",
  "NEXT_PUBLIC_BUILD_ID",
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const SCANNED = [...sourceFiles(join(WEB, "src")), join(WEB, "next.config.ts"), join(WEB, "capacitor.config.ts")];

type Scan = { names: Set<string>; unexplained: string[] };

function scanSource(files: { path: string; text: string }[]): Scan {
  const names = new Set<string>();
  const unexplained: string[] = [];
  const direct = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /process\.env\[["']([A-Z][A-Z0-9_]+)["']\]/g,
    /\benv\.([A-Z][A-Z0-9_]{3,})\b/g,
    /_VAR\s*=\s*["']([A-Z][A-Z0-9_]+)["']/g,
  ];
  for (const { path, text } of files) {
    for (const re of direct) for (const m of text.matchAll(re)) if (m[1]) names.add(m[1]);

    /* Helpers that read process.env[<parameter>], and the literals passed to them. */
    const helpers = new Map<string, string>();
    for (const m of text.matchAll(/function\s+(\w+)\s*\(\s*(\w+)[^)]*\)[^{]*\{[^}]*?process\.env\[\s*\2\s*\]/g)) {
      if (m[1] && m[2]) helpers.set(m[1], m[2]);
    }
    for (const m of text.matchAll(/const\s+(\w+)\s*=\s*\(\s*(\w+)[^)]*\)[^=]*=>[^;]*?process\.env\[\s*\2\s*\]/g)) {
      if (m[1] && m[2]) helpers.set(m[1], m[2]);
    }
    for (const helper of helpers.keys()) {
      for (const m of text.matchAll(new RegExp(`\\b${helper}\\(\\s*["']([A-Z][A-Z0-9_]+)["']`, "g"))) {
        if (m[1]) names.add(m[1]);
      }
    }

    /* Every computed read must be a *_VAR constant or a helper's own parameter. */
    const params = new Set(helpers.values());
    for (const m of text.matchAll(/process\.env\[\s*([^\]"'\s][^\]]*?)\s*\]/g)) {
      const expr = m[1] ?? "";
      if (/_VAR$/.test(expr) || params.has(expr)) continue;
      const line = text.slice(0, m.index ?? 0).split("\n").length;
      unexplained.push(`${path}:${line} process.env[${expr}]`);
    }
  }
  return { names, unexplained };
}

const inTemplate = (template: string, name: string) => new RegExp(`^#?\\s*${name}=`, "m").test(template);
const inReference = (reference: string, name: string) => reference.includes(`\`${name}\``);

describe("environment variables are documented", () => {
  const scan = scanSource(SCANNED.map((path) => ({ path: relative(WEB, path), text: readFileSync(path, "utf8") })));
  const template = readFileSync(join(WEB, ".env.example"), "utf8");
  const reference = readFileSync(join(ROOT, "docs", "ENVIRONMENT.md"), "utf8");

  it("finds the variables the code reads, direct and through helpers (the scan itself works)", () => {
    for (const known of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "PAYSTACK_SECRET_KEY",
      "VAPID_PRIVATE_KEY",
      "YELLOWCARD_API_KEY",
      "BOT_INPUT_KOBO_PER_MTOK",
      "CAPACITOR_SERVER_URL",
    ]) {
      expect(scan.names.has(known), `scan missed ${known}`).toBe(true);
    }
  });

  it("can explain every computed process.env[...] read", () => {
    expect(scan.unexplained, "a read the scan cannot name; teach the scan its pattern").toEqual([]);
  });

  it("gives every one an assignment line in apps/web/.env.example", () => {
    const missing = [...scan.names].filter((n) => !PLATFORM.has(n) && !inTemplate(template, n)).sort();
    expect(missing, `read by the app, no NAME= line in .env.example: ${missing.join(", ")}`).toEqual([]);
  });

  it("names every one, code-formatted, in docs/ENVIRONMENT.md", () => {
    const missing = [...scan.names].filter((n) => !inReference(reference, n)).sort();
    expect(missing, `read by the app, absent from docs/ENVIRONMENT.md: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not count a comment or prose that merely mentions the name", () => {
    expect(inTemplate("# YELLOWCARD_API_KEY is optional\n", "YELLOWCARD_API_KEY")).toBe(false);
    expect(inTemplate("YELLOWCARD_API_KEY=\n", "YELLOWCARD_API_KEY")).toBe(true);
    expect(inTemplate("# YELLOWCARD_API_KEY=\n", "YELLOWCARD_API_KEY")).toBe(true);
    expect(inReference("YELLOWCARD_API_KEY is mentioned in prose", "YELLOWCARD_API_KEY")).toBe(false);
  });

  it("sees a helper-literal read and reports an unexplained computed read", () => {
    const fixture = scanSource([
      {
        path: "fixture.ts",
        text: 'function envInt(name: string, f: number) { return Number(process.env[name]) || f; }\nconst a = envInt("SOME_RATE", 1);\nconst b = process.env[key];\n',
      },
    ]);
    expect(fixture.names.has("SOME_RATE")).toBe(true);
    expect(fixture.unexplained).toEqual(["fixture.ts:3 process.env[key]"]);
  });

  it("keeps one template: apps/web/.env.local.example does not come back", () => {
    expect(() => statSync(join(WEB, ".env.local.example"))).toThrow();
  });
});
