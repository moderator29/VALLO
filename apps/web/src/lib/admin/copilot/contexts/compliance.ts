import { countWord, sentences } from "./common";

/**
 * The compliance page reads nothing countable itself: each lane reads its own
 * figures inside the lane. So the context says what the desk is, which lane is
 * open, and where the copilot gets the figures from, and it takes the lane
 * counts when a caller has them.
 */
export type ComplianceContextInput = {
  laneTitle: string | null;
  /** Items waiting in the open lane, when the page knows. */
  waitingInThisLane?: number | null;
  /** Items overdue in the open lane, when the page knows. */
  overdueInThisLane?: number | null;
};

export function complianceContext(lane: string | null | ComplianceContextInput): string {
  const input: ComplianceContextInput = typeof lane === "string" || lane === null ? { laneTitle: lane } : lane;
  const waiting = input.waitingInThisLane ?? null;
  return sentences([
    "This is the Compliance desk, the AML and CFT desk under the Money Laundering (Prevention and Prohibition) Act 2022 and the SCUML checklist",
    "Its lanes are enhanced due diligence reviews, threshold reports, sanctions and politically exposed person checks, and record retention",
    input.laneTitle ? `The viewer has the ${input.laneTitle} lane open` : null,
    waiting !== null ? `${countWord(waiting, "item")} waiting in that lane${typeof input.overdueInThisLane === "number" ? `, ${input.overdueInThisLane} of them overdue` : ""}` : null,
    waiting === null
      ? "No figures are passed from this page, so do not quote any numbers from the screen: call get_compliance_lanes for the counts"
      : null,
  ]);
}
