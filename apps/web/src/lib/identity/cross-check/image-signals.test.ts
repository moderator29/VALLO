import { describe, expect, it } from "vitest";

import { gif, heic, jpeg, pdf, png, text, tiff, webp, xmpPacket } from "./image-fixtures";
import {
  IMAGE_SIGNAL_BYTES,
  editorIn,
  imageFindings,
  imageTypeOf,
  isPhoneScreenSize,
  readImageSignals,
  readTiff,
  xmpCreatorTool,
  type ImageSignals,
} from "./image-signals";

const PHONE = { make: "TECNO", model: "TECNO KJ5", software: "KJ5-H6917ABCDE-U-GL-240101V123", captured: "2026:11:10 09:15:00" };

const FRONT = { slot: "front", label: "The front image", expectsPhoto: true };

function titles(signals: ImageSignals, input = FRONT): [string, string][] {
  return imageFindings(input, signals).map((f) => [f.level, f.title]);
}

describe("the file type, by its opening bytes", () => {
  it("names each kind of file, whatever it is called", () => {
    expect(imageTypeOf(jpeg())).toBe("jpeg");
    expect(imageTypeOf(png())).toBe("png");
    expect(imageTypeOf(webp())).toBe("webp");
    expect(imageTypeOf(heic())).toBe("heic");
    expect(imageTypeOf(gif())).toBe("gif");
    expect(imageTypeOf(pdf())).toBe("pdf");
    expect(imageTypeOf(text("<html><script>alert(1)</script></html>"))).toBe("unknown");
    expect(imageTypeOf(new Uint8Array(0))).toBe("unknown");
    expect(imageTypeOf(Uint8Array.from([0xff, 0xd8]))).toBe("unknown");
  });

  it("does not take a video container for a HEIC photo", () => {
    const mp4 = Uint8Array.from([0, 0, 0, 24, ...[..."ftypisom"].map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);
    expect(imageTypeOf(mp4)).toBe("unknown");
  });
});

describe("EXIF, read with our own small parser", () => {
  it("reads make, model, software and the capture time in either byte order", () => {
    for (const bigEndian of [false, true]) {
      const block = Uint8Array.from(tiff({ ...PHONE, bigEndian }));
      expect(readTiff(block, 0)).toEqual({ make: "TECNO", model: "TECNO KJ5", software: PHONE.software, captured: true });
    }
  });

  it("reads a value short enough to sit inside its own entry", () => {
    expect(readTiff(Uint8Array.from(tiff({ make: "LG" })), 0)).toMatchObject({ make: "LG", model: null, captured: false });
  });

  it("answers null for bytes that are not a TIFF block, and survives a block cut short", () => {
    expect(readTiff(text("not a tiff block"), 0)).toBeNull();
    expect(readTiff(Uint8Array.from([0x49, 0x49, 0x2b, 0x00, 8, 0, 0, 0]), 0)).toBeNull();
    expect(readTiff(new Uint8Array(4), 0)).toBeNull();
    const whole = tiff(PHONE);
    for (const length of [9, 12, 30, 60, whole.length - 5]) {
      expect(() => readTiff(Uint8Array.from(whole.slice(0, length)), 0)).not.toThrow();
    }
  });

  it("never follows a pointer out of the bytes it was given", () => {
    const block = tiff({ make: "A long enough make" });
    /* Point the value far past the end. */
    block[18] = 0xff;
    block[19] = 0xff;
    block[20] = 0xff;
    block[21] = 0x7f;
    expect(readTiff(Uint8Array.from(block), 0)).toMatchObject({ make: null });
  });
});

describe("a JPEG", () => {
  it("taken in the Vallo app has no camera details, and that is not reported as a fault", () => {
    const signals = readImageSignals(jpeg({ width: 1920, height: 1080 }));
    expect(signals).toEqual({ type: "jpeg", width: 1920, height: 1080, metadata: "none", software: null, editor: null, screenshot: false, screenshotReason: null });
    expect(titles(signals)).toEqual([["ok", "The front image carries no editing mark"]]);
    expect(imageFindings(FRONT, signals)[0]!.detail).toContain("absence means nothing");
  });

  it("from a phone camera carries camera details, and its firmware is not called an editor", () => {
    const signals = readImageSignals(jpeg({ width: 4000, height: 3000, exif: PHONE }));
    expect(signals).toMatchObject({ metadata: "camera", editor: null, software: null, screenshot: false });
    expect(titles(signals)).toEqual([["ok", "The front image carries camera details"]]);
  });

  it.each([
    ["Adobe Photoshop 25.1 (Windows)", "Photoshop"],
    ["Adobe Photoshop Lightroom Classic 13.0", "Lightroom"],
    ["GIMP 2.10.34", "GIMP"],
    ["Canva", "Canva"],
    ["PicsArt", "PicsArt"],
    ["Snapseed 2.0", "Snapseed"],
    ["Pixelmator Pro 3.5", "Pixelmator"],
    ["Affinity Photo 2.3.0", "Affinity"],
    ["Photopea", "Photopea"],
    ["paint.net 5.0.11", "Paint.NET"],
  ])("names the editing app in the Software tag: %s", (software, name) => {
    const signals = readImageSignals(jpeg({ exif: { ...PHONE, software } }));
    expect(signals.editor).toBe(name);
    expect(titles(signals)).toEqual([["look", `The front image was saved by an editing app (${name})`]]);
  });

  it("names the editing app in XMP, written as an attribute or as an element", () => {
    for (const style of ["attribute", "element"] as const) {
      const signals = readImageSignals(jpeg({ xmp: xmpPacket("Adobe Photoshop 25.1 (Macintosh)", style) }));
      expect(signals.editor).toBe("Photoshop");
      expect(signals.metadata).toBe("none");
    }
  });

  it("reports any program named in XMP, in softer words, and ignores a bare version number", () => {
    const program = readImageSignals(jpeg({ xmp: xmpPacket("Scanner Pro 8.2") }));
    expect(program).toMatchObject({ editor: null, software: "Scanner Pro 8.2" });
    expect(titles(program)).toEqual([["look", "The front image names the program that last saved it (Scanner Pro 8.2)"]]);
    /* A phone writes its own system version here. */
    const version = readImageSignals(jpeg({ exif: { make: "Apple", model: "iPhone 14", software: "17.1" }, xmp: xmpPacket("17.1") }));
    expect(version).toMatchObject({ editor: null, software: null, metadata: "camera" });
  });

  it("looks like a screenshot when it is exactly a phone screen with no camera details", () => {
    const signals = readImageSignals(jpeg({ width: 1080, height: 2400 }));
    expect(signals).toMatchObject({ screenshot: true, screenshotReason: "screen_size" });
    const [item] = imageFindings(FRONT, signals);
    expect(item).toMatchObject({ key: "file.front.screenshot", level: "look", title: "The front image looks like a screenshot" });
    expect(item!.detail).toContain("1080 by 2400");
    /* The same size with camera details is a photo. */
    expect(readImageSignals(jpeg({ width: 1080, height: 2400, exif: PHONE })).screenshot).toBe(false);
  });

  it("cannot say there are no camera details when the bytes stop before the picture starts", () => {
    expect(readImageSignals(jpeg({ cut: true })).metadata).toBe("unknown");
  });

  it("reads only the first 256 KB, and finds metadata that sits inside them", () => {
    const big = new Uint8Array(IMAGE_SIGNAL_BYTES + 5000);
    big.set(jpeg({ exif: PHONE }));
    expect(readImageSignals(big).metadata).toBe("camera");
    /* An editing mark pushed past the limit is not seen, and nothing breaks. */
    const head = jpeg({ cut: true });
    const late = new Uint8Array(IMAGE_SIGNAL_BYTES + 400);
    late.set(head);
    late.set(text(xmpPacket("Adobe Photoshop")), IMAGE_SIGNAL_BYTES + 10);
    expect(readImageSignals(late).editor).toBeNull();
  });

  it("survives a file cut anywhere", () => {
    const whole = jpeg({ exif: { ...PHONE, software: "Adobe Photoshop" }, xmp: xmpPacket("Canva") });
    for (let length = 0; length <= whole.length; length += 7) {
      expect(() => readImageSignals(whole.subarray(0, length))).not.toThrow();
    }
  });
});

describe("a PNG", () => {
  it("with no camera details looks like a screenshot", () => {
    const signals = readImageSignals(png({ width: 1170, height: 2532 }));
    expect(signals).toMatchObject({ type: "png", width: 1170, height: 2532, metadata: "none", screenshot: true, screenshotReason: "png" });
    expect(titles(signals)).toEqual([["look", "The front image looks like a screenshot"]]);
  });

  it("names the program in its Software text, and an editor in its XMP", () => {
    expect(readImageSignals(png({ software: "GIMP 2.10" })).editor).toBe("GIMP");
    expect(readImageSignals(png({ xmp: xmpPacket("Canva") })).editor).toBe("Canva");
    const both = titles(readImageSignals(png({ software: "Adobe Photoshop 2024" })));
    expect(both).toEqual([
      ["look", "The front image was saved by an editing app (Photoshop)"],
      ["look", "The front image looks like a screenshot"],
    ]);
  });

  it("with camera details in an EXIF chunk is not called a screenshot", () => {
    expect(readImageSignals(png({ exif: PHONE }))).toMatchObject({ metadata: "camera", screenshot: false });
  });
});

describe("a WebP and a HEIC", () => {
  it("reads a WebP's size and its EXIF", () => {
    expect(readImageSignals(webp({ width: 1280, height: 960 }))).toMatchObject({ type: "webp", width: 1280, height: 960, metadata: "none" });
    expect(readImageSignals(webp({ exif: PHONE }))).toMatchObject({ metadata: "camera" });
    expect(readImageSignals(webp({ exif: { software: "Adobe Photoshop" } })).editor).toBe("Photoshop");
  });

  it("does not claim a WebP has no camera details when only its start was read", () => {
    expect(readImageSignals(webp({ cut: true })).metadata).toBe("unknown");
  });

  it("reads a HEIC's picture size (not its thumbnail's) and EXIF when it is within reach", () => {
    expect(readImageSignals(heic())).toMatchObject({ type: "heic", width: 4032, height: 3024, metadata: "unknown", screenshot: false });
    expect(readImageSignals(heic({ exif: { make: "Apple", model: "iPhone 14", captured: "2026:11:10 09:15:00" } })).metadata).toBe("camera");
    expect(readImageSignals(heic({ xmp: xmpPacket("Adobe Photoshop Lightroom") })).editor).toBe("Lightroom");
  });
});

describe("what is not a photo", () => {
  it("a PDF sent as an ID is worth a closer look; as a proof of address it is ordinary", () => {
    const signals = readImageSignals(pdf());
    expect(signals).toMatchObject({ type: "pdf", metadata: "unknown", screenshot: false });
    expect(titles(signals)).toEqual([["look", "The front image is a PDF, not a photo"]]);
    expect(imageFindings({ slot: "address", label: "The proof of address", expectsPhoto: false }, signals)).toEqual([]);
  });

  it("a file that is no kind of image is flagged", () => {
    expect(titles(readImageSignals(text("MZ this is a program")))).toEqual([["look", "The front image is not a kind of file we recognise"]]);
  });

  it("a file whose contents are not what its name says is flagged", () => {
    const signals = readImageSignals(png({ exif: PHONE }));
    const items = imageFindings({ ...FRONT, extension: "JPG" }, signals);
    expect(items[0]).toMatchObject({ key: "file.front.type", level: "look", title: "The front image is not the kind of file its name says" });
    expect(items[0]!.detail).toContain("a JPEG photo");
    expect(items[0]!.detail).toContain("a PNG image");
    expect(imageFindings({ ...FRONT, extension: "jpeg" }, readImageSignals(jpeg())).map((f) => f.key)).toEqual(["file.front.plain"]);
    expect(imageFindings({ ...FRONT, extension: "heif" }, readImageSignals(heic())).some((f) => f.key === "file.front.type")).toBe(false);
  });
});

describe("the helpers", () => {
  it("recognises an editor's name anywhere in a value, and nothing in a phone's firmware", () => {
    expect(editorIn("Adobe Photoshop CC 2019 (Windows)")).toBe("Photoshop");
    expect(editorIn("Affinity Photo 2")).toBe("Affinity");
    expect(editorIn("G991BXXU5CVF1")).toBeNull();
    expect(editorIn("HDR+ 1.0.345618096nd")).toBeNull();
    expect(editorIn(null)).toBeNull();
  });

  it("finds CreatorTool in XMP and tidies it for showing", () => {
    expect(xmpCreatorTool(text(xmpPacket("Canva")))).toBe("Canva");
    expect(xmpCreatorTool(text("no xmp here"))).toBeNull();
    expect(xmpCreatorTool(text(xmpPacket("Bad\u0001\u0002 Tool   Name")))).toBe("Bad Tool Name");
  });

  it("matches a phone screen in either direction, and never the 16 by 9 sizes a camera makes", () => {
    expect(isPhoneScreenSize(1080, 2400)).toBe(true);
    expect(isPhoneScreenSize(2400, 1080)).toBe(true);
    expect(isPhoneScreenSize(1170, 2532)).toBe(true);
    expect(isPhoneScreenSize(1080, 1920)).toBe(false);
    expect(isPhoneScreenSize(720, 1280)).toBe(false);
    expect(isPhoneScreenSize(4000, 3000)).toBe(false);
    expect(isPhoneScreenSize(null, 2400)).toBe(false);
  });

  it("labels each file by its slot, so two files never share a key", () => {
    const signals = readImageSignals(jpeg({ exif: { software: "Canva" } }));
    const front = imageFindings(FRONT, signals).map((f) => f.key);
    const back = imageFindings({ slot: "back", label: "The back image", expectsPhoto: true }, signals).map((f) => f.key);
    expect(front).toEqual(["file.front.editor"]);
    expect(back).toEqual(["file.back.editor"]);
  });

  it("writes every finding as a hint, never a verdict", () => {
    const all = [
      readImageSignals(jpeg({ exif: { software: "Adobe Photoshop" } })),
      readImageSignals(png()),
      readImageSignals(jpeg({ width: 1080, height: 2400 })),
      readImageSignals(jpeg({ exif: PHONE })),
      readImageSignals(jpeg()),
      readImageSignals(pdf()),
    ].flatMap((signals) => imageFindings(FRONT, signals));
    for (const item of all) {
      expect(item.level, item.title).not.toBe("stop");
      expect(`${item.title} ${item.detail}`).not.toMatch(/\b(forged|fake|genuine|proves|proof)\b/i);
    }
  });
});
