/**
 * RUNS OF BUBBLES (Platform Grade 1, P1.3 polish).
 *
 * Consecutive messages from one side, a few minutes apart, read as one turn:
 * they sit tight together, the corners where they meet tuck in, and the time
 * and ticks are drawn once, under the last of them. A run breaks on a change
 * of side, a gap of more than `RUN_GAP_MS`, a new day, or a bubble with a
 * state of its own ("Sending", "Not sent"), which needs its own line under it.
 *
 * Pure, so it is tested rather than trusted.
 */

export const RUN_GAP_MS = 3 * 60 * 1000;

export type RunInput = {
  mine: boolean;
  timeLabel: string;
  createdAt?: string;
  state?: string;
  /** A call row or a shared card stands on its own and is never part of a run. */
  call?: unknown;
  card?: unknown;
};

/** True when `next` continues the run that `prev` is in. */
export function sameRun(prev: RunInput | null, next: RunInput | null): boolean {
  if (!prev || !next) return false;
  if (prev.mine !== next.mine) return false;
  if (prev.state || next.state) return false;
  if (prev.call || next.call || prev.card || next.card) return false;
  const a = prev.createdAt ? Date.parse(prev.createdAt) : NaN;
  const b = next.createdAt ? Date.parse(next.createdAt) : NaN;
  if (Number.isFinite(a) && Number.isFinite(b)) return b - a >= 0 && b - a <= RUN_GAP_MS;
  return prev.timeLabel === next.timeLabel;
}

export type RunPlace = "single" | "first" | "middle" | "last";

/** Where a bubble sits in its run, from whether it continues the one before and is continued by the one after. */
export function runPlace(continues: boolean, continued: boolean): RunPlace {
  if (continues && continued) return "middle";
  if (continues) return "last";
  if (continued) return "first";
  return "single";
}
