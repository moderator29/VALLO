import { countWord, notLive, sentences } from "./common";

export type KycContextInput = {
  /** Documents nobody has decided yet (exact count). */
  awaiting: number;
  awaitingLastWeek: number;
  passedToday: number;
  failedToday: number;
  decisionsThisWeek: number;
  medianDecisionMinutesThisWeek: number | null;
  /** Identity (selfie) checks waiting, when that panel was read. */
  selfieChecksWaiting: number | null;
};

/**
 * What the desk assistant needs to explain the Cross-checks panel (15 November
 * 2026). A fixed description of the screen, never a figure and never anything
 * about a person, so it is said whether or not the desk's figures were read.
 */
export const KYC_CROSS_CHECKS_NOTE = sentences([
  "Each person on this desk has a Cross-checks panel beside their ID and their photo",
  "It lists findings worst first: Stop means do not approve and escalate, Look closer is a hint that may be innocent, Fine means that one check found nothing wrong, and Not run means the check could not run",
  "It compares the ID number and the files with other accounts, reads how each image file was saved, compares the names, checks a passport's two bottom lines in the browser, and has a by-eye list for each kind of ID",
  "Nothing in it proves an ID is genuine",
  "There is no free lookup of a NIN or a BVN, and a member's ID number is never typed into any outside website, app or chat",
  "For a doubt, the reviewer asks for a photo of the person holding the ID, or presses Escalate to Trust and Safety, and never tells the member what is suspected",
  "The steps are in the playbook Suspected forged ID",
]);

export function kycContext(input: KycContextInput | null): string {
  if (!input) return `${notLive("Verification")} ${KYC_CROSS_CHECKS_NOTE}`;
  const trend =
    input.awaiting > input.awaitingLastWeek
      ? `up from ${input.awaitingLastWeek} a week ago`
      : input.awaiting < input.awaitingLastWeek
        ? `down from ${input.awaitingLastWeek} a week ago`
        : `the same as a week ago`;
  return sentences([
    `${countWord(input.awaiting, "document")} waiting for a decision, ${trend}`,
    `${input.passedToday} passed and ${input.failedToday} failed today`,
    input.decisionsThisWeek > 0 && input.medianDecisionMinutesThisWeek !== null
      ? `${countWord(input.decisionsThisWeek, "decision")} this week, median ${input.medianDecisionMinutesThisWeek} minutes from upload to decision`
      : null,
    input.selfieChecksWaiting !== null ? `${countWord(input.selfieChecksWaiting, "selfie check")} waiting` : null,
    KYC_CROSS_CHECKS_NOTE,
  ]);
}
