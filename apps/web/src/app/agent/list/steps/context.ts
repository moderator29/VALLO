import type { ReactNode } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import type { ListingFact } from "@/lib/agent/listings-model";
import type { ListingKind, Money, Values } from "./model";

/**
 * What every step component is handed: the ONE state store's answers and its
 * setter, the marks of a pasted broadcast, the server's field errors, the
 * words, and the money worked out once. A step owns no state of its own that
 * the save or the send would need; it draws a question and calls `set`.
 */
export type StepCtx = {
  values: Values;
  set: <K extends keyof Values>(key: K, value: Values[K]) => void;
  /** V-09: the "From your message" mark for one or more fields, or nothing. */
  mark: (...keys: (keyof Values)[]) => ReactNode;
  errors: Record<string, string>;
  copy: Dictionary["agentListings"];
  /** The searcher's move-in words, so the agent's breakdown reads as the listing's does. */
  moveInCopy: Dictionary["moveIn"];
  /** V-46: who each move-in line is paid to. */
  moneyMapCopy?: Dictionary["afterTheGate"]["moneyMap"];
  /** V-13: the sentence that refuses an unexplained remainder in the total. */
  remainderCopy?: Dictionary["afterTheGate"]["remainder"];
  locale: Locale;
  kind: ListingKind;
  asks: (fact: ListingFact) => boolean;
  money: Money;
  /** "One more bedrooms", read as a sentence in the reader's language. */
  counterAria: (direction: "fewer" | "more", label: string) => string;
};
