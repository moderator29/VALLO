/**
 * VERIFIED BEFORE A DEAL (Platform Grade 1, P0.3, November 2026). The pure
 * half, so the rule is a unit test.
 *
 * The founder (6 November 2026): verification is "compulsory before making
 * any deal". For a lister, the deal is sending a listing for review. The rule:
 *
 *   - an approved identity (verification tier 1 or more) passes;
 *   - an identity document on file that is pending or approved passes too, so
 *     nobody waits on our queue to finish a draft: the listing goes into
 *     review, and it publishes only once the identity is approved (the
 *     promise `experienceAccount.kyc.sentMeanwhile` already makes);
 *   - nothing on file, or only refused documents, is refused, with the way
 *     to /verification;
 *   - a QA account is never asked (the phone gate's ruling of 13 October);
 *   - `feature_flags.listing_verification` set to false switches it off with
 *     no deploy.
 */
export type IdentityOnFile = "approved" | "pending" | "refused" | "none";

export function listingVerificationOwed(facts: {
  flagOn: boolean;
  qa: boolean;
  tier: number;
  identity: IdentityOnFile;
}): boolean {
  if (!facts.flagOn || facts.qa) return false;
  if (facts.tier >= 1) return false;
  return facts.identity !== "approved" && facts.identity !== "pending";
}

/** The best of the member's identity documents, from their review states. */
export function identityOnFile(statuses: readonly (string | null)[]): IdentityOnFile {
  if (statuses.includes("approved")) return "approved";
  if (statuses.some((s) => s === "pending" || s === null)) return "pending";
  if (statuses.length > 0) return "refused";
  return "none";
}

export const VERIFY_BEFORE_SUBMIT =
  "Verify your identity before you send a listing for review. It takes about five minutes, and you can keep this draft while you do it.";
export const VERIFY_READ_FAILED =
  "We could not check your verification just now. Nothing has changed. Please try again.";
export const VERIFY_ACTION = "Verify your identity";
