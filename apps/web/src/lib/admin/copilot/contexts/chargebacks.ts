import { countWord, notLive, sentences } from "./common";

export type ChargebacksContextInput = {
  all: number;
  opened: number;
  evidenceRequested: number;
  evidenceSubmitted: number;
  won: number;
  lost: number;
  /** Lost and still owed back. */
  owed: number;
  undecided: number;
};

export function chargebacksContext(input: ChargebacksContextInput | null): string {
  if (!input) return notLive("Chargebacks");
  return sentences([
    input.all === 0
      ? "No chargeback has been recorded"
      : `${countWord(input.all, "chargeback")} recorded, ${input.undecided} not decided yet`,
    input.all > 0 ? `${input.opened} opened, ${input.evidenceRequested} awaiting evidence, ${input.evidenceSubmitted} with evidence submitted` : null,
    input.all > 0 ? `${input.won} won and ${input.lost} lost, ${input.owed} of the lost ones still owed back` : null,
  ]);
}
