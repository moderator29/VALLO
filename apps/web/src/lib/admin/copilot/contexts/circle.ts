import { countWord, notLive, sentences } from "./common";

export type CircleContextInput = {
  /** Communities in the current view. */
  communities: number;
  live: number;
  paused: number;
  removed: number;
  /** Posts held and open cases summed over the communities shown. */
  held: number;
  openCases: number;
  statusFilter: string | null;
};

export function circleContext(input: CircleContextInput | null): string {
  if (!input) return notLive("Circle");
  return sentences([
    `${countWord(input.communities, "community", "communities")} in this view${input.statusFilter ? ` (status: ${input.statusFilter})` : ""}: ${input.live} live, ${input.paused} paused, ${input.removed} removed`,
    `${countWord(input.held, "post")} held and ${countWord(input.openCases, "open case")} across them`,
  ]);
}
