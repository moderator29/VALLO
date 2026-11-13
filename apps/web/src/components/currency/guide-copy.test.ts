import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * 13 November 2026: GuideScope (a server component) called guideCopyOf while it
 * was exported from the "use client" provider. tsc passed, and a production
 * build then threw "Attempted to call guideCopyOf() from the server" and
 * rendered /search with no listings. The helper lives in a plain module now.
 */
const read = (f: string) => readFileSync(join(__dirname, f), "utf8");

describe("the guide copy helper", () => {
  it("lives in a module the server can call", () => {
    expect(read("guide-copy.ts")).not.toMatch(/^\s*["']use client["']/m);
  });
  it("is what GuideScope calls, never the client provider's export", () => {
    const scope = read("GuideScope.tsx");
    expect(scope).toMatch(/import \{ guideCopyOf[^}]*\} from "\.\/guide-copy"/);
    expect(scope).not.toMatch(/import \{[^}]*\bguideCopyOf\b[^}]*\} from "\.\/DisplayMoneyProvider"/);
  });
  it("is no longer exported as a function from the client provider", () => {
    expect(read("DisplayMoneyProvider.tsx")).not.toMatch(/export function guideCopyOf/);
  });
});
