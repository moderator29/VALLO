/**
 * WHO HAS READ EACH TRANSLATION, AS DATA RATHER THAN A COMMENT.
 *
 * Until 30 September 2026 the only record of review state was the header of
 * each locale file ("NEEDS NATIVE REVIEW BEFORE LAUNCH"), which a person can
 * read and no script can. This registry is the machine-readable version, and
 * the completeness report (`apps/web/src/lib/i18n/locale-completeness.ts`)
 * reads it, so every key a Hausa, Yoruba or Igbo reader sees is counted as
 * one of three things:
 *
 *   - `machine-draft`: written without a native speaker, in a module under
 *     `locales/drafts/<locale>/`. Readable, consistent with the terms already
 *     in the locale file, and NOT FINAL. A speaker must read every one.
 *   - `unreviewed`: declared in the locale file itself (`ha.ts`, `yo.ts`,
 *     `ig.ts`). Those files were also written without a native speaker's
 *     sign-off, and their headers say so, so nothing there is counted as
 *     reviewed either.
 *   - `native-reviewed`: a named speaker has read the namespace and signed it
 *     off. Nothing is in this state yet; the first speaker's pass moves
 *     namespaces here, one entry each.
 *
 * A namespace moves from `machine-draft` to `native-reviewed` by editing its
 * entry here in the same commit as the speaker's corrections, with the
 * reviewer and the date. Deleting a draft entry without a review is what the
 * test in `locale-completeness.test.ts` refuses.
 */
import type { Locale } from "./core";

export type TranslatedLocale = Exclude<Locale, "en">;

export type ReviewState = "machine-draft" | "unreviewed" | "native-reviewed";

export type NamespaceReview =
  | { state: "machine-draft"; drafted: string; note?: string }
  | { state: "native-reviewed"; reviewer: string; reviewed: string };

/**
 * The namespaces drafted on 30 September 2026 (recommendation C11): the
 * English modules nobody had started, and the host workspace copy moved out
 * of the pages. Order is the speaker brief's order, by reach.
 */
export const DRAFTED_2026_09_30 = [
  "passcode",
  "desk",
  "publicMeta",
  "hostWorkspace",
  "frontDoor",
  "landingRooms",
  "trustDoors",
  "shape",
  "afterTheGate",
  "trustVisible",
  "platform",
  "priceCheck",
  "landlord",
  "cryptoPay",
  "arrivalCheck",
  "reel",
  "mail",
  "compliancePep",
  "complianceRisk",
  "complianceBeneficialOwnership",
] as const;

function drafted(
  namespaces: readonly string[],
  date: string,
): Record<string, NamespaceReview> {
  return Object.fromEntries(
    namespaces.map((ns) => [ns, { state: "machine-draft", drafted: date } as const]),
  );
}

/** Schedule a visit (`/listing/[id]/visit`), drafted with the flow. */
export const DRAFTED_2026_10_13 = ["visit"] as const;

/**
 * The signed-in member flows' words moved out of the components in the
 * language audit (booking a table, reserving a stay, the rental panel, the
 * conversation, viewings).
 */
export const DRAFTED_2026_10_17 = ["memberFlows"] as const;

export const REVIEW_STATUS: Record<TranslatedLocale, Record<string, NamespaceReview>> = {
  ha: {
    ...drafted(DRAFTED_2026_09_30, "2026-09-30"),
    ...drafted(DRAFTED_2026_10_13, "2026-10-13"),
    ...drafted(DRAFTED_2026_10_17, "2026-10-17"),
  },
  yo: {
    ...drafted(DRAFTED_2026_09_30, "2026-09-30"),
    ...drafted(DRAFTED_2026_10_13, "2026-10-13"),
    ...drafted(DRAFTED_2026_10_17, "2026-10-17"),
  },
  ig: {
    ...drafted(DRAFTED_2026_09_30, "2026-09-30"),
    ...drafted(DRAFTED_2026_10_13, "2026-10-13"),
    ...drafted(DRAFTED_2026_10_17, "2026-10-17"),
  },
};

/**
 * The review state of one dotted key (`passcode.enterCode`) in one locale.
 * English is the source and is never a draft.
 */
export function reviewStateOf(locale: Locale, key: string): ReviewState {
  if (locale === "en") return "native-reviewed";
  const namespace = key.split(".")[0] ?? "";
  const entry = REVIEW_STATUS[locale][namespace];
  return entry?.state ?? "unreviewed";
}

/** Every locale that still carries machine drafts, with their namespaces. */
export function draftNamespaces(locale: TranslatedLocale): string[] {
  return Object.entries(REVIEW_STATUS[locale])
    .filter(([, entry]) => entry.state === "machine-draft")
    .map(([ns]) => ns);
}

/**
 * COPY THAT STAYS ENGLISH BY DECISION, NOT BY OVERSIGHT.
 *
 * The compliance desk's console: SCUML lanes, goAML and NFIU filings, STR
 * reasoning, risk classes. Only staff read it, it is the language of the
 * reports it produces, and a wrong word in a translated regulatory term is
 * worse than English. The member-facing parts of the same modules (the PEP
 * question a lister answers, the agent's mandate page, the gate's refusal)
 * are NOT here and are drafted like everything else.
 *
 * Dotted prefixes. The completeness report counts these keys as `staff`
 * rather than `missing`, so a real gap is never hidden among them.
 */
export const STAFF_ENGLISH = [
  "compliance",
  "complianceStr",
  "complianceThreshold",
  "complianceRisk.lane",
  "complianceRisk.gate.admin",
  "compliancePep.lane",
  "complianceBeneficialOwnership.lane",
  "complianceBeneficialOwnership.actingFor",
  "complianceBeneficialOwnership.decide",
] as const;

/** Is this dotted key staff-only copy that stays English by decision? */
export function isStaffEnglish(key: string): boolean {
  return STAFF_ENGLISH.some((prefix) => key === prefix || key.startsWith(`${prefix}.`));
}

