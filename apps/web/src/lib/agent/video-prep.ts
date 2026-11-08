/**
 * A LISTING VIDEO, MADE READY IN THE BROWSER BEFORE IT IS UPLOADED.
 *
 * Three jobs, each best effort and each said in words when it cannot be done:
 *
 *   1. HOW LONG IT IS (`videoDuration`), so a clip over the owner's minute is
 *      refused before anybody's data is spent on it.
 *   2. A STILL (`posterFrame`): a frame from about a second in, drawn on a
 *      canvas and saved as a JPEG. A canvas carries no metadata, so the still
 *      has no location in it, and it lets the listing page show the video
 *      without fetching any of it until play is pressed.
 *   3. THE LOCATION TAKEN OUT (`scrubVideoLocation`). A phone writes where a
 *      clip was filmed into the file: QuickTime's `©xyz` box and Apple's
 *      `com.apple.quicktime.location.ISO6709` value, both inside `moov`. Only
 *      the `moov` box is read (a few hundred kilobytes, not the picture), every
 *      `©xyz` box is renamed to `free` with its contents zeroed, and every
 *      ISO 6709 coordinate string has its digits set to nought. Sizes are
 *      unchanged, so the file still plays. WebM rarely carries a location and
 *      is passed through untouched; so is any file whose boxes cannot be read.
 */

const LOCATION_BOX = [0xa9, 0x78, 0x79, 0x7a]; // "©xyz"
const FREE = [0x66, 0x72, 0x65, 0x65]; // "free"
/* An ISO 6709 point: +06.4474+003.4700+012.000/ , optionally with a CRS. */
const ISO6709 = /[+-]\d{1,3}(?:\.\d+)?[+-]\d{1,3}(?:\.\d+)?(?:[+-]\d+(?:\.\d+)?)?(?:CRS[A-Za-z0-9:_]*)?\//g;

/**
 * Scrub location from the bytes of a `moov` box, in place. Returns how many
 * places were changed. Pure, so it is tested without a browser.
 */
export function scrubMoovLocation(bytes: Uint8Array): number {
  let changed = 0;
  for (let i = 4; i + 4 <= bytes.length; i += 1) {
    if (
      bytes[i] === LOCATION_BOX[0] &&
      bytes[i + 1] === LOCATION_BOX[1] &&
      bytes[i + 2] === LOCATION_BOX[2] &&
      bytes[i + 3] === LOCATION_BOX[3]
    ) {
      const size = ((bytes[i - 4]! << 24) | (bytes[i - 3]! << 16) | (bytes[i - 2]! << 8) | bytes[i - 1]!) >>> 0;
      const start = i - 4;
      if (size >= 8 && start + size <= bytes.length) {
        bytes.set(FREE, i);
        bytes.fill(0, i + 4, start + size);
        changed += 1;
        i = start + size - 1;
      }
    }
  }
  /* The ISO 6709 strings, wherever they sit (Apple's keyed metadata). */
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]!);
  for (const match of text.matchAll(ISO6709)) {
    const at = match.index ?? 0;
    for (let k = 0; k < match[0].length; k += 1) {
      const c = match[0].charCodeAt(k);
      if (c >= 0x31 && c <= 0x39) bytes[at + k] = 0x30;
    }
    changed += 1;
  }
  return changed;
}

/** Read a big-endian box header from a slice of the file. */
async function boxAt(file: Blob, offset: number): Promise<{ size: number; type: string; header: number } | null> {
  if (offset + 8 > file.size) return null;
  const head = new Uint8Array(await file.slice(offset, offset + 16).arrayBuffer());
  const view = new DataView(head.buffer);
  let size = view.getUint32(0);
  const type = String.fromCharCode(head[4]!, head[5]!, head[6]!, head[7]!);
  let header = 8;
  if (size === 1) {
    if (head.length < 16) return null;
    size = Number(view.getBigUint64(8));
    header = 16;
  } else if (size === 0) {
    size = file.size - offset;
  }
  if (size < header || offset + size > file.size) return null;
  return { size, type, header };
}

/** The most of a `moov` box this will read into memory. */
const MOOV_CEILING = 32 * 1024 * 1024;

/**
 * The file with its filmed location taken out, or the file as it was when
 * there is nothing to take out or its boxes cannot be read.
 */
export async function scrubVideoLocation(file: File): Promise<Blob> {
  if (file.type === "video/webm" || /\.webm$/i.test(file.name)) return file;
  try {
    let offset = 0;
    for (let guard = 0; guard < 64 && offset < file.size; guard += 1) {
      const box = await boxAt(file, offset);
      if (!box) return file;
      if (box.type === "moov") {
        if (box.size > MOOV_CEILING) return file;
        const moov = new Uint8Array(await file.slice(offset, offset + box.size).arrayBuffer());
        if (scrubMoovLocation(moov) === 0) return file;
        return new Blob([file.slice(0, offset), moov, file.slice(offset + box.size)], { type: file.type });
      }
      offset += box.size;
    }
  } catch {
    /* unreadable boxes: passed through, the bucket is private */
  }
  return file;
}

/** How long the clip is, in whole seconds, or null when it cannot be read. */
export function videoDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement("video");
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    element.preload = "metadata";
    element.muted = true;
    element.onloadedmetadata = () => {
      const seconds = Math.round(element.duration);
      finish(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    };
    element.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);
    element.src = url;
  });
}

/** A WebP (or JPEG fallback) still from about a second in, at most 1280px on its long edge. */
export function posterFrame(file: Blob): Promise<{ blob: Blob; contentType: string; extension: string } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement("video");
    let settled = false;
    const finish = (value: { blob: Blob; contentType: string; extension: string } | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const useWebp = (() => {
      try { const c = document.createElement("canvas"); c.width = 1; c.height = 1; return c.toDataURL("image/webp").startsWith("data:image/webp"); } catch { return false; }
    })();
    const mime = useWebp ? "image/webp" : "image/jpeg";
    const ext = useWebp ? "webp" : "jpg";
    element.preload = "auto";
    element.muted = true;
    element.playsInline = true;
    element.onloadedmetadata = () => {
      const at = Number.isFinite(element.duration) && element.duration > 0 ? Math.min(1, element.duration / 2) : 0;
      element.currentTime = at;
    };
    element.onseeked = () => {
      try {
        const width = element.videoWidth;
        const height = element.videoHeight;
        if (!width || !height) return finish(null);
        const scale = Math.min(1, 1280 / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext("2d");
        if (!context) return finish(null);
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob ? finish({ blob, contentType: mime, extension: ext }) : finish(null), mime, 0.85);
      } catch {
        finish(null);
      }
    };
    element.onerror = () => finish(null);
    setTimeout(() => finish(null), 15000);
    element.src = url;
  });
}

/** mp4, mov or webm, from the mime type, then the name. */
export function videoExtension(file: { type: string; name: string }): "mp4" | "mov" | "webm" {
  if (file.type === "video/quicktime" || /\.mov$/i.test(file.name)) return "mov";
  if (file.type === "video/webm" || /\.webm$/i.test(file.name)) return "webm";
  return "mp4";
}

/** The mime type storage is told, from the extension when the picker gave none. */
export function videoMime(file: { type: string; name: string }): "video/mp4" | "video/quicktime" | "video/webm" {
  const ext = videoExtension(file);
  return ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4";
}

/** Whether a picked file is a video, by type or by name (Android often sends no type). */
export function looksLikeVideo(file: { type: string; name: string }): boolean {
  if (file.type.startsWith("video/")) return true;
  return file.type === "" && /\.(mp4|m4v|mov|webm)$/i.test(file.name);
}
