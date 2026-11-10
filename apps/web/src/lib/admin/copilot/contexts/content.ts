import { countOf } from "@vallo/i18n/core";

import { notLive, sentences } from "./common";

export type ContentContextInput = {
  inReview: number;
  drafts: number;
  overdue: number;
  dueThisWeek: number;
  stuckInReview: number;
  publishedThisMonth: number;
  /** Open reports on the feed, when they could be read. */
  openReports: number | null;
  /** Requests from other departments still open. */
  openRequests: number;
};

/** The Content desk as counts. No title, no body and no word from any item. */
export function contentContext(input: ContentContextInput | null): string {
  if (!input) return notLive("Content");
  return sentences([
    `${countOf(input.drafts, "contentItems")} in draft and ${input.inReview} waiting for approval`,
    `${input.dueThisWeek} planned for this week and ${input.overdue} past their planned date`,
    input.stuckInReview > 0 ? `${input.stuckInReview} in review for more than a week` : null,
    `${countOf(input.publishedThisMonth, "contentItems")} published this month`,
    input.openRequests > 0 ? `${input.openRequests} open requests from other departments` : null,
    input.openReports !== null ? `${countOf(input.openReports, "reports")} open on the feed moderation queue` : null,
  ]);
}
