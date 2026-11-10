import { countWord, notLive, sentences } from "./common";

export type PaymentsContextInput = {
  /** Payments the provider has not settled, when the health read worked. */
  unsettled: number | null;
  /** Live subscriptions by plan status, when the subscriptions read worked. */
  liveSubscriptions: number | null;
  /** The outcome filter in plain words, or null. */
  outcomeFilter: string | null;
  /** A search term was typed (the term itself is never passed). */
  searching: boolean;
};

export function paymentsContext(input: PaymentsContextInput | null): string {
  if (!input) return notLive("Payments");
  return sentences([
    "This desk answers whether the provider has settled what it was sent; Vallo holds no customer money",
    input.unsettled !== null ? `${countWord(input.unsettled, "payment")} not settled by the provider yet` : null,
    input.liveSubscriptions !== null ? `${countWord(input.liveSubscriptions, "live subscription")}` : null,
    input.outcomeFilter ? `The payments table is filtered to the ${input.outcomeFilter} outcome` : null,
    input.searching ? "The viewer is looking up a member" : null,
  ]);
}
