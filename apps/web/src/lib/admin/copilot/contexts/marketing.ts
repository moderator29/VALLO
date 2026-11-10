import { countOf } from "@vallo/i18n/core";

import { notLive, sentences } from "./common";

export type MarketingContextInput = {
  live: number;
  planned: number;
  waitingApproval: number;
  sentBack: number;
  endingWithinSevenDays: number;
  overBudget: number;
  resultsThisWeek: number;
};

/** The Marketing desk, as one short paragraph of counts. No campaign name, no amount, no budget figure. */
export function marketingContext(input: MarketingContextInput | null): string {
  if (!input) return notLive("Marketing");
  return sentences([
    `${countOf(input.live, "campaigns")} live and ${countOf(input.planned, "campaigns")} planned or in draft`,
    `${input.waitingApproval} waiting for approval and ${input.sentBack} sent back`,
    input.endingWithinSevenDays > 0 ? `${countOf(input.endingWithinSevenDays, "campaigns")} due to end within seven days` : null,
    input.overBudget > 0 ? `${countOf(input.overBudget, "campaigns")} with logged spend over budget` : null,
    `${countOf(input.resultsThisWeek, "results")} logged this week`,
  ]);
}
