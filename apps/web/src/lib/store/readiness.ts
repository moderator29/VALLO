import { deepLinkProblems } from "../native/deep-link-readiness";

/**
 * V-52: THE STORE READINESS DESK, AS PURE VERDICTS.
 *
 * Every check here is a known reason an App Store or Play reviewer rejects a
 * build, and every one of them used to live in prose, spread across
 * `STORE_SUBMISSION_NOTES.md`, `MOBILE.md`, `MOBILE_READINESS.md` and an open
 * alert. The founder submits alone. A panel that goes green only when the
 * live platform would pass is the difference between one review cycle and
 * four, and it tells him the one thing to fix when it is red.
 *
 * THE SPLIT. `run.ts` gathers evidence (a database read, an HTTP fetch of our
 * own public pages, an environment variable's presence) and this file turns
 * evidence into a verdict. Every function below is pure, so each verdict is
 * tested against the evidence that would produce it rather than against a
 * live platform that happens to be in one state today.
 *
 * THREE STATES, AND THE THIRD ONE IS HONEST. `pass` and `fail` are claims
 * about the platform. `unknown` means the evidence could not be gathered (a
 * fetch timed out, the database refused, a check cannot be run from a server
 * at all) and it says why. A check that could not run is never painted green:
 * that would be the claims rule broken on the one screen whose whole job is
 * not to break it.
 *
 * Copy is passed in from the dictionary (`frontDoor.store`); nothing here
 * writes a sentence of its own.
 */

export type CheckState = "pass" | "fail" | "unknown";

export type StoreCheckKey =
  | "abuseFilter"
  | "reportBlock"
  | "reviewer"
  | "deleteAccount"
  | "deepLinks"
  | "privacyProcessors"
  | "exampleLabel"
  | "nativeStart"
  | "versions";

export type StoreCheck = {
  key: StoreCheckKey;
  state: CheckState;
  /** What was seen, in a sentence. */
  detail: string;
  /** The one thing to do, when it is not green. */
  fix: string | null;
};

/** The order the panel draws them in: the store guideline order. */
export const STORE_CHECK_ORDER: readonly StoreCheckKey[] = [
  "abuseFilter",
  "reportBlock",
  "reviewer",
  "deleteAccount",
  "deepLinks",
  "privacyProcessors",
  "exampleLabel",
  "nativeStart",
  "versions",
];

export type StoreCopy = {
  checks: Record<StoreCheckKey, { title: string; pass: string; fail: string; fix: string; passNone?: string; notConfigured?: string }>;
  couldNotRun: string;
  couldNotRunFix: string;
  why: { database: string; signIn: string; page: string; files: string; privacy: string; landing: string; start: string };
  problems: { placeholder: string; aasaNotJson: string; linksNotJson: string };
};

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

function unknown(key: StoreCheckKey, copy: StoreCopy, why: string): StoreCheck {
  return {
    key,
    state: "unknown",
    detail: fill(copy.couldNotRun, { why }),
    fix: copy.couldNotRunFix,
  };
}

/* ------------------------------------------------------------ guideline 1.2 */

export type StoreFacts = {
  blocked_terms: number;
  pattern_ready: boolean;
  report_insert_grant: boolean;
  report_insert_policy: boolean;
  block_insert_grant: boolean;
  block_insert_policy: boolean;
};

/** 1. The objectionable-content filter has terms and a pattern that matches. */
export function abuseFilterCheck(facts: StoreFacts | null, copy: StoreCopy, why?: string): StoreCheck {
  const c = copy.checks.abuseFilter;
  if (facts === null) return unknown("abuseFilter", copy, why ?? copy.why.database);
  const ok = facts.blocked_terms > 0 && facts.pattern_ready;
  return {
    key: "abuseFilter",
    state: ok ? "pass" : "fail",
    detail: fill(ok ? c.pass : c.fail, { count: facts.blocked_terms }),
    fix: ok ? null : c.fix,
  };
}

/** 2. A member's report and block are accepted by the database. */
export function reportBlockCheck(facts: StoreFacts | null, copy: StoreCopy, why?: string): StoreCheck {
  const c = copy.checks.reportBlock;
  if (facts === null) return unknown("reportBlock", copy, why ?? copy.why.database);
  const ok =
    facts.report_insert_grant &&
    facts.report_insert_policy &&
    facts.block_insert_grant &&
    facts.block_insert_policy;
  return { key: "reportBlock", state: ok ? "pass" : "fail", detail: ok ? c.pass : c.fail, fix: ok ? null : c.fix };
}

/* ------------------------------------------------------- the reviewer's way in */

export type ReviewerEvidence =
  | { configured: false }
  | { configured: true; signedIn: boolean; reason?: string };

/** 3. The reviewer account in the store notes signs in with that password. */
export function reviewerCheck(evidence: ReviewerEvidence | null, copy: StoreCopy): StoreCheck {
  const c = copy.checks.reviewer;
  if (evidence === null) return unknown("reviewer", copy, copy.why.signIn);
  if (!evidence.configured) {
    return { key: "reviewer", state: "fail", detail: c.notConfigured ?? c.fail, fix: c.fix };
  }
  return evidence.signedIn
    ? { key: "reviewer", state: "pass", detail: c.pass, fix: null }
    : {
        key: "reviewer",
        state: "fail",
        detail: `${c.fail} ${evidence.reason ?? ""}`.trim(),
        fix: c.fix,
      };
}

/** 4. Play's deletion URL answers a stranger. */
export function deleteAccountCheck(status: number | null, copy: StoreCopy): StoreCheck {
  const c = copy.checks.deleteAccount;
  if (status === null) return unknown("deleteAccount", copy, copy.why.page);
  const ok = status === 200;
  return {
    key: "deleteAccount",
    state: ok ? "pass" : "fail",
    detail: fill(ok ? c.pass : c.fail, { status }),
    fix: ok ? null : c.fix,
  };
}

/* ------------------------------------------------------------- deep links */

const PLACEHOLDER = "PLACEHOLDER_REPLACE_WITH_";

/**
 * 5. Both association files are real: no placeholder text, a real Apple Team
 * ID, and both Play fingerprints. `deepLinkProblems` is the same rule
 * `scripts/check-deep-links.mjs` applies before a build; this applies it to
 * what the live origin actually serves.
 */
export function deepLinksCheck(
  aasaText: string | null,
  assetlinksText: string | null,
  copy: StoreCopy,
): StoreCheck {
  const c = copy.checks.deepLinks;
  if (aasaText === null || assetlinksText === null) {
    return unknown("deepLinks", copy, copy.why.files);
  }
  const problems: string[] = [];
  if (aasaText.includes(PLACEHOLDER) || assetlinksText.includes(PLACEHOLDER)) {
    problems.push(copy.problems.placeholder);
  }
  let aasa: unknown = null;
  let assetlinks: unknown = null;
  try {
    aasa = JSON.parse(aasaText);
  } catch {
    problems.push(copy.problems.aasaNotJson);
  }
  try {
    assetlinks = JSON.parse(assetlinksText);
  } catch {
    problems.push(copy.problems.linksNotJson);
  }
  if (aasa !== null && assetlinks !== null) {
    for (const problem of deepLinkProblems(aasa, assetlinks)) {
      problems.push(`${problem.file}: ${problem.what}`);
    }
  }
  if (problems.length === 0) return { key: "deepLinks", state: "pass", detail: c.pass, fix: null };
  return {
    key: "deepLinks",
    state: "fail",
    detail: fill(c.fail, { problems: problems.join("; ") }),
    fix: c.fix,
  };
}

/* --------------------------------------------------------- the privacy notice */

/**
 * The processors whose key, when set, means personal data reaches them, and
 * the name the privacy notice must use for each. The environment is read by
 * `run.ts`; only the presence of a key is passed in, never its value.
 */
export const PROCESSORS: readonly { name: string; env: readonly string[] }[] = [
  { name: "Sentry", env: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"] },
  { name: "Paystack", env: ["PAYSTACK_SECRET_KEY", "PAYSTACK_TEST_SECRET_KEY"] },
  { name: "Yellow Card", env: ["YELLOWCARD_API_KEY", "YELLOWCARD_API_SECRET"] },
  { name: "Anthropic", env: ["ANTHROPIC_API_KEY"] },
  { name: "Resend", env: ["RESEND_API_KEY"] },
];

/** The processor names whose key is present, from a presence map. */
export function processorsInUse(present: Readonly<Record<string, boolean>>): string[] {
  return PROCESSORS.filter((p) => p.env.some((key) => present[key] === true)).map((p) => p.name);
}

/** 6. The privacy notice names every processor that is actually switched on. */
export function privacyProcessorsCheck(
  privacyHtml: string | null,
  inUse: readonly string[],
  copy: StoreCopy,
): StoreCheck {
  const c = copy.checks.privacyProcessors;
  if (privacyHtml === null) return unknown("privacyProcessors", copy, copy.why.privacy);
  const text = privacyHtml.replace(/<[^>]+>/g, " ");
  const missing = inUse.filter((name) => !text.toLowerCase().includes(name.toLowerCase()));
  if (missing.length === 0) {
    const detail = inUse.length === 0 && c.passNone ? c.passNone : fill(c.pass, { count: inUse.length });
    return { key: "privacyProcessors", state: "pass", detail, fix: null };
  }
  return {
    key: "privacyProcessors",
    state: "fail",
    detail: fill(c.fail, { names: missing.join(", ") }),
    fix: c.fix,
  };
}

/* ------------------------------------------------------------ guideline 2.3.1 */

/** Listing ids linked from a page's HTML, in order, without repeats. */
export function listingIdsIn(html: string): string[] {
  const out = new Set<string>();
  for (const match of html.matchAll(/\/listing\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g)) {
    if (match[1]) out.add(match[1]);
  }
  return [...out];
}

/**
 * 7. A page a reviewer reaches first never shows an example listing without
 * its label. `exampleIds` are the ids from `listingIdsIn` that the database
 * says are examples; the page passes if it shows none, or carries the label.
 */
export function exampleLabelCheck(
  html: string | null,
  exampleIds: readonly string[] | null,
  label: string,
  copy: StoreCopy,
): StoreCheck {
  const c = copy.checks.exampleLabel;
  if (html === null || exampleIds === null) {
    return unknown("exampleLabel", copy, copy.why.landing);
  }
  if (exampleIds.length === 0) return { key: "exampleLabel", state: "pass", detail: c.pass, fix: null };
  const labelled = html.includes(label);
  return labelled
    ? { key: "exampleLabel", state: "pass", detail: c.pass, fix: null }
    : {
        key: "exampleLabel",
        state: "fail",
        detail: fill(c.fail, { count: exampleIds.length }),
        fix: c.fix,
      };
}

/* ---------------------------------------------------------------- V-11 start */

/**
 * 8. The shell never opens on the marketing page. Two redirects are read with
 * no cookies (a fresh install): the shell's own start, and `/` as the shell
 * asks for it. Both must land on welcome or sign in; never on `/`.
 */
export function nativeStartCheck(
  startLocation: string | null,
  landingLocation: string | null,
  copy: StoreCopy,
): StoreCheck {
  const c = copy.checks.nativeStart;
  if (startLocation === null && landingLocation === null) {
    return unknown("nativeStart", copy, copy.why.start);
  }
  const path = (location: string | null) => {
    if (location === null) return null;
    try {
      return new URL(location, "https://vallo.invalid").pathname;
    } catch {
      return null;
    }
  };
  const start = path(startLocation);
  const landing = path(landingLocation);
  const startOk = start === "/welcome" || start === "/sign-in";
  const landingOk = landing === "/home-or-landing";
  if (startOk && landingOk) {
    return { key: "nativeStart", state: "pass", detail: fill(c.pass, { path: start ?? "" }), fix: null };
  }
  return {
    key: "nativeStart",
    state: "fail",
    detail: fill(c.fail, { start: start ?? "nothing", landing: landing ?? "the landing page" }),
    fix: c.fix,
  };
}

/** 9. Version drift cannot be read from a running server; it says so. */
export function versionsCheck(copy: StoreCopy): StoreCheck {
  const c = copy.checks.versions;
  return { key: "versions", state: "unknown", detail: c.fail, fix: c.fix };
}

/** The panel's headline: how many are green, and whether any is red. */
export function summarise(checks: readonly StoreCheck[]): { pass: number; fail: number; unknown: number } {
  return {
    pass: checks.filter((c) => c.state === "pass").length,
    fail: checks.filter((c) => c.state === "fail").length,
    unknown: checks.filter((c) => c.state === "unknown").length,
  };
}
