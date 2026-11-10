import type { ArrangementStatus } from "@/lib/money/arrangement-states";

/**
 * THE PROVIDER'S STATUS WORDS ONTO VALLO'S STATES (audit section 10.3).
 *
 * TODO(provider-docs): every provider word. The table is empty on purpose:
 * the vocabulary is not documented to us, and a guessed word could mark money
 * as held or released when it is not. An unmapped word is `null`, which the
 * caller records and acts on not at all.
 *
 * Rules that hold when words are added, and that the tests pin:
 *  - funded (`protected`) and `released` come ONLY from a word the
 *    documentation says means exactly that;
 *  - an unknown word is never `released`, never `protected`;
 *  - `split` is historical (Payluk) and is never produced here.
 */
export const ESCROWPAY_STATUS_WORDS: Readonly<Record<string, ArrangementStatus>> = Object.freeze({});

export function normaliseEscrowPayStatus(word: unknown): ArrangementStatus | null {
  if (typeof word !== "string") return null;
  const key = word.trim().toLowerCase();
  if (!key || !Object.prototype.hasOwnProperty.call(ESCROWPAY_STATUS_WORDS, key)) return null;
  const state = ESCROWPAY_STATUS_WORDS[key]!;
  return state === "split" ? null : state;
}
