import { finding, type Finding } from "./signals";

/**
 * WHAT AN UPLOADED IMAGE FILE SAYS ABOUT HOW IT WAS MADE (15 November 2026).
 *
 * Read from the first bytes of the file (the desk passes the first 256 KB),
 * with a small parser written here and no library:
 *
 *   the file type        by its opening bytes, not by its name
 *   camera details       whether the file carries a camera's make, model or
 *                        capture time (EXIF)
 *   an editing mark      the EXIF Software tag or the XMP CreatorTool naming
 *                        an editing program (Photoshop, Lightroom, GIMP,
 *                        Canva, PicsArt, Snapseed, Pixelmator, Affinity and a
 *                        few more), or any program at all in CreatorTool
 *   a screenshot         a PNG with no camera details, or a picture whose
 *                        size is exactly a common phone screen
 *
 * EVERY ONE OF THESE IS A HINT FOR A PERSON, NEVER A VERDICT. An editing mark
 * means "look closer": people crop and rotate honest photos in the same apps
 * forgers use. No mark means nothing at all: marks are removed by a message
 * app, by a screenshot, or on purpose. A photo taken inside the Vallo app has
 * no camera details either, so their absence on a JPEG is not reported.
 *
 * PURE: bytes in, facts out. No I/O, no logging, and nothing read from the
 * picture itself (no face, no text, no number).
 */

export const IMAGE_SIGNAL_BYTES = 256 * 1024;

export type ImageType = "jpeg" | "png" | "webp" | "heic" | "gif" | "pdf" | "unknown";

export type ImageSignals = {
  type: ImageType;
  width: number | null;
  height: number | null;
  /**
   * `camera`: a camera's make, model or capture time is in the file.
   * `none`: the part of the file that would carry it was read, and it has none.
   * `unknown`: the bytes read do not settle it either way.
   */
  metadata: "camera" | "none" | "unknown";
  /** The program the file names as having saved it, tidied, when it names one. */
  software: string | null;
  /** The editing program recognised in that name, in its common spelling. */
  editor: string | null;
  screenshot: boolean;
  screenshotReason: "png" | "screen_size" | null;
};

/** Editing programs, most specific first: the first pattern that matches names it. */
const EDITORS: readonly [pattern: RegExp, name: string][] = [
  [/lightroom/i, "Lightroom"],
  [/photoshop/i, "Photoshop"],
  [/illustrator/i, "Illustrator"],
  [/\bgimp\b/i, "GIMP"],
  [/canva/i, "Canva"],
  [/picsart/i, "PicsArt"],
  [/snapseed/i, "Snapseed"],
  [/pixelmator/i, "Pixelmator"],
  [/affinity/i, "Affinity"],
  [/photopea/i, "Photopea"],
  [/pixlr/i, "Pixlr"],
  [/paint\.net/i, "Paint.NET"],
  [/corel|paintshop/i, "Corel"],
  [/inkscape/i, "Inkscape"],
];

/** The editing program a Software or CreatorTool value names, or null. */
export function editorIn(value: string | null | undefined): string | null {
  if (!value) return null;
  for (const [pattern, name] of EDITORS) if (pattern.test(value)) return name;
  return null;
}

/**
 * Phone screens, in pixels, narrow side first. A picture exactly this size
 * with no camera details is very likely a screenshot. The 16 by 9 sizes
 * (720 by 1280, 1080 by 1920) are left out on purpose: they are also what a
 * camera, and Vallo's own in-app capture, produce.
 */
export const PHONE_SCREENS: readonly (readonly [number, number])[] = [
  [640, 1136], [720, 1440], [720, 1520], [720, 1560], [720, 1600], [720, 1612], [720, 1640], [720, 1650],
  [750, 1334], [750, 1624], [828, 1792],
  [1080, 2160], [1080, 2220], [1080, 2246], [1080, 2280], [1080, 2310], [1080, 2340], [1080, 2376],
  [1080, 2388], [1080, 2400], [1080, 2408], [1080, 2412], [1080, 2460],
  [1125, 2436], [1170, 2532], [1179, 2556], [1206, 2622], [1242, 2688], [1284, 2778], [1290, 2796], [1320, 2868],
  [1440, 2880], [1440, 2960], [1440, 3040], [1440, 3088], [1440, 3120], [1440, 3200],
];

export function isPhoneScreenSize(width: number | null, height: number | null): boolean {
  if (!width || !height) return false;
  const [narrow, long] = width <= height ? [width, height] : [height, width];
  return PHONE_SCREENS.some(([w, h]) => w === narrow && h === long);
}

/* ------------------------------------------------------------ byte helpers */

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i += 1) out += String.fromCharCode(bytes[i]!);
  return out;
}

function startsWith(bytes: Uint8Array, at: number, text: string): boolean {
  if (at < 0 || at + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i += 1) if (bytes[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

function indexOf(bytes: Uint8Array, text: string, from = 0): number {
  const first = text.charCodeAt(0);
  for (let i = from; i + text.length <= bytes.length; i += 1) {
    if (bytes[i] === first && startsWith(bytes, i, text)) return i;
  }
  return -1;
}

const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u32be = (b: Uint8Array, at: number) => (((b[at] ?? 0) << 24) | ((b[at + 1] ?? 0) << 16) | ((b[at + 2] ?? 0) << 8) | (b[at + 3] ?? 0)) >>> 0;
const u16le = (b: Uint8Array, at: number) => ((b[at + 1] ?? 0) << 8) | (b[at] ?? 0);
const u24le = (b: Uint8Array, at: number) => ((b[at + 2] ?? 0) << 16) | ((b[at + 1] ?? 0) << 8) | (b[at] ?? 0);
const u32le = (b: Uint8Array, at: number) => (((b[at + 3] ?? 0) << 24) | ((b[at + 2] ?? 0) << 16) | ((b[at + 1] ?? 0) << 8) | (b[at] ?? 0)) >>> 0;

/** A value out of a file, made fit to show: printable characters only, one line, short. */
function tidy(value: string): string | null {
  const text = value.replace(/[^\x20-\x7E]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return text === "" ? null : text;
}

/* ------------------------------------------------------------------- EXIF */

type Tiff = { make: string | null; model: string | null; software: string | null; captured: boolean };

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_SOFTWARE = 0x0131;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_ORIGINAL = 0x9003;

/** The few EXIF tags that matter, read from a TIFF header at `start`. Null when it is not one. */
export function readTiff(bytes: Uint8Array, start: number): Tiff | null {
  if (start < 0 || start + 8 > bytes.length) return null;
  const little = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
  const big = bytes[start] === 0x4d && bytes[start + 1] === 0x4d;
  if (!little && !big) return null;
  const u16 = (at: number) => (little ? u16le(bytes, at) : u16be(bytes, at));
  const u32 = (at: number) => (little ? u32le(bytes, at) : u32be(bytes, at));
  if (u16(start + 2) !== 42) return null;

  const out: Tiff = { make: null, model: null, software: null, captured: false };
  const text = (entry: number, count: number): string | null => {
    const at = count <= 4 ? entry + 8 : start + u32(entry + 8);
    if (at < 0 || at >= bytes.length) return null;
    const raw = ascii(bytes, at, Math.min(count, 200));
    const nul = raw.indexOf("\0");
    return tidy(nul >= 0 ? raw.slice(0, nul) : raw);
  };
  const directory = (offset: number, depth: number): void => {
    const at = start + offset;
    if (offset < 8 || at + 2 > bytes.length) return;
    const count = u16(at);
    if (count > 512) return;
    for (let i = 0; i < count; i += 1) {
      const entry = at + 2 + i * 12;
      if (entry + 12 > bytes.length) return;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const n = u32(entry + 4);
      if (type === 2 && tag === TAG_MAKE) out.make = text(entry, n);
      else if (type === 2 && tag === TAG_MODEL) out.model = text(entry, n);
      else if (type === 2 && tag === TAG_SOFTWARE) out.software = text(entry, n);
      else if (type === 2 && tag === TAG_DATE_ORIGINAL) out.captured = text(entry, n) !== null;
      else if (tag === TAG_EXIF_IFD && depth === 0) directory(u32(entry + 8), 1);
    }
  };
  directory(u32(start + 4), 0);
  return out;
}

function tiffAfterExifHeader(bytes: Uint8Array): Tiff | null {
  let from = 0;
  for (let tries = 0; tries < 4; tries += 1) {
    const at = indexOf(bytes, "Exif\0\0", from);
    if (at < 0) return null;
    const tiff = readTiff(bytes, at + 6);
    if (tiff) return tiff;
    from = at + 6;
  }
  return null;
}

/* -------------------------------------------------------------------- XMP */

/** The XMP CreatorTool value, wherever in the bytes the packet sits. */
export function xmpCreatorTool(bytes: Uint8Array): string | null {
  const at = indexOf(bytes, "CreatorTool");
  if (at < 0) return null;
  const window = ascii(bytes, Math.max(0, at - 8), 220);
  const attribute = /(?:xmp|xap):CreatorTool\s*=\s*["']([^"']{1,120})["']/.exec(window);
  if (attribute) return tidy(attribute[1]!);
  const element = /<(?:xmp|xap):CreatorTool>\s*([^<]{1,120})</.exec(window);
  return element ? tidy(element[1]!) : null;
}

/** A CreatorTool that names a program, not just a version number such as a phone writes. */
function namesAProgram(value: string): boolean {
  return /[A-Za-z]{3,}/.test(value);
}

/* ----------------------------------------------------------- the formats */

export function imageTypeOf(bytes: Uint8Array): ImageType {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (startsWith(bytes, 0, "\x89PNG\r\n\x1a\n")) return "png";
  if (startsWith(bytes, 0, "RIFF") && startsWith(bytes, 8, "WEBP")) return "webp";
  if (startsWith(bytes, 4, "ftyp")) {
    const brand = ascii(bytes, 8, 4);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif"].includes(brand)) return "heic";
  }
  if (startsWith(bytes, 0, "GIF87a") || startsWith(bytes, 0, "GIF89a")) return "gif";
  if (indexOf(bytes.subarray(0, 1024), "%PDF-") >= 0) return "pdf";
  return "unknown";
}

type Parsed = { width: number | null; height: number | null; tiff: Tiff | null; software: string | null; complete: boolean };

function parseJpeg(bytes: Uint8Array): Parsed {
  const out: Parsed = { width: null, height: null, tiff: null, software: null, complete: false };
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1]!;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      /* The picture itself starts here: every header before it has been read. */
      out.complete = true;
      break;
    }
    const size = u16be(bytes, i + 2);
    if (size < 2) break;
    const data = i + 4;
    if (marker === 0xe1 && startsWith(bytes, data, "Exif\0\0") && !out.tiff) out.tiff = readTiff(bytes, data + 6);
    const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame && data + 5 <= bytes.length) {
      out.height = u16be(bytes, data + 1);
      out.width = u16be(bytes, data + 3);
    }
    i += 2 + size;
  }
  return out;
}

function parsePng(bytes: Uint8Array): Parsed {
  const out: Parsed = { width: null, height: null, tiff: null, software: null, complete: false };
  let i = 8;
  while (i + 8 <= bytes.length) {
    const size = u32be(bytes, i);
    const type = ascii(bytes, i + 4, 4);
    const data = i + 8;
    if (type === "IHDR" && data + 8 <= bytes.length) {
      out.width = u32be(bytes, data);
      out.height = u32be(bytes, data + 4);
    } else if (type === "eXIf") {
      out.tiff = readTiff(bytes, data);
    } else if (type === "tEXt") {
      const text = ascii(bytes, data, Math.min(size, 300));
      const nul = text.indexOf("\0");
      if (nul > 0 && text.slice(0, nul) === "Software") out.software = tidy(text.slice(nul + 1));
    } else if (type === "IDAT" || type === "IEND") {
      out.complete = true;
      if (type === "IEND") break;
    }
    i = data + size + 4;
  }
  return out;
}

function parseWebp(bytes: Uint8Array): Parsed {
  const out: Parsed = { width: null, height: null, tiff: null, software: null, complete: false };
  const total = u32le(bytes, 4) + 8;
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = ascii(bytes, i, 4);
    const size = u32le(bytes, i + 4);
    const data = i + 8;
    if (type === "VP8X" && data + 10 <= bytes.length) {
      out.width = 1 + u24le(bytes, data + 4);
      out.height = 1 + u24le(bytes, data + 7);
    } else if (type === "VP8 " && data + 10 <= bytes.length && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      out.width ??= u16le(bytes, data + 6) & 0x3fff;
      out.height ??= u16le(bytes, data + 8) & 0x3fff;
    } else if (type === "VP8L" && data + 5 <= bytes.length && bytes[data] === 0x2f) {
      const bits = u32le(bytes, data + 1);
      out.width ??= (bits & 0x3fff) + 1;
      out.height ??= ((bits >>> 14) & 0x3fff) + 1;
    } else if (type === "EXIF") {
      out.tiff = readTiff(bytes, startsWith(bytes, data, "Exif\0\0") ? data + 6 : data);
    }
    i = data + size + (size % 2);
  }
  /* A WebP keeps its camera details after the picture, so only a file read to its end settles it. */
  out.complete = i >= total && total <= bytes.length;
  return out;
}

function parseHeic(bytes: Uint8Array): Parsed {
  const out: Parsed = { width: null, height: null, tiff: null, software: null, complete: false };
  let from = 0;
  for (let tries = 0; tries < 16; tries += 1) {
    const at = indexOf(bytes, "ispe", from);
    if (at < 0 || at + 16 > bytes.length) break;
    const width = u32be(bytes, at + 8);
    const height = u32be(bytes, at + 12);
    /* The largest size named is the picture; the smaller ones are its thumbnails. */
    if (width * height > (out.width ?? 0) * (out.height ?? 0) && width < 65536 && height < 65536) {
      out.width = width;
      out.height = height;
    }
    from = at + 4;
  }
  return out;
}

/** Everything this module can tell from the first bytes of one file. */
export function readImageSignals(input: Uint8Array): ImageSignals {
  const bytes = input.length > IMAGE_SIGNAL_BYTES ? input.subarray(0, IMAGE_SIGNAL_BYTES) : input;
  const type = imageTypeOf(bytes);
  const parsed: Parsed =
    type === "jpeg"
      ? parseJpeg(bytes)
      : type === "png"
        ? parsePng(bytes)
        : type === "webp"
          ? parseWebp(bytes)
          : type === "heic"
            ? parseHeic(bytes)
            : { width: null, height: null, tiff: null, software: null, complete: false };

  const picture = type === "jpeg" || type === "png" || type === "webp" || type === "heic";
  const tiff = parsed.tiff ?? (picture ? tiffAfterExifHeader(bytes) : null);
  const creator = picture ? xmpCreatorTool(bytes) : null;

  const camera = Boolean(tiff && (tiff.make || tiff.model || tiff.captured));
  const metadata: ImageSignals["metadata"] = camera ? "camera" : parsed.complete ? "none" : "unknown";

  const named = [creator, parsed.software, tiff?.software ?? null];
  const editor = named.map(editorIn).find((name) => name !== null) ?? null;
  /* The Software tag of a camera photo is the phone's own firmware, so only an
     editing program's name, or a program named in XMP, is reported. */
  const software =
    named.find((value) => editorIn(value) !== null) ??
    (creator && namesAProgram(creator) ? creator : null) ??
    (parsed.software && namesAProgram(parsed.software) ? parsed.software : null);

  let screenshotReason: ImageSignals["screenshotReason"] = null;
  if (!camera) {
    if (type === "png") screenshotReason = "png";
    else if (picture && isPhoneScreenSize(parsed.width, parsed.height)) screenshotReason = "screen_size";
  }

  return {
    type,
    width: parsed.width,
    height: parsed.height,
    metadata,
    software: software ?? null,
    editor,
    screenshot: screenshotReason !== null,
    screenshotReason,
  };
}

/* ------------------------------------------------------------ the findings */

const TYPE_WORD: Record<ImageType, string> = {
  jpeg: "a JPEG photo",
  png: "a PNG image",
  webp: "a WebP image",
  heic: "a HEIC photo",
  gif: "a GIF image",
  pdf: "a PDF",
  unknown: "a kind of file we do not recognise",
};

const EXTENSION_TYPE: Record<string, ImageType> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  heic: "heic",
  heif: "heic",
  gif: "gif",
  pdf: "pdf",
};

export type ImageFindingInput = {
  /** Unique in the panel: "front", "back", "selfie", "address". */
  slot: string;
  /** How the file is named in a sentence: "The front image", "The selfie". */
  label: string;
  /** True for an ID or a selfie, where a photo of the real thing is expected. */
  expectsPhoto: boolean;
  /** The extension of the stored file name, without the dot. */
  extension?: string | null;
};

/** The findings for one file. Always at least one, so the panel shows the file was looked at. */
export function imageFindings(input: ImageFindingInput, signals: ImageSignals): Finding[] {
  const { slot, label } = input;
  const out: Finding[] = [];
  const key = (name: string) => `file.${slot}.${name}`;

  const declared = input.extension ? EXTENSION_TYPE[input.extension.toLowerCase()] : undefined;
  if (signals.type === "unknown") {
    out.push(finding(key("type"), "look", `${label} is not a kind of file we recognise`, "Its opening bytes are not those of a photo or a PDF. Open it and look before you decide."));
  } else if (declared && declared !== signals.type) {
    out.push(
      finding(
        key("type"),
        "look",
        `${label} is not the kind of file its name says`,
        `The name says ${TYPE_WORD[declared]} and the contents are ${TYPE_WORD[signals.type]}. Often harmless (a renamed file), and worth a closer look.`,
      ),
    );
  }

  if (signals.type === "pdf") {
    if (input.expectsPhoto) {
      out.push(finding(key("pdf"), "look", `${label} is a PDF, not a photo`, "A PDF of an ID is a scan or an export, which is easier to edit than a photo of the document itself. Open it and look closely, or ask for a photo."));
    }
    return out;
  }
  if (signals.type === "unknown" || signals.type === "gif") return out;

  if (signals.editor) {
    out.push(
      finding(
        key("editor"),
        "look",
        `${label} was saved by an editing app (${signals.editor})`,
        "People crop and rotate honest photos in editing apps, and names, dates and faces are changed in them too. Zoom in on the name, the photo and the dates. A file with no such mark is not cleared by that.",
      ),
    );
  } else if (signals.software) {
    out.push(
      finding(
        key("editor"),
        "look",
        `${label} names the program that last saved it (${signals.software})`,
        "Some phone cameras name themselves here, and so do editing programs. It is a reason to look at the picture closely, not a verdict.",
      ),
    );
  }

  if (signals.screenshotReason === "png") {
    out.push(
      finding(
        key("screenshot"),
        "look",
        `${label} looks like a screenshot`,
        "It is a PNG with no camera details, which is what a screenshot or an image saved from an app is, and not what a camera makes. A photo of the document itself is needed.",
      ),
    );
  } else if (signals.screenshotReason === "screen_size") {
    out.push(
      finding(
        key("screenshot"),
        "look",
        `${label} looks like a screenshot`,
        `It is exactly the size of a phone screen (${signals.width} by ${signals.height}) and has no camera details. A photo of the document itself is needed.`,
      ),
    );
  }

  if (signals.metadata === "camera" && !signals.editor) {
    out.push(finding(key("camera"), "ok", `${label} carries camera details`, "The file says a camera took it. Those details can be copied in, so this is a small good sign and nothing more."));
  }

  if (out.length === 0) {
    out.push(
      finding(
        key("plain"),
        "ok",
        `${label} carries no editing mark`,
        "No editing program is named in the file and it is not a screenshot. Marks are easy to remove, so their absence means nothing by itself: still look at the picture.",
      ),
    );
  }
  return out;
}
