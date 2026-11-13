import { describe, expect, it } from "vitest";
import { fastStart, looksLikeVideo, scrubMoovLocation, scrubVideoLocation, shiftChunkOffsets, videoExtension, videoMime } from "./video-prep";

/* A box: 4 byte size, 4 byte type, payload. */
function box(type: string, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(8 + payload.length));
  new DataView(out.buffer).setUint32(0, out.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  return out;
}
const join = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const latin = (bytes: Uint8Array) => String.fromCharCode(...bytes);

const WHERE = "+06.4474+003.4700+012.000/";
const XYZ = "©xyz";

function movie(): Uint8Array<ArrayBuffer> {
  const xyz = box(XYZ, join(new Uint8Array([0, 18, 0x15, 0xc7]), ascii(WHERE)));
  const keyed = box("ilst", join(ascii("com.apple.quicktime.location.ISO6709"), ascii(WHERE)));
  const moov = box("moov", join(box("mvhd", new Uint8Array(20)), box("udta", xyz), box("meta", keyed)));
  return join(box("ftyp", ascii("qt  ")), box("mdat", new Uint8Array(64).fill(7)), moov);
}

describe("the filmed location is taken out of a video", () => {
  it("renames every location box to free, zeroes it, and noughts every coordinate", () => {
    const bytes = movie();
    expect(latin(bytes)).toContain(WHERE);
    const changed = scrubMoovLocation(bytes);
    expect(changed).toBeGreaterThanOrEqual(2);
    expect(latin(bytes)).not.toContain(XYZ);
    expect(latin(bytes)).not.toContain(WHERE);
    expect(latin(bytes)).toContain("+00.0000+000.0000+000.000/");
  });

  it("works on the file, keeps its length and the picture, and leaves a clean file alone", async () => {
    const bytes = movie();
    const file = new File([bytes], "walk.mov", { type: "video/quicktime" });
    const out = new Uint8Array(await (await scrubVideoLocation(file)).arrayBuffer());
    expect(out.length).toBe(bytes.length);
    expect(latin(out)).not.toContain(WHERE);
    expect(Array.from(out.slice(20, 20 + 64)).every((b) => b === 7)).toBe(true);

    const clean = new File([join(box("ftyp", ascii("isom")), box("moov", box("mvhd", new Uint8Array(20))))], "a.mp4", { type: "video/mp4" });
    expect(await scrubVideoLocation(clean)).toBe(clean);
  });

  it("passes a WebM and an unreadable file through untouched", async () => {
    const webm = new File([new Uint8Array([1, 2, 3])], "a.webm", { type: "video/webm" });
    expect(await scrubVideoLocation(webm)).toBe(webm);
    const broken = new File([new Uint8Array([0, 0, 0, 99, 1, 2])], "a.mp4", { type: "video/mp4" });
    expect(await scrubVideoLocation(broken)).toBe(broken);
  });
});

describe("what a picked file is", () => {
  it("knows a video by its type, or by its name when the picker sent none", () => {
    expect(looksLikeVideo({ type: "video/mp4", name: "x" })).toBe(true);
    expect(looksLikeVideo({ type: "", name: "IMG_1.MOV" })).toBe(true);
    expect(looksLikeVideo({ type: "image/jpeg", name: "a.mov" })).toBe(false);
    expect(videoExtension({ type: "", name: "a.webm" })).toBe("webm");
    expect(videoMime({ type: "", name: "a.MOV" })).toBe("video/quicktime");
    expect(videoMime({ type: "video/mp4", name: "a" })).toBe("video/mp4");
  });
});

/*
 * FAST START (13 November 2026): the index moved in front of the picture, the
 * chunk offsets moved with it, and not one byte of the picture changed.
 */
function stco(offsets: number[]): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(new ArrayBuffer(8 + offsets.length * 4));
  const v = new DataView(body.buffer);
  v.setUint32(4, offsets.length);
  offsets.forEach((o, i) => v.setUint32(8 + i * 4, o));
  return box("stco", body);
}
function co64(offsets: number[]): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(new ArrayBuffer(8 + offsets.length * 8));
  const v = new DataView(body.buffer);
  v.setUint32(4, offsets.length);
  offsets.forEach((o, i) => v.setBigUint64(8 + i * 8, BigInt(o)));
  return box("co64", body);
}
const index = (table: Uint8Array) =>
  box("moov", join(box("mvhd", new Uint8Array(20)), box("trak", box("mdia", box("minf", box("stbl", table))))));
const readStco = (moov: Uint8Array): number[] => {
  const at = latin(moov).indexOf("stco");
  const v = new DataView(moov.buffer, moov.byteOffset);
  const n = v.getUint32(at + 8);
  return Array.from({ length: n }, (_, i) => v.getUint32(at + 12 + i * 4));
};

describe("fast start: the index in front of the picture, the picture untouched", () => {
  it("moves a trailing index to the front and every chunk offset by its size, and frame data reads back the same", async () => {
    const ftyp = box("ftyp", ascii("qt  "));
    const picture = Uint8Array.from({ length: 96 }, (_, i) => i);
    const mdat = box("mdat", picture);
    const chunks = [ftyp.length + 8, ftyp.length + 8 + 32, ftyp.length + 8 + 64];
    const moov = index(stco(chunks));
    const file = new File([join(ftyp, mdat, moov)], "walk.mov", { type: "video/quicktime" });

    const out = new Uint8Array(await (await fastStart(file)).arrayBuffer());
    expect(out.length).toBe(file.size);
    /* ftyp, then the index, then the picture. */
    expect(latin(out.slice(4, 8))).toBe("ftyp");
    expect(latin(out.slice(ftyp.length + 4, ftyp.length + 8))).toBe("moov");
    const movedIndex = out.slice(ftyp.length, ftyp.length + moov.length);
    const shifted = readStco(movedIndex);
    expect(shifted).toEqual(chunks.map((o) => o + moov.length));
    /* Each chunk offset still points at the same picture bytes. */
    for (const [i, o] of shifted.entries()) expect(out[o]).toBe(picture[chunks[i]! - ftyp.length - 8]);
  });

  it("handles 64-bit chunk offsets too", async () => {
    const ftyp = box("ftyp", ascii("isom"));
    const mdat = box("mdat", new Uint8Array(40).fill(9));
    const moov = index(co64([ftyp.length + 8]));
    const out = new Uint8Array(await (await fastStart(new File([join(ftyp, mdat, moov)], "a.mp4", { type: "video/mp4" }))).arrayBuffer());
    expect(latin(out.slice(ftyp.length + 4, ftyp.length + 8))).toBe("moov");
    const at = latin(out).indexOf("co64");
    expect(Number(new DataView(out.buffer).getBigUint64(at + 12))).toBe(ftyp.length + 8 + moov.length);
  });

  it("leaves alone a file already in order, a fragmented file, a WebM and an unreadable one", async () => {
    const ordered = new File([join(box("ftyp", ascii("isom")), index(stco([100])), box("mdat", new Uint8Array(8)))], "a.mp4", { type: "video/mp4" });
    expect(await fastStart(ordered)).toBe(ordered);
    const fragmentedMoov = box("moov", join(box("mvhd", new Uint8Array(20)), box("mvex", new Uint8Array(8))));
    const fragmented = new File([join(box("ftyp", ascii("isom")), box("mdat", new Uint8Array(8)), fragmentedMoov)], "f.mp4", { type: "video/mp4" });
    expect(await fastStart(fragmented)).toBe(fragmented);
    const webm = new File([new Uint8Array([1, 2, 3])], "a.webm", { type: "video/webm" });
    expect(await fastStart(webm)).toBe(webm);
    const broken = new File([new Uint8Array([0, 0, 0, 99, 1, 2])], "a.mp4", { type: "video/mp4" });
    expect(await fastStart(broken)).toBe(broken);
  });

  it("refuses to wrap a 32-bit offset past its field, leaving the file as it was", () => {
    const moov = index(stco([0xfffffff0]));
    expect(shiftChunkOffsets(moov, 0x100, 0, 0xffffffff)).toBe(false);
  });
});
