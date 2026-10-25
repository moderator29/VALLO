import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "LOOK AROUND FIRST" (Apple 5.1.1(v), 25 October 2026).
 *
 * Version 1.0.0 was rejected because the welcome slides ended on Create
 * account and Sign in only, so a reviewer had to register before browsing.
 * The closing choice now also offers a way in to the open catalogue, and only
 * while the founder's public catalogue switch is on. Read as source so the
 * wiring cannot be dropped without a failing test.
 */
const root = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("the welcome choice offers a way to browse", () => {
  const firstRun = read("components/app/welcome/FirstRun.tsx");
  const page = read("app/welcome/page.tsx");
  const en = readFileSync(join(root, "..", "..", "..", "packages/i18n/src/locales/en.ts"), "utf8");

  it("shows Look around first only when the catalogue is open, and goes to /search", () => {
    expect(firstRun).toMatch(/catalogueOpen\s*\?\s*\(\s*<ButtonLink[\s\S]*?href="\/search"[\s\S]*?welcome-look-around/);
    expect(firstRun).toMatch(/catalogueOpen\s*=\s*false/);
  });

  it("is switched by the same flag the proxy reads, on the stranger's page only", () => {
    expect(page).toContain('import { publicCatalogueEnabled } from "@/lib/catalogue/public-access";');
    expect(page).toContain("catalogueOpen={publicCatalogueEnabled()}");
  });

  it("has its words", () => {
    expect(en).toContain('lookAround: "Look around first"');
  });
});
