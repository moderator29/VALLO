import "server-only";

/**
 * A LISTING VIDEO, CHECKED ON THE SERVER BEFORE A ROW POINTS AT IT.
 *
 * The wizard checks a walkthrough in the browser (`video-prep.ts`): its length,
 * and its filmed location taken out. Anything checked only in the browser is a
 * courtesy, so `addVideo` reads the stored object back here, a few small byte
 * ranges at a time (never the whole picture), and answers four questions from
 * the BYTES rather than from what the uploader declared:
 *
 *   1. IS IT A VIDEO. An MP4 or QuickTime file is a run of boxes that covers
 *      the file exactly and holds a `moov`; a WebM file opens with the EBML
 *      magic. Anything else (a page, a script, a picture renamed .mp4) is
 *      refused, whatever content type it was uploaded with.
 *   2. DOES IT STILL SAY WHERE IT WAS FILMED. QuickTime's `©xyz` box, or an
 *      ISO 6709 coordinate with a digit that is not nought, inside a `udta` or
 *      `meta` box of the `moov`. The wizard renames the first to `free` and
 *      noughts the second, so an honest upload never meets this refusal; a
 *      file posted around the wizard does.
 *   3. HOW LONG IT IS, from the movie header (`mvhd`): the timescale and the
 *      duration. This is the measured length that is stored, not the one the
 *      browser reported. WebM is not measured here (its length sits in an
 *      EBML tree, and the browser's figure stands, bounded by the table's own
 *      check).
 *   4. NOTHING IS GUESSED. A file whose boxes cannot be read is refused.
 */

/** Reads bytes `start` to `end` inclusive, or null when they cannot be read. */
export type RangeReader = (start: number, end: number) => Promise<Uint8Array | null>;

export type VideoVerdict =
  | { ok: true; container: "mp4" | "webm"; durationSeconds: number | null }
  | { ok: false; reason: "not-a-video" | "location" | "unreadable" };

const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

/** The most of a `moov` box read into memory, the wizard's own ceiling. */
export const MOOV_CEILING = 32 * 1024 * 1024;

/** Top-level boxes walked before giving up. A real file has a handful. */
const MAX_TOP_BOXES = 64;

/** Boxes whose children are boxes, on the way down to `udta` and `meta`. */
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "edts", "udta"]);

/** Regions scanned for a location: the user data and metadata boxes. */
const LOCATION_HOLDERS = new Set(["udta", "meta"]);

const LOCATION_BOX = [0xa9, 0x78, 0x79, 0x7a]; // "©xyz"
const ISO6709 = /[+-]\d{1,3}(?:\.\d+)?[+-]\d{1,3}(?:\.\d+)?(?:[+-]\d+(?:\.\d+)?)?(?:CRS[A-Za-z0-9:_]*)?\//g;

type Box = { type: string; start: number; size: number; header: number };

function typeOf(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
}

/** A box type is four bytes of printable ASCII, or QuickTime's © prefix. */
function plausibleType(bytes: Uint8Array, at: number): boolean {
  for (let k = 0; k < 4; k += 1) {
    const c = bytes[at + k]!;
    const printable = c >= 0x20 && c <= 0x7e;
    if (!printable && !(k === 0 && c === 0xa9)) return false;
  }
  return true;
}

/** Read one box header from a 16 byte window. */
function headerOf(head: Uint8Array, start: number, limit: number): Box | null {
  if (head.length < 8 || !plausibleType(head, 4)) return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  let size = view.getUint32(0);
  let header = 8;
  if (size === 1) {
    if (head.length < 16) return null;
    size = Number(view.getBigUint64(8));
    header = 16;
  } else if (size === 0) {
    size = limit - start;
  }
  if (size < header || start + size > limit) return null;
  return { type: typeOf(head, 4), start, size, header };
}

/** The children of a box held in memory, from `from` to `to`. */
function childrenOf(bytes: Uint8Array, from: number, to: number): Box[] | null {
  const out: Box[] = [];
  let at = from;
  while (at + 8 <= to) {
    const box = headerOf(bytes.subarray(at, Math.min(at + 16, to)), at, to);
    if (!box) return null;
    out.push(box);
    at += box.size;
  }
  if (at === to) return out;
  /* QuickTime may close a list with up to four zero bytes; anything else
     left over is a box list that does not add up. */
  if (to - at < 8 && bytes.subarray(at, to).every((byte) => byte === 0)) return out;
  return null;
}

/** Seconds from an `mvhd` payload (version and flags first), or null. */
export function mvhdSeconds(payload: Uint8Array): number | null {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const version = payload[0];
  let timescale: number;
  let duration: number;
  if (version === 1) {
    if (payload.length < 32) return null;
    timescale = view.getUint32(20);
    duration = Number(view.getBigUint64(24));
  } else {
    if (payload.length < 20) return null;
    timescale = view.getUint32(12);
    duration = view.getUint32(16);
  }
  if (timescale === 0) return null;
  const seconds = duration / timescale;
  return Number.isFinite(seconds) ? seconds : null;
}

/** True when a region still names the place the clip was filmed. */
export function regionHasLocation(bytes: Uint8Array): boolean {
  for (let i = 4; i + 4 <= bytes.length; i += 1) {
    if (
      bytes[i] === LOCATION_BOX[0] &&
      bytes[i + 1] === LOCATION_BOX[1] &&
      bytes[i + 2] === LOCATION_BOX[2] &&
      bytes[i + 3] === LOCATION_BOX[3]
    ) {
      return true;
    }
  }
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]!);
  for (const match of text.matchAll(ISO6709)) {
    /* The wizard noughts every digit; a coordinate that is all noughts is one
       it already took out. */
    if (/[1-9]/.test(match[0])) return true;
  }
  return false;
}

/**
 * Walk a `moov` box held in memory: the movie length, and whether any user
 * data or metadata box in it still carries a location.
 */
export function readMoov(moov: Uint8Array): { seconds: number | null; location: boolean } | null {
  const top = headerOf(moov.subarray(0, 16), 0, moov.length);
  if (!top || top.type !== "moov") return null;
  let seconds: number | null = null;
  let location = false;
  const walk = (from: number, to: number, depth: number): boolean => {
    if (depth > 8) return true;
    const kids = childrenOf(moov, from, to);
    if (!kids) return false;
    for (const kid of kids) {
      const bodyStart = kid.start + kid.header;
      const bodyEnd = kid.start + kid.size;
      if (kid.type === "mvhd" && depth === 0) seconds = mvhdSeconds(moov.subarray(bodyStart, bodyEnd));
      if (LOCATION_HOLDERS.has(kid.type) && regionHasLocation(moov.subarray(bodyStart, bodyEnd))) location = true;
      /* `udta` may hold free-form children a walk cannot parse; its bytes were
         scanned whole above, so a failed walk inside it is not a failure. */
      if (CONTAINERS.has(kid.type) && kid.type !== "udta" && !walk(bodyStart, bodyEnd, depth + 1)) return false;
    }
    return true;
  };
  if (!walk(top.header, top.size, 0)) return null;
  return { seconds, location };
}

/** Inspect a stored video through ranged reads. `size` is the object's size. */
export async function inspectVideo(read: RangeReader, size: number): Promise<VideoVerdict> {
  if (!Number.isFinite(size) || size < 16) return { ok: false, reason: "not-a-video" };
  const first = await read(0, 15);
  if (!first || first.length < 16) return { ok: false, reason: "unreadable" };

  if (EBML_MAGIC.every((byte, k) => first[k] === byte)) {
    return { ok: true, container: "webm", durationSeconds: null };
  }

  let offset = 0;
  let moovBox: Box | null = null;
  for (let guard = 0; offset < size; guard += 1) {
    if (guard >= MAX_TOP_BOXES) return { ok: false, reason: "not-a-video" };
    const head = offset === 0 ? first : await read(offset, Math.min(offset + 15, size - 1));
    if (!head) return { ok: false, reason: "unreadable" };
    const box = headerOf(head, offset, size);
    if (!box) return { ok: false, reason: "not-a-video" };
    if (box.type === "moov") moovBox = box;
    offset += box.size;
  }
  if (offset !== size || !moovBox) return { ok: false, reason: "not-a-video" };
  if (moovBox.size > MOOV_CEILING) return { ok: false, reason: "unreadable" };

  const moov = await read(moovBox.start, moovBox.start + moovBox.size - 1);
  if (!moov || moov.length !== moovBox.size) return { ok: false, reason: "unreadable" };
  const facts = readMoov(moov);
  if (!facts) return { ok: false, reason: "not-a-video" };
  if (facts.location) return { ok: false, reason: "location" };
  return { ok: true, container: "mp4", durationSeconds: facts.seconds };
}

/**
 * Inspect an object in a private bucket through a one-minute signed URL made
 * with the service role (the check must not depend on what the uploader's own
 * policies allow). Any failure to reach storage is "unreadable", never a pass.
 */
export async function inspectStoredVideo(bucketName: string, path: string, size: number, maxBytes: number): Promise<VideoVerdict> {
  try {
    const { createAdminClient } = await import("../supabase/admin");
    const { data, error } = await createAdminClient().storage.from(bucketName).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return { ok: false, reason: "unreadable" };
    return await inspectVideo(rangeReaderForUrl(data.signedUrl, maxBytes), size);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

/**
 * A range reader over a URL (a short-lived signed URL to the private bucket).
 * A server that ignores `Range` and answers the whole object is read once,
 * up to the size limit, and every later range is served from that copy.
 */
export function rangeReaderForUrl(url: string, maxBytes: number): RangeReader {
  let whole: Uint8Array | null = null;
  return async (start, end) => {
    if (whole) return whole.subarray(start, end + 1);
    try {
      const response = await fetch(url, { headers: { range: `bytes=${start}-${end}` }, cache: "no-store" });
      if (response.status === 206) return new Uint8Array(await response.arrayBuffer());
      if (response.status !== 200) return null;
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > maxBytes) return null;
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.length > maxBytes) return null;
      whole = body;
      return whole.subarray(start, end + 1);
    } catch {
      return null;
    }
  };
}
