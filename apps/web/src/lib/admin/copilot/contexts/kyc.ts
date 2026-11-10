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

export function kycContext(input: KycContextInput | null): string {
  if (!input) return notLive("Verification");
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
  ]);
}
