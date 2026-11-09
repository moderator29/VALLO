/**
 * Photo bundles: consecutive photo-only messages from one sender, sent in the
 * same minute, drawn as one bubble with a three-up strip and a +n plate; and
 * the words that follow them in that same minute ride the bubble as its
 * caption, which is how 9E06F51C draws "here are more photos" under the strip.
 *
 * WHY THIS IS DERIVED AT RENDER TIME. A photo lands as its own message row
 * (see `attachImage`), so somebody sending six pictures of a flat sends six
 * messages, and six full-width bubbles in a row is the thing the render
 * (9E06F51C) does not draw. Nothing about the rows changes; the thread just
 * reads a run of them as one act, which is what the sender meant.
 *
 * Pure, so it is tested rather than trusted.
 */

export type BundleInput = {
  id: string;
  mine: boolean;
  body: string;
  timeLabel: string;
  imageUrl: string | null;
  state?: "sending" | "failed" | "waiting";
};

export type Bundle<T extends BundleInput> = {
  /** The first message, which carries the id the row is keyed on. */
  lead: T;
  /** Every message in the run, the lead included. */
  items: T[];
};

/** The body a photo-only message carries, as `attachImage` writes it. */
const PHOTO_BODY = "\u{1F4F7} Photo";

export function isPhotoOnly(m: BundleInput): boolean {
  return m.imageUrl !== null && (m.body.trim().length === 0 || m.body === PHOTO_BODY);
}

/** A text-only message: words, no picture. */
export function isCaption(m: BundleInput): boolean {
  return m.imageUrl === null && m.body.trim().length > 0;
}

/** The same sender, the same minute, nothing still in flight. */
function sameAct(prev: BundleInput, next: BundleInput): boolean {
  return (
    prev.mine === next.mine &&
    prev.timeLabel === next.timeLabel &&
    prev.state === undefined &&
    next.state === undefined
  );
}

/**
 * True when `next` continues the run: another photo after photos, or the
 * first words after photos (the caption). A run holds at most one caption
 * and a photo after the caption starts a new run, so the strip is always
 * drawn above its words.
 */
function joins(run: BundleInput[], next: BundleInput): boolean {
  const prev = run[run.length - 1]!;
  if (!sameAct(prev, next)) return false;
  /* VC1: a call marker is its own row, never a photo's caption. Nor is a
     voice note or a file (Grade 1): each is its own bubble with its player. */
  if ((next as { call?: unknown }).call) return false;
  if ((next as { audio?: unknown }).audio || (next as { file?: unknown }).file) return false;
  if (!isPhotoOnly(prev)) return false;
  return isPhotoOnly(next) || isCaption(next);
}

export function bundlePhotos<T extends BundleInput>(messages: T[]): Bundle<T>[] {
  const out: Bundle<T>[] = [];
  for (const message of messages) {
    const last = out[out.length - 1];
    if (last && joins(last.items, message)) {
      last.items.push(message);
    } else {
      out.push({ lead: message, items: [message] });
    }
  }
  return out;
}
