import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * A SERVER COMPONENT NEVER CALLS A FUNCTION FROM A "use client" MODULE
 * (13 November 2026). Such an import is a client reference on the server: tsc
 * passes, and the production render throws "Attempted to call X() from the
 * server but X is on the client". GuideScope did this and emptied /search in a
 * local production build; the /around/people page had done it since October.
 * Shared helpers belong in a plain module both sides import.
 */
const SRC = join(__dirname, "..");
const files: string[] = [];
(function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) files.push(path);
  }
})(SRC);

const cache = new Map<string, string>();
const read = (f: string) => cache.get(f) ?? (cache.set(f, readFileSync(f, "utf8")), cache.get(f)!);
const directive = (f: string, word: string) => new RegExp(`^["']use ${word}["'];?\\s*$`, "m").test(read(f).slice(0, 600));
const resolve = (from: string, spec: string): string | null => {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? join(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

describe("server components and client modules", () => {
  it("found the component files to check", () => {
    expect(files.length).toBeGreaterThan(500);
  });
  it("no server component calls a function exported from a client module", () => {
    const found: string[] = [];
    for (const file of files) {
      if (directive(file, "client") || directive(file, "server")) continue;
      const source = read(file);
      for (const m of source.matchAll(/import\s+\{([^}]+)\}\s+from\s+"([^"]+)"/g)) {
        const target = resolve(file, m[2]!);
        if (!target || !directive(target, "client")) continue;
        for (const raw of m[1]!.split(",")) {
          const name = raw.trim();
          if (!name || name.startsWith("type ")) continue;
          const local = name.split(/\s+as\s+/).pop()!;
          if (!/^[a-z]/.test(local)) continue;
          if (new RegExp(`\\b${local}\\s*\\(`).test(source)) found.push(`${file.slice(SRC.length + 1)} calls ${local}()`);
        }
      }
    }
    expect(found).toEqual([]);
  });
});
