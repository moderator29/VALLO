import { countWord, sentences } from "./common";

/**
 * The roommates page reads its figures per tab, inside the tab, so the context
 * carries the tab, what the desk holds, and where the figures come from. It
 * takes the counts when a caller has them.
 */
export function roommatesContext(tabLabel: string, counts?: { verificationsWaiting?: number | null; openCases?: number | null } | null): string {
  const waiting = counts?.verificationsWaiting ?? null;
  const cases = counts?.openCases ?? null;
  return sentences([
    "This is the Roommates moderation desk: profiles, posts, groups, verification checks, schools and matching weights",
    `The viewer has the ${tabLabel} tab open`,
    waiting !== null ? `${countWord(waiting, "verification check")} waiting` : null,
    cases !== null ? `${countWord(cases, "open roommates case")}` : null,
    "Reports about roommates are decided as cases",
    waiting === null && cases === null
      ? "No figures are passed from this page, so do not quote any numbers from the screen: call the case and verification reads for the counts"
      : null,
  ]);
}
