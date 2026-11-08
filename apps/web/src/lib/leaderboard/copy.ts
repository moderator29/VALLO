import { plural, type PluralForms } from "@vallo/i18n/core";
import { getDictionary } from "@vallo/i18n";
import type { Board, LeaderKind, Movement, Period, Scope } from "./model";

/**
 * The leaderboards' words, in one place (D76). English; plain; a count is
 * always said with its unit, and nothing here promises a prize, because the
 * boards carry none.
 *
 * SW11: static strings now live in `packages/i18n/src/locales/leaderboard.en.ts`.
 */
const _lb = getDictionary("en").leaderboard;

export const LEADERBOARD_TITLE = _lb.title;

export const GROUP_LABEL = _lb.groupLabel;

export const BOARD_LABEL: Record<Board, string> = _lb.boardLabel as Record<Board, string>;

export const BOARD_SHORT: Record<Board, string> = _lb.boardShort as Record<Board, string>;

const UNIT_FORMS: Record<Board, PluralForms> = _lb.unitForms as Record<Board, PluralForms>;

export function unitFor(board: Board, n: number): string {
  return plural(n, UNIT_FORMS[board]);
}

export const BOARD_MEASURE: Record<Board, string> = _lb.boardMeasure as Record<Board, string>;

export const KIND_LABEL: Record<LeaderKind, string> = _lb.kindLabel as Record<LeaderKind, string>;

export const SCOPE_LABEL: Record<Scope, string> = _lb.scopeLabel as Record<Scope, string>;

export const PERIOD_LABEL: Record<Period, string> = _lb.periodLabel as Record<Period, string>;

/** The month subtitle: "October 2026". */
export function periodSubtitle(period: Period, now: Date = new Date()): string {
  if (period === "all") return "All time";
  return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(now);
}

/** Movement said in words, for the screen reader and the tooltip. */
export function movementWords(m: Movement, period: Period): string {
  const since = period === "month" ? "since last month" : "since the start of this month";
  switch (m.direction) {
    case "up":
      return `Up ${m.by} ${since}`;
    case "down":
      return `Down ${m.by} ${since}`;
    case "same":
      return `No change ${since}`;
    case "new":
      return "New on the board";
  }
}

export function placeWord(scope: Scope, placeName: string | null): string {
  return scope === "global" ? "Nigeria" : (placeName ?? "your city");
}

export function emptyTitle(scope: Scope, placeName: string | null): string {
  return scope === "global" ? "Be the first on Vallo" : `Be the first in ${placeName ?? "your city"}`;
}

export const EMPTY_BODY: Record<Board, string> = _lb.emptyBody as Record<Board, string>;

export const CLIMB_ACTION: Record<Board, { label: string; href: string }> = _lb.climbAction as Record<Board, { label: string; href: string }>;

export const NOT_LIVE_TITLE = _lb.notLiveTitle;
export const NOT_LIVE_BODY = _lb.notLiveBody;

export const ERROR_TITLE = _lb.errorTitle;
export const ERROR_BODY = _lb.errorBody;

export const CLIMB_STEPS: Record<Board, { title: string; body: string }[]> = _lb.climbSteps as Record<Board, { title: string; body: string }[]>;

export const EXPLAINER_TITLE = _lb.explainerTitle;
export const EXPLAINER_DONE = _lb.explainerDone;

export const PRIVACY_LINE = _lb.privacyLine;
export const OPT_OUT_LABEL = _lb.optOutLabel;
export const OPT_OUT_BODY = _lb.optOutBody;

export const SHARE_TITLE = _lb.shareTitle;
export const SHARE_ACTION = _lb.shareAction;
export const SHARE_COPY = _lb.shareCopy;
export const SHARE_COPIED = _lb.shareCopied;

export function shareText(rank: number, board: Board, place: string, period: Period): string {
  const when = period === "month" ? "this month" : "of all time";
  return `I'm #${rank} on Vallo's ${BOARD_LABEL[board]} board in ${place}, ${when}.`;
}

export function youPill(rank: number | null): string {
  return rank === null ? "You" : `You, #${rank}`;
}

export const NOT_ON_BOARD = _lb.notOnBoard;

/** The earned moment's title, by place: first is said as first. */
const EARNED_TITLE: Partial<Record<number, (place: string) => string>> = {
  1: (place) => `Number one in ${place}.`,
};

export function earnedTitle(rank: number, place: string): string {
  return (EARNED_TITLE[rank] ?? ((p: string) => `Top three in ${p}.`))(place);
}

export function earnedBody(rank: number, board: Board): string {
  return `You are #${rank} on the ${BOARD_LABEL[board]} board. Every count behind it is real activity on Vallo.`;
}
