import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES, getDictionary } from "@vallo/i18n";
import * as firstRuns from "@/components/app/feature-onboarding/first-runs";
import { GATED_ACTIONS } from "@/components/auth/auth-intent";
import { stringLiterals } from "./source-scan";

/**
 * D48: THE PRODUCT NEVER TELLS A MEMBER THAT VALLO HOLDS THEIR MONEY.
 *
 * On 6 October the experience branch shipped three first runs, "your wallet",
 * "escrow" and "withdrawals", with actions "Open my wallet" and "Open escrow",
 * in the same build as `lib/money/copy.ts` saying "Vallo never holds your
 * money". They were gated only by three keys not being mounted, so one array
 * edit would have published a screen telling a member Vallo was holding their
 * money, which ADR-0002 forbids because it is regulated custody.
 *
 * They were deleted, and this test is what keeps them deleted: it fails if any
 * of those words comes back into a dictionary, a source string, the first-run
 * registry or the sign-in intents. A first run for a provider-held balance
 * (D50) is new copy written against a live rail, not these words restored.
 */

const RETIRED_PHRASES: { label: string; pattern: RegExp }[] = [
  { label: "your wallet", pattern: /\byour wallet\b/i },
  { label: "Open my wallet", pattern: /\bopen my wallet\b/i },
  { label: "Open escrow", pattern: /\bopen escrow\b/i },
];

const RETIRED_FIRST_RUNS = ["wallet", "escrow", "withdrawal"] as const;

/**
 * The one place "your wallet" is legitimately said (D48 item 6): a guest's own
 * external crypto wallet, which Vallo never holds, on the crypto charge page.
 */
const ALLOWED: { path: RegExp; label: string }[] = [{ path: /^cryptoPay\./, label: "your wallet" }];

function leaves(value: unknown, path: string[] = [], out: { path: string; text: string }[] = []) {
  if (typeof value === "string") out.push({ path: path.join("."), text: value });
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) leaves(child, [...path, key], out);
  }
  return out;
}

function offences(items: { path: string; text: string }[]): string[] {
  const found: string[] = [];
  for (const { path, text } of items) {
    for (const { label, pattern } of RETIRED_PHRASES) {
      if (!pattern.test(text)) continue;
      if (ALLOWED.some((allow) => allow.label === label && allow.path.test(path))) continue;
      found.push(`${path}: "${label}"`);
    }
  }
  return found;
}

describe("D48: the retired custody words stay out of every dictionary", () => {
  it.each(LOCALES)("%s says nothing about a wallet, escrow or withdrawal Vallo holds", (locale) => {
    const strings = leaves(getDictionary(locale));
    expect(strings.length).toBeGreaterThan(1000);
    expect(offences(strings)).toEqual([]);
  });

  it.each(LOCALES)("%s has no wallet, escrow or withdrawal first run", (locale) => {
    const firstRun = getDictionary(locale).experienceFeatures.firstRun as Record<string, unknown>;
    for (const key of RETIRED_FIRST_RUNS) expect(Object.keys(firstRun)).not.toContain(key);
  });

  it("catches the strings that shipped, so the patterns cannot quietly stop working", () => {
    expect(
      offences([
        { path: "experienceFeatures.firstRun.wallet.name", text: "your wallet" },
        { path: "experienceFeatures.firstRun.wallet.action", text: "Open my wallet" },
        { path: "experienceFeatures.firstRun.escrow.action", text: "Open escrow" },
      ]),
    ).toHaveLength(3);
  });
});

describe("D48: the first-run registry and the sign-in intents carry no custody", () => {
  it("mounts no wallet, escrow or withdrawal first run and keeps no list waiting for one", () => {
    for (const key of RETIRED_FIRST_RUNS) {
      expect(firstRuns.MOUNTED_FIRST_RUNS as readonly string[]).not.toContain(key);
      expect(firstRuns.isMountedFirstRun(key)).toBe(false);
    }
    expect(Object.keys(firstRuns)).not.toContain("WAITING_FIRST_RUNS");
  });

  it("names no first-run home under a wallet or escrow route", () => {
    for (const home of Object.values(firstRuns.FIRST_RUN_HOME)) {
      expect(home).not.toMatch(/\/(wallet|escrow|withdraw)/);
    }
  });

  it("refuses wallet as a sign-in intent", () => {
    expect(GATED_ACTIONS as readonly string[]).not.toContain("wallet");
  });
});

/* The same phrases as string literals and JSX text in the app's own source, so
   a hard-coded line cannot bring them back around the dictionary. Comments are
   ignored: a comment that records why the words were removed is not a screen. */
const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

describe("D48: no source string says it either", () => {
  it(
    "finds none of the retired phrases in a string literal under src",
    () => {
      const files = sourceFiles(SRC);
      expect(files.length).toBeGreaterThan(200);
      const found: string[] = [];
      for (const file of files) {
        for (const { line, text } of stringLiterals(readFileSync(file, "utf8"))) {
          for (const { label, pattern } of RETIRED_PHRASES) {
            if (pattern.test(text)) found.push(`${relative(SRC, file)}:${line}: "${label}"`);
          }
        }
      }
      expect(found).toEqual([]);
    },
    30_000,
  );
});

/*
 * THE BARE WORD (A9, 6 October). The phrases above caught "your wallet" and
 * missed "wallet" on its own: the notification view printed "Open the wallet"
 * on every rent payment, and the /docs description promised "the wallet".
 * There is no wallet on Vallo (D48), and the Rewards Balance is never called
 * one (D51), so in member copy the word is simply out.
 *
 * What counts as member copy: every string in every experience-*.en.ts module
 * (found on disk, so a new module is covered the day it lands) and in
 * public-meta; and every string literal under src that reads as words (it has
 * a space or opens with a capital), outside the staff and fixture trees. A
 * lower-case token without a space ("wallet", "wallet-chip", "/wallet",
 * "wallet.funding.started") is a storage key, a stored notification kind, a
 * glyph name, a route or a redirect, and is not copy.
 */
const BARE_WALLET = /\bwallet\b/i;
const LOCALES_DIR = join(process.cwd(), "..", "..", "packages", "i18n", "src", "locales");

function namespaceOf(file: string): string {
  return file.replace(/\.en\.ts$/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

const MEMBER_MODULES = readdirSync(LOCALES_DIR)
  .filter((name) => /^experience-[a-z-]+\.en\.ts$/.test(name) || name === "public-meta.en.ts")
  .sort();

/** Trees that are not member copy: staff screens, dev fixtures, glyph tables, generated types. */
const NOT_MEMBER_COPY = [/^app\/\(dev\)\//, /^app\/admin\//, /^lib\/admin\//, /^design-system\//, /^lib\/supabase\/database\.types\.ts$/];

/**
 * Member-visible lines that may say the word, each with its reason. Nothing
 * else may.
 *   - The account-deletion email and the /delete-account table name the
 *     records kept for the anti-money-laundering rules, by the tables they
 *     are (`wallets`, `wallet_entries`, from before ADR-0002). A legal
 *     disclosure of what is retained, not a claim that a wallet exists.
 *   - The payments log line names a legacy wallet id field. Never shown.
 *   - The commission sweep's reason names Vallo's own merchant account at
 *     Payluk by Payluk's word for it; it reaches staff logs, never a member.
 */
const BARE_WALLET_ALLOWED: { file: string; text: RegExp; why: string }[] = [
  {
    file: "lib/money/copy.ts",
    text: /^(From Wallet(: the agreed rent, and nothing more\.)?|Add money to Wallet|Open Wallet( first, then pay from it\.)?|Wallet could not be read just now\. Nothing has been taken; refresh to try again\.)$/,
    why: "D78: the screen's name, on the screen that pays rent from it",
  },
  { file: "lib/account-deletion/emails.ts", text: /\bwallet entries\b/, why: "legal: records retained under AML rules" },
  { file: "lib/account-deletion/plan.ts", text: /^a wallet is a ledger\b/, why: "legal: the retained `wallets` table's reason" },
  { file: "lib/payments/observability.ts", text: /^wallet=/, why: "technical: a log field" },
  {
    file: "lib/payouts/payluk-merchant.ts",
    text: /^Payluk documents no API route that withdraws the merchant wallet\./,
    why: "operations: the commission sweep's reason about Vallo's own Payluk merchant account (Payluk's word); no member surface reads it",
  },
  /* D78 (the founder, 7 October: "What is balance? Call it WALLET"): the
     screen's NAME, capitalised as a name, and only where the screen itself is
     named. Every sentence about the money says account, Available or the
     escrow partner; none says Vallo holds it (HELD_BY stays the custody line). */
  { file: "lib/money/balance-copy.ts", text: /^Wallet$/, why: "D78: the screen's name (BALANCE_TITLE)" },
  { file: "app/(app)/wallet/page.tsx", text: /^Wallet$/, why: "D78: the screen's name (metadata title)" },
  { file: "lib/nav/route-labels.ts", text: /^Wallet$/, why: "D78: the screen's name (route label)" },
  { file: "app/(app)/wallet/page.tsx", text: /^Sign in to open Wallet$/, why: "D78: the screen's name" },
  { file: "app/(app)/wallet/loading.tsx", text: /^Loading Wallet$/, why: "D78: the screen's name" },
  { file: "components/money/balance/BalanceScreen.tsx", text: /^Wallet$/, why: "D78: the screen's name (the explainer's name)" },
  { file: "components/money/balance/BalanceOnboarding.tsx", text: /^Setting up Wallet$/, why: "D78: the screen's name" },
  { file: "lib/money/balance-copy.ts", text: /^Opens when Wallet is connected$/, why: "D78: the screen's name" },
  { file: "lib/money/balance-copy.ts", text: /^(Set up Wallet|Setting up Wallet|Wallet is ready|We could not set up Wallet)$/, why: "D78: the screen's name (onboarding titles and action)" },
  {
    file: "lib/money/balance-copy.ts",
    text: /^Your money is held by (our escrow partner|Payluk, our licensed provider|our licensed provider), never by Vallo\. To set up Wallet we share/,
    why: "D78: the screen's name, in the sentence that says the partner, never Vallo, holds the money",
  },
  { file: "lib/money/balance-copy.ts", text: /^Wallet is not connected yet, so nothing was sent\.$/, why: "D78: the screen's name" },
  /* D81 (8 October 2026): the founder's governing Wallet reference and his
     brief. The screen's name again, on its own screens: the gear's
     destination, the "Pay for your space with VALLO Wallet" banner he kept
     from the left-hand phone (rent paid from Wallet is held by the partner
     until the move-in, FUND_STEPS), and the one plain line each move-money
     screen ends on before Wallet is connected. None says Vallo holds money. */
  { file: "lib/money/balance-copy.ts", text: /^Wallet settings$/, why: "D81: the screen's name (the tools destination)" },
  { file: "lib/nav/route-labels.ts", text: /^Wallet settings$/, why: "D81: the screen's name (route label)" },
  { file: "lib/money/balance-copy.ts", text: /^Pay for your space with Vallo Wallet$/, why: "D81: the founder's banner, the product's name" },
  { file: "lib/money/balance-copy.ts", text: /^Pay agreed rent from Wallet\. It is released only when you confirm the move-in\.$/, why: "D81: the banner's line; the partner holds it until the move-in (FUND_STEPS)" },
  {
    file: "lib/money/balance-copy.ts",
    text: /^(Adding money opens|Sending opens|Withdrawals open) when Wallet is connected\. Nothing (was charged|was sent|has moved)\.$/,
    why: "D81: the honest last step before the provider is connected",
  },
  { file: "lib/money/balance-copy.ts", text: /^Back to Wallet$/, why: "D81: the screen's name" },
];

/**
 * D78 (7 October 2026, evening): THE FOUNDER NAMED THE SCREEN "Wallet". "What
 * is balance? Call it wallet." The word is allowed as the NAME of the member's
 * money screen (the account the licensed escrow partner holds and Vallo reads,
 * ADR 0003), and only as that name: these dictionary paths, and the literals
 * the Wallet screen lists in BARE_WALLET_ALLOWED with the same reason. The
 * custody rule itself stands: no line may say Vallo holds a member's money,
 * which the phrase checks above still enforce.
 */
const WALLET_NAME_PATHS: readonly string[] = ["experienceShell.navBalance"];

function readsAsWords(text: string): boolean {
  /* An interpolation is code, not words: `${origin}/wallet?funded=1` is an address. */
  const words = text.replace(/\$\{[^{}]*\}/g, "").trim();
  return /\s/.test(words) || /^[A-Z]/.test(words);
}

describe("D48: the bare word wallet is out of member copy", () => {
  it("finds the member dictionary modules, public-meta among them", () => {
    expect(MEMBER_MODULES.length).toBeGreaterThan(15);
    expect(MEMBER_MODULES).toContain("public-meta.en.ts");
    expect(MEMBER_MODULES).toContain("experience-inbox.en.ts");
  });

  it.each(LOCALES)("%s: no experience-* or public-meta string says wallet", (locale) => {
    const dictionary = getDictionary(locale) as unknown as Record<string, unknown>;
    const found: string[] = [];
    for (const file of MEMBER_MODULES) {
      const namespace = namespaceOf(file);
      expect(dictionary[namespace], `${file} is registered as ${namespace}`).toBeDefined();
      for (const { path, text } of leaves(dictionary[namespace], [namespace])) {
        if (BARE_WALLET.test(text) && !WALLET_NAME_PATHS.includes(path)) found.push(`${path}: "${text}"`);
      }
    }
    expect(found).toEqual([]);
  });

  it("names no notification's object a wallet", () => {
    const objects = getDictionary("en").experienceInbox.notificationView.objects as Record<string, string>;
    expect(Object.keys(objects)).not.toContain("wallet");
    for (const noun of Object.values(objects)) expect(noun).not.toMatch(BARE_WALLET);
  });

  it(
    "finds it in no member-visible string literal under src",
    () => {
      const files = sourceFiles(SRC);
      const found: string[] = [];
      for (const file of files) {
        const at = relative(SRC, file).split("\\").join("/");
        if (NOT_MEMBER_COPY.some((tree) => tree.test(at))) continue;
        for (const { line, text } of stringLiterals(readFileSync(file, "utf8"))) {
          if (!BARE_WALLET.test(text) || !readsAsWords(text)) continue;
          if (BARE_WALLET_ALLOWED.some((allow) => allow.file === at && allow.text.test(text))) continue;
          found.push(`${at}:${line}: "${text.slice(0, 120)}"`);
        }
      }
      expect(found).toEqual([]);
    },
    30_000,
  );

  it("tells a key from copy, so the scan cannot quietly pass everything", () => {
    for (const key of ["wallet", "wallet-chip", "/wallet", "wallet.funding.started", "/wallet/transactions", "${await siteOrigin()}/wallet?funded=1"]) {
      expect(readsAsWords(key), key).toBe(false);
    }
    for (const copy of ["Open the wallet", "Wallet", "the stays journey, the wallet, Around"]) {
      expect(readsAsWords(copy) && BARE_WALLET.test(copy), copy).toBe(true);
    }
  });
});
