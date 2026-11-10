import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  consentCookieString,
  consentFromCookieHeader,
  parseConsent,
  serialiseConsent,
} from "./consent";
import { inventoryCovers } from "./consent-save";
import { CATEGORY_ORDER, STORAGE_INVENTORY, itemsIn } from "./inventory";

/**
 * THE COOKIES PAGE CANNOT DRIFT FROM THE APP. The page's table is generated
 * from `STORAGE_INVENTORY`; this test reads the source for every cookie and
 * storage key the code names and fails when one is missing from the inventory.
 */
const SRC = join(__dirname, "..", "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

/* A constant whose name says it is a cookie or a storage key, with a Vallo-shaped value. */
const KEY_CONSTANT = /const\s+([A-Z][A-Z0-9_]*(?:COOKIE|_KEY))\s*(?::\s*string)?\s*=\s*["'`]((?:nf|vallo)[-_.:a-zA-Z0-9]*)["'`]/g;

/* Values that are keys of something else, not browser storage. */
const NOT_STORAGE = new Set(["nfSeq", "nfStep", "nfGsSlide", "nfUnsaved", "nf_history_seq"]);

describe("the inventory covers what the code stores", () => {
  it("names every cookie and storage key constant in the source", () => {
    const missing: string[] = [];
    for (const file of files(SRC)) {
      if (/\/\(dev\)\//.test(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(KEY_CONSTANT)) {
        const value = match[2]!;
        if (NOT_STORAGE.has(value)) continue;
        if (!inventoryCovers(value)) missing.push(`${relative(SRC, file)}: ${match[1]} = ${value}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("names the literal keys written straight to storage", () => {
    const missing: string[] = [];
    const literal = /(?:local|session)Storage\.(?:set|get)Item\(\s*["'`]([^"'`]+)["'`]/g;
    for (const file of files(SRC)) {
      if (/\/\(dev\)\//.test(file)) continue;
      for (const match of readFileSync(file, "utf8").matchAll(literal)) {
        const name = match[1]!.replace(/\$\{[^}]*\}.*$/, "*");
        if (!inventoryCovers(name) && !inventoryCovers(name.replace(/\*$/, ""))) missing.push(`${relative(SRC, file)}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("the inventory itself", () => {
  it("has unique kind and name pairs, a purpose and a lifetime for every item", () => {
    const seen = new Set<string>();
    for (const item of STORAGE_INVENTORY) {
      const key = `${item.kind}:${item.name}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
      expect(item.purpose.length, item.id).toBeGreaterThan(10);
      expect(item.lifetime.length, item.id).toBeGreaterThan(2);
      expect(`${item.purpose}${item.lifetime}`, item.id).not.toMatch(/—/);
    }
  });

  it("has all three kinds, with the optional ones named for what they are", () => {
    for (const category of CATEGORY_ORDER) expect(itemsIn(category).length, category).toBeGreaterThan(0);
    expect(itemsIn("analytics").map((i) => i.name)).toEqual(["nf_visit", "vallo_via"]);
    expect(itemsIn("preferences").map((i) => i.name)).toContain("nf_recent_searches");
  });

  it("lists the consent cookie itself, as necessary", () => {
    expect(STORAGE_INVENTORY.find((i) => i.name === CONSENT_COOKIE)?.category).toBe("necessary");
  });
});

describe("the choice cookie", () => {
  it("round trips and is versioned", () => {
    expect(serialiseConsent({ preferences: true, analytics: false })).toBe(`${CONSENT_VERSION}.10`);
    expect(parseConsent(`${CONSENT_VERSION}.10`)).toEqual({ version: CONSENT_VERSION, preferences: true, analytics: false });
    expect(parseConsent(`${CONSENT_VERSION}.01`)?.analytics).toBe(true);
  });

  it("treats anything else as no choice yet, so nothing optional is on", () => {
    for (const bad of [null, undefined, "", "x", "1.2", "1.101", `${CONSENT_VERSION + 1}.11`, "0.11"]) {
      expect(parseConsent(bad), String(bad)).toBeNull();
    }
  });

  it("reads from a cookie header and writes a one year first-party cookie", () => {
    expect(consentFromCookieHeader(`a=b; ${CONSENT_COOKIE}=${CONSENT_VERSION}.11; c=d`)?.preferences).toBe(true);
    expect(consentFromCookieHeader("a=b")).toBeNull();
    const set = consentCookieString({ preferences: false, analytics: false }, true);
    expect(set).toContain("path=/");
    expect(set).toContain("max-age=31536000");
    expect(set).toContain("samesite=lax");
    expect(set).toContain("secure");
  });
});
