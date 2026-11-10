import { countWord, notLive, sentences } from "./common";

export type QueueContextInput = {
  listings: number;
  applications: number;
  reports: number;
  tickets: number;
  flags: number;
  /** Everything the safety scan is holding. */
  held: number;
  /** The tab the viewer is on, as a plain word. */
  tab: string;
  /** Rows on this view past their promised time, when the view computed it. */
  late: number | null;
};

export function queueContext(input: QueueContextInput | null): string {
  if (!input) return notLive("Queue");
  const total = input.listings + input.applications + input.reports + input.tickets + input.flags;
  return sentences([
    `${countWord(total, "item")} waiting across the queues the viewer can see (${input.listings} listings, ${input.applications} agent applications, ${input.reports} reports, ${input.tickets} support tickets, ${input.flags} message flags)`,
    `${countWord(input.held, "item")} held by the safety scan`,
    input.late !== null ? `${input.late} of the rows on this view are past their promised time` : null,
    `The viewer is on the ${input.tab} tab`,
  ]);
}
