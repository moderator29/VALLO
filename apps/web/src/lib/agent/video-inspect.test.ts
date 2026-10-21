import { describe, expect, it } from "vitest";
import { scrubMoovLocation } from "./video-prep";
import { inspectVideo, mvhdSeconds, readMoov, regionHasLocation, type RangeReader } from "./video-inspect";

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

const WHERE = "+06.4474+003.4700+012.000/";

/** A version 0 movie header: timescale and duration in units. */
function mvhd(timescale: number, duration: number): Uint8Array<ArrayBuffer> {
  const payload = new Uint8Array(new ArrayBuffer(100));
  const view = new DataView(payload.buffer);
  view.setUint32(12, timescale);
  view.setUint32(16, duration);
  return box("mvhd", payload);
}

function movie(options: { seconds?: number; located?: boolean } = {}): Uint8Array<ArrayBuffer> {
  const seconds = options.seconds ?? 42;
  const udta = options.located
    ? box("udta", box("©xyz", join(new Uint8Array([0, 18, 0x15, 0xc7]), ascii(WHERE))))
    : box("udta", box("name", ascii("walk")));
  const meta = box("meta", box("ilst", join(ascii("com.apple.quicktime.location.ISO6709"), ascii(options.located ? WHERE : "none/"))));
  const trak = box("trak", join(box("tkhd", new Uint8Array(84)), box("mdia", box("mdhd", new Uint8Array(24)))));
  const moov = box("moov", join(mvhd(600, seconds * 600), trak, udta, meta));
  return join(box("ftyp", ascii("qt  ")), box("mdat", new Uint8Array(256).fill(7)), moov);
}

const readerOf =
  (bytes: Uint8Array): RangeReader =>
  async (start, end) =>
    bytes.slice(start, end + 1);

describe("a stored video is checked from its bytes", () => {
  it("passes a clean movie and measures it from the movie header", async () => {
    const bytes = movie({ seconds: 42 });
    const verdict = await inspectVideo(readerOf(bytes), bytes.length);
    expect(verdict).toEqual({ ok: true, container: "mp4", durationSeconds: 42 });
  });

  it("measures a movie longer than the minute, so the action can refuse it", async () => {
    const bytes = movie({ seconds: 95 });
    const verdict = await inspectVideo(readerOf(bytes), bytes.length);
    expect(verdict.ok && verdict.durationSeconds).toBe(95);
  });

  it("refuses a movie that still says where it was filmed", async () => {
    const bytes = movie({ located: true });
    expect(await inspectVideo(readerOf(bytes), bytes.length)).toEqual({ ok: false, reason: "location" });
  });

  it("passes the same movie once the wizard has taken the location out", async () => {
    const bytes = movie({ located: true });
    /* Scrub the moov the way the browser does: it starts after the 12 byte
       ftyp and the 264 byte mdat. */
    const start = 12 + 264;
    const moov = bytes.subarray(start);
    expect(scrubMoovLocation(moov)).toBeGreaterThan(0);
    const verdict = await inspectVideo(readerOf(bytes), bytes.length);
    expect(verdict.ok).toBe(true);
  });

  it("refuses a page, a script or a picture renamed as a video", async () => {
    for (const fake of [
      ascii("<!DOCTYPE html><html><script>alert(1)</script></html>"),
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1]),
      ascii("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>"),
    ]) {
      expect(await inspectVideo(readerOf(fake), fake.length)).toEqual({ ok: false, reason: "not-a-video" });
    }
  });

  it("refuses boxes that do not cover the file exactly, and a file with no movie box", async () => {
    const truncated = movie().subarray(0, 200);
    expect((await inspectVideo(readerOf(truncated), truncated.length)).ok).toBe(false);
    const noMoov = join(box("ftyp", ascii("isom")), box("mdat", new Uint8Array(64)));
    expect(await inspectVideo(readerOf(noMoov), noMoov.length)).toEqual({ ok: false, reason: "not-a-video" });
  });

  it("knows a WebM file by its magic and leaves its length to the browser's figure", async () => {
    const webm = join(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), new Uint8Array(60));
    expect(await inspectVideo(readerOf(webm), webm.length)).toEqual({ ok: true, container: "webm", durationSeconds: null });
  });

  it("says unreadable, never a pass, when storage does not answer", async () => {
    const bytes = movie();
    expect(await inspectVideo(async () => null, bytes.length)).toEqual({ ok: false, reason: "unreadable" });
  });
});

describe("the pieces", () => {
  it("reads both movie header versions", () => {
    const v0 = new Uint8Array(100);
    new DataView(v0.buffer).setUint32(12, 1000);
    new DataView(v0.buffer).setUint32(16, 30_500);
    expect(mvhdSeconds(v0)).toBe(30.5);
    const v1 = new Uint8Array(112);
    v1[0] = 1;
    new DataView(v1.buffer).setUint32(20, 90_000);
    new DataView(v1.buffer).setBigUint64(24, 5_400_000n);
    expect(mvhdSeconds(v1)).toBe(60);
  });

  it("ignores a coordinate that is all noughts and finds one that is not", () => {
    expect(regionHasLocation(ascii("+00.0000+000.0000+000.000/"))).toBe(false);
    expect(regionHasLocation(ascii(WHERE))).toBe(true);
  });

  it("accepts the four zero bytes QuickTime may close a box list with", () => {
    const moov = box("moov", join(mvhd(600, 6000), new Uint8Array(4)));
    expect(readMoov(moov)).toEqual({ seconds: 10, location: false });
  });
});
