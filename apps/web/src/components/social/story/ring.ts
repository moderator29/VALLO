/**
 * THE STORY RING, AS TWO TRUE FACTS (reference 7128, status rings).
 *
 * A ring draws one segment per live story the person has, up to six, and each
 * segment is lit until this reader has opened that story. Pure and tokens-only
 * so it can be tested without a browser and so no raw colour ever reaches a
 * stylesheet: the colours are `--nf-ring-lit`, `--nf-ring-lit-mid`,
 * `--nf-ring-lit-end` and `--nf-ring-seen`, declared on `.nf-story-ring` in `feed-m.css`.
 *
 * ONE STORY IS A FULL CIRCLE, with no gap, because a single segment with a
 * notch cut out of it would look broken rather than counted.
 */

export const RING_MAX_SEGMENTS = 6;
/** Degrees of empty ring between two segments. */
export const RING_GAP_DEG = 12;

/** How many segments a ring draws for `total` stories. */
export function ringSegments(total: number): number {
  return Math.max(1, Math.min(RING_MAX_SEGMENTS, Math.floor(total)));
}

/**
 * The stories a ring draws: the NEWEST six. `seen` is oldest first, so the
 * newest are the tail; taking the head drew the oldest six, which on a person
 * with eight stories left the two latest out of the ring that exists to say
 * "there is something new" (auditor A2).
 */
export function ringWindow<T>(items: readonly T[]): T[] {
  return items.slice(-RING_MAX_SEGMENTS);
}

/** Whether every story in the ring has been opened. Nothing to open counts as seen. */
export function allSeen(seen: readonly boolean[]): boolean {
  return seen.length > 0 && seen.every(Boolean);
}

/**
 * The conic gradient for a ring. `seen` is oldest first so the ring reads
 * clockwise in the order the stories were told; segment i is quiet when
 * `seen[i]` is true.
 *
 * BLUE LED, ONE SPARK (light mode pass, 7 November 2026). The ring used to mix
 * the info blue into the orange spark across every segment, and a mix of blue
 * and orange is a grey brown in any straight colour space: on paper the ring
 * read brown. Now the lit segments sweep between two blues (`--nf-ring-lit`
 * into `--nf-ring-lit-mid`) and only the NEWEST segment carries the spark
 * (`--nf-ring-lit-end`), so the orange marks the latest story and never has
 * to pass through a muddy middle. One story is the same sweep as a circle:
 * blue most of the way round, the spark at the tip, a short way back.
 */
export function ringGradient(seen: readonly boolean[]): string {
  const windowed = ringWindow(seen);
  const n = ringSegments(windowed.length || 1);
  const flags = Array.from({ length: n }, (_, i) => Boolean(windowed[i]));
  const lit = (i: number) => {
    if (i === n - 1) return "var(--nf-ring-lit-end)";
    const p = n <= 2 ? 0 : Math.round((i / (n - 2)) * 100);
    return p === 0
      ? "var(--nf-ring-lit)"
      : `color-mix(in oklab, var(--nf-ring-lit) ${100 - p}%, var(--nf-ring-lit-mid))`;
  };

  if (n === 1) {
    return flags[0]
      ? "conic-gradient(var(--nf-ring-seen) 0deg 360deg)"
      : "conic-gradient(var(--nf-ring-lit) 0deg, var(--nf-ring-lit-mid) 220deg, var(--nf-ring-lit-end) 316deg, var(--nf-ring-lit-end) 342deg, var(--nf-ring-lit) 360deg)";
  }

  const arc = 360 / n;
  const half = RING_GAP_DEG / 2;
  const stops: string[] = [];
  flags.forEach((isSeen, i) => {
    const start = i * arc + half;
    const end = (i + 1) * arc - half;
    const colour = isSeen ? "var(--nf-ring-seen)" : lit(i);
    stops.push(`transparent ${(i * arc).toFixed(2)}deg ${start.toFixed(2)}deg`);
    stops.push(`${colour} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`);
    stops.push(`transparent ${end.toFixed(2)}deg ${((i + 1) * arc).toFixed(2)}deg`);
  });
  return `conic-gradient(${stops.join(", ")})`;
}
