import { plural } from "@vallo/i18n/core";

/**
 * ONE SHAPE FOR EVERY CROSS-CHECK FINDING (15 November 2026).
 *
 * The cross-checks on the verification desk come from several places: pure
 * rules run in the browser (the passport zone, the shape of a number, the
 * names side by side) and reads made on the server (the same number or file
 * on another account, what an image file says about how it was saved). Every
 * one of them answers in this one shape, so the panel can list them together,
 * worst first.
 *
 * WHAT A LEVEL MEANS, AND WHAT IT NEVER MEANS.
 *   stop   something a reviewer must not approve past: escalate.
 *   look   a hint. Look closer; it may be innocent.
 *   ok     this rule found nothing wrong. It is NOT proof of anything.
 *
 * `notRun` marks a rule that could not run (a read failed, or the database
 * part is not in place yet). It never blocks the reviewer and never reads as
 * "nothing found".
 *
 * PURE, AND NO PERSONAL DATA IN THE WORDS. A finding about another account
 * says how many, never whose: the link opens the admin record, which has its
 * own door.
 */

export type FindingLevel = "ok" | "look" | "stop";

export type FindingLink = { href: string; label: string };

export type Finding = {
  /** Stable, unique in one panel: "id_number.shared", "file.front.editor". */
  key: string;
  level: FindingLevel;
  /** A few plain words: what was found. */
  title: string;
  /** One sentence: what it means and what to do. */
  detail: string;
  /** True when the rule could not run at all. */
  notRun?: true;
  /** Admin records to open, when the finding is about other accounts. */
  links?: readonly FindingLink[];
};

export function finding(key: string, level: FindingLevel, title: string, detail: string, links?: readonly FindingLink[]): Finding {
  return links && links.length > 0 ? { key, level, title, detail, links } : { key, level, title, detail };
}

/** A rule that failed to run. `what` finishes the sentence "This check could not run: ...". */
export function couldNotRun(key: string, what: string): Finding {
  return {
    key,
    level: "look",
    notRun: true,
    title: `This check could not run: ${what}`,
    detail: "Nothing was found and nothing was ruled out. Carry on with the other checks and with your own eyes.",
  };
}

/** A rule waiting on its database part. `what` finishes "Not available yet: ...". */
export function notAvailableYet(key: string, what: string): Finding {
  return {
    key,
    level: "look",
    notRun: true,
    title: `Not available yet: ${what}`,
    detail: "This comparison is waiting to be switched on in the database. Until then, nothing is compared and nothing is ruled out.",
  };
}

/** Where a finding sorts: stop, then look, then what could not run, then fine. */
export function findingRank(item: Finding): number {
  if (item.notRun) return 2;
  if (item.level === "stop") return 0;
  if (item.level === "look") return 1;
  return 3;
}

/** Worst first. Findings of the same rank keep the order they came in. */
export function orderFindings(findings: readonly Finding[]): Finding[] {
  return findings
    .map((item, index) => ({ item, index }))
    .sort((a, b) => findingRank(a.item) - findingRank(b.item) || a.index - b.index)
    .map((entry) => entry.item);
}

/** Later findings replace earlier ones that carry the same key. */
export function mergeFindings(...groups: readonly (readonly Finding[])[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const group of groups) for (const item of group) byKey.set(item.key, item);
  return [...byKey.values()];
}

export type FindingCounts = { stop: number; look: number; ok: number; notRun: number };

export function countFindings(findings: readonly Finding[]): FindingCounts {
  const counts: FindingCounts = { stop: 0, look: 0, ok: 0, notRun: 0 };
  for (const item of findings) {
    if (item.notRun) counts.notRun += 1;
    else counts[item.level] += 1;
  }
  return counts;
}

/** The word a reviewer reads beside a finding. */
export function levelWord(item: Finding): string {
  if (item.notRun) return "Not run";
  if (item.level === "stop") return "Stop";
  if (item.level === "look") return "Look closer";
  return "Fine";
}

/** "1 other account", "3 other accounts". */
export function otherAccounts(count: number): string {
  return plural(count, { one: "{count} other account", other: "{count} other accounts" });
}

/** The sentence under the panel's heading. The same words on every person, on purpose. */
export const CROSS_CHECK_SUMMARY =
  "Nothing here proves the ID is genuine. These checks catch common forgeries and reused IDs. If anything says Stop, or you still doubt it, do not approve and do not tell the member: escalate.";
