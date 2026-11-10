import { countOf } from "@vallo/i18n/core";

import { notLive, sentences } from "./common";

export type SupportLeadContextInput = {
  open: number | null;
  unassigned: number | null;
  late: number | null;
  escalated: number | null;
  oldestOpenHours: number | null;
  qaReviewsThisWeek: number;
  policyDraftsWaiting: number;
  macrosWaiting: number;
  gapsOpen: number;
};

/** The Support Lead desk as counts. No ticket text, no member and no agent name. */
export function supportLeadContext(input: SupportLeadContextInput | null): string {
  if (!input) return notLive("Support lead");
  const n = (v: number | null, say: (x: number) => string) => (v === null ? null : say(v));
  return sentences([
    n(input.open, (v) => `${countOf(v, "tickets")} open, ${input.unassigned ?? 0} of them with nobody holding them`),
    n(input.late, (v) => `${countOf(v, "tickets")} past their promised time`),
    n(input.escalated, (v) => `${countOf(v, "tickets")} escalated to another desk`),
    n(input.oldestOpenHours, (v) => `the oldest open ticket is ${v} hours old`),
    `${countOf(input.qaReviewsThisWeek, "qaReviews")} written in the last seven days`,
    `${countOf(input.policyDraftsWaiting, "policyNotes")} waiting for approval and ${countOf(input.macrosWaiting, "macros")} waiting for approval`,
    input.gapsOpen > 0 ? `${countOf(input.gapsOpen, "gaps")} open in the knowledge base` : null,
  ]);
}
