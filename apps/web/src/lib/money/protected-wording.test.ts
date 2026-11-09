import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROTECTED_CUSTODIAN_NAME,
  PROTECTED_FUNDS_WORDING_FULL,
  PROTECTED_FUNDS_WORDING_SHORT,
  PROTECTED_PROVIDER_NAME,
  THIRD_PARTIES_LINE,
  VALLO_NEVER_HOLDS_PROMISE,
} from "./protected-wording";

/**
 * THE PROVIDER'S FUNDS WORDING IS SHOWN UNALTERED OR NOT AT ALL
 * (PROTECTED_PAYMENTS_BUILD.md section 3, point 3).
 *
 * 1. Both sentences are word for word the provider's, read from the appendix
 *    of PROTECTED_PAYMENTS_SPECS.md itself, so an edit here fails.
 * 2. Nothing outside `protected-wording.ts` names the provider, the custodian
 *    or the central bank in a string a member could read: a screen that wants
 *    them imports the constants, which is also how a near-miss ("held by a
 *    CBN licensed bank until delivery") can never be typed by hand.
 */
const SRC = join(__dirname, "..", "..");
const REPO = join(SRC, "..", "..", "..");
const SPECS = join(REPO, "docs", "handoff", "PROTECTED_PAYMENTS_SPECS.md");
const I18N = join(REPO, "packages", "i18n", "src");

/** Staff, internal and adapter code, where the names are identifiers or configuration, never member copy. */
const ALLOWED = [
  /^apps\/web\/src\/lib\/money\/protected-wording\.ts$/,
  /^apps\/web\/src\/lib\/payments\//,
  /^apps\/web\/src\/app\/admin\//,
  /^apps\/web\/src\/app\/\(dev\)\//,
  /\.test\.tsx?$/,
];

/** The provider, the custodian, or the central bank, as words. */
const NAMES = /\bEscrowPay\b|\bRubies\b|\bCBN\b|Central Bank of Nigeria/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** Every line of code that is not a comment. */
function codeLines(text: string): { line: string; at: number }[] {
  const out: { line: string; at: number }[] = [];
  let block = false;
  text.split("\n").forEach((raw, i) => {
    const t = raw.trim();
    if (block) {
      if (t.includes("*/")) block = false;
      return;
    }
    if (t.startsWith("/*")) {
      if (!t.includes("*/")) block = true;
      return;
    }
    if (t.startsWith("//") || t.startsWith("*")) return;
    out.push({ line: raw.split(" //")[0] ?? raw, at: i + 1 });
  });
  return out;
}

function unwrap(markdown: string): string {
  return markdown.replace(/\n> /g, " ").replace(/\s+/g, " ");
}

describe("the provider's funds wording", () => {
  it("is word for word the wording in the provider's own document", () => {
    const appendix = unwrap(readFileSync(SPECS, "utf8"));
    expect(appendix).toContain(PROTECTED_FUNDS_WORDING_FULL);
    expect(appendix).toContain(PROTECTED_FUNDS_WORDING_SHORT);
  });

  it("names the custodian in the full sentence and the agreed short form in the short one", () => {
    expect(PROTECTED_FUNDS_WORDING_FULL).toContain(PROTECTED_CUSTODIAN_NAME);
    expect(PROTECTED_FUNDS_WORDING_SHORT).toContain("Rubies MFB");
  });

  it("keeps Vallo's own lines free of any name, so they never stand in for the provider's", () => {
    expect(NAMES.test(VALLO_NEVER_HOLDS_PROMISE)).toBe(false);
    expect(NAMES.test(THIRD_PARTIES_LINE)).toBe(false);
    expect(VALLO_NEVER_HOLDS_PROMISE).toContain("Vallo never holds your money.");
  });

  it("names the provider as its agreement does", () => {
    expect(PROTECTED_PROVIDER_NAME).toBe("EscrowPay");
  });
});

describe("nothing outside the wording module names the provider, the custodian or the central bank", () => {
  it("finds no such words in member-reachable code or dictionaries", () => {
    const found: string[] = [];
    for (const file of [...files(SRC), ...files(I18N)]) {
      const at = relative(REPO, file).split("\\").join("/");
      if (ALLOWED.some((rule) => rule.test(at))) continue;
      for (const { line, at: n } of codeLines(readFileSync(file, "utf8"))) {
        if (NAMES.test(line)) found.push(`${at}:${n}: ${line.trim().slice(0, 100)}`);
      }
    }
    expect(found).toEqual([]);
  });
});
