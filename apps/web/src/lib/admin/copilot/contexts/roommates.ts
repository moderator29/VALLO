import { sentences } from "./common";

/** The roommates page reads its figures per tab, inside the tab, so the context carries only the tab. */
export function roommatesContext(tabLabel: string): string {
  return sentences([
    "This is the Roommates moderation desk: profiles, posts, groups, verification checks, schools and matching weights",
    `The viewer has the ${tabLabel} tab open`,
    "No figures are passed from this page, so do not quote any numbers. Reports about roommates are decided as cases",
  ]);
}
