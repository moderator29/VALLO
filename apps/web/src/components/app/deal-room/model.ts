import { eventWord, STAGE_LABEL, turnSentence, holderLine } from "@/lib/offers/words";
import { deadlineLine, formatWhen } from "@/lib/offers/format";
import { DEAL_STAGES } from "@/lib/offers/types";
import type { DealRoom, DealStage, OfferVersion } from "@/lib/offers/types";

/** Pure helpers for the Deal Room screens. No React, so they are unit-testable. */

export function latestVersion(room: DealRoom): OfferVersion | null {
  return room.versions.length ? room.versions[room.versions.length - 1]! : null;
}

/** "Seller reviewing" until anything is countered; then "Negotiation". */
export function stageLabelFor(stage: DealStage, versionCount: number): string {
  if (stage === "negotiating" && versionCount <= 1) return "Seller reviewing";
  return STAGE_LABEL[stage];
}

export type TrackModel = { key: string; label: string; state: "done" | "current" | "upcoming" | "failed"; note?: string; when?: string };

/** The tracker from recorded state only: never from elapsed time. */
export function trackFor(room: DealRoom): TrackModel[] {
  const { offer } = room;
  const at = DEAL_STAGES.indexOf(offer.stage);
  const ended = offer.state === "declined" || offer.state === "withdrawn" || offer.state === "expired" || offer.state === "cancelled";
  const endWord = ended ? { declined: "Declined", withdrawn: "Withdrawn", expired: "Expired", cancelled: "Cancelled" }[offer.state as "declined"] : "";
  return DEAL_STAGES.map((stage, index) => {
    const base = { key: stage, label: stageLabelFor(stage, room.versions.length) };
    if (ended) {
      if (index < at) return { ...base, state: "done" as const };
      if (index === at) return { ...base, state: "failed" as const, note: endWord };
      return { ...base, state: "upcoming" as const };
    }
    /* Agreed means the "agreed" stage is reached; the stage field says where it is now. */
    if (index < at) return { ...base, state: "done" as const, ...(index === 0 ? { when: formatWhen(offer.submittedAt) } : {}) };
    if (index === at) return { ...base, state: offer.stage === "completed" ? ("done" as const) : ("current" as const) };
    return { ...base, state: "upcoming" as const };
  });
}

export type FourAnswers = { happened: string; waiting: string; turn: string; deadline: string };

/** The four questions every screen must answer without asking anyone. */
export function fourAnswers(room: DealRoom, nowMs: number): FourAnswers {
  const last = room.events.length ? room.events[room.events.length - 1]! : null;
  const who = last ? (last.actor === room.viewerSide ? "you" : last.actorName ? last.actorName : last.actor === "vallo" ? "Vallo staff" : "the other side") : "";
  const happened = last ? `${eventWord(last.action)} by ${who}, ${formatWhen(last.at)}.` : "The offer was sent.";
  const waiting = room.next ? room.next.detail : turnSentence(room.offer);
  const turn = room.offer.state === "open" ? `${turnSentence(room.offer)} Holding it: ${holderLine(room.offer)}.` : turnSentence(room.offer);
  return { happened, waiting, turn, deadline: deadlineLine(room.offer.expiresAt, nowMs) };
}

/** The recorded stage that follows this one after agreement, or null at the end. */
export function nextRecordableStage(stage: DealStage): "due_diligence" | "documentation" | "closing" | "completed" | null {
  switch (stage) {
    case "agreed":
      return "due_diligence";
    case "due_diligence":
      return "documentation";
    case "documentation":
      return "closing";
    case "closing":
      return "completed";
    default:
      return null;
  }
}

export const RECORD_STAGE_BUTTON: Record<"due_diligence" | "documentation" | "closing" | "completed", string> = {
  due_diligence: "Start inspection and due diligence",
  documentation: "Move on to documentation",
  closing: "Move on to closing",
  completed: "Record completion",
};

/** Tabs of the room. */
export const ROOM_TABS = ["overview", "negotiation", "messages", "inspection", "documents", "activity"] as const;
export type RoomTab = (typeof ROOM_TABS)[number];
export const ROOM_TAB_LABEL: Record<RoomTab, string> = {
  overview: "Overview",
  negotiation: "Negotiation",
  messages: "Messages",
  inspection: "Inspection",
  documents: "Documents",
  activity: "Activity",
};

export function parseTab(value: string | string[] | undefined): RoomTab {
  const v = Array.isArray(value) ? value[0] : value;
  return (ROOM_TABS as readonly string[]).includes(v ?? "") ? (v as RoomTab) : "overview";
}

/** Whether the viewer can answer an outstanding question from the other side. */
export function hasOpenQuestion(room: DealRoom): boolean {
  const last = room.events.length ? room.events[room.events.length - 1]! : null;
  return room.offer.state === "open" && last?.action === "info_requested" && last.actor !== room.viewerSide;
}
