import { countWord, notLive, oldestAge, sentences } from "./common";

export type SupportRowFigures = {
  lane: "new" | "waiting_on_us" | "waiting_on_member" | "escalated" | "done";
  breached: boolean;
  createdAt: string;
};

export function supportContext(rows: readonly SupportRowFigures[] | null, nowMs: number): string {
  if (!rows) return notLive("Support");
  const open = rows.filter((r) => r.lane !== "done");
  const waitingOnUs = open.filter((r) => r.lane !== "waiting_on_member");
  const late = open.filter((r) => r.breached).length;
  return sentences([
    `${countWord(waitingOnUs.length, "ticket")} waiting on the team, ${late} past ${late === 1 ? "its" : "their"} promised time`,
    `${open.filter((r) => r.lane === "new").length} new, ${open.filter((r) => r.lane === "escalated").length} escalated and ${open.filter((r) => r.lane === "waiting_on_member").length} waiting on the member`,
    waitingOnUs.length > 0 ? `The oldest open ticket was filed ${oldestAge(waitingOnUs.map((r) => r.createdAt), nowMs)} ago` : null,
  ]);
}
