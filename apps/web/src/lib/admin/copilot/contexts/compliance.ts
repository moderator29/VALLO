import { sentences } from "./common";

/** The compliance page reads nothing countable itself (each lane reads its own), so the context says only what the desk is. */
export function complianceContext(laneTitle: string | null): string {
  return sentences([
    "This is the Compliance desk, the AML and CFT desk under the Money Laundering (Prevention and Prohibition) Act 2022 and the SCUML checklist",
    laneTitle ? `The viewer has the ${laneTitle} lane open` : null,
    "No figures are passed from this page, so do not quote any numbers",
  ]);
}
