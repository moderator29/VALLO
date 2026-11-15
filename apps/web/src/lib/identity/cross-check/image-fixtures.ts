/**
 * SYNTHETIC IMAGE FILES, BUILT BYTE BY BYTE. Test and preview only: nothing
 * in the product imports this.
 *
 * Each builder writes just enough of a real file format for a parser to walk
 * (headers, sizes, metadata blocks) and no picture at all, so no photograph
 * of anybody is ever needed to test what a file says about itself.
 */

function bytesOf(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0) & 0xff);
}

export type ExifInput = { make?: string; model?: string; software?: string; captured?: string; bigEndian?: boolean };

/** A TIFF block holding the few EXIF tags the desk reads. */
export function tiff(input: ExifInput): number[] {
  const big = input.bigEndian === true;
  const u16 = (n: number) => (big ? [(n >> 8) & 0xff, n & 0xff] : [n & 0xff, (n >> 8) & 0xff]);
  const u32 = (n: number) => (big ? [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] : [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);

  type Entry = { tag: number; text?: string; pointer?: "exif" };
  const first: Entry[] = [];
  if (input.make !== undefined) first.push({ tag: 0x010f, text: input.make });
  if (input.model !== undefined) first.push({ tag: 0x0110, text: input.model });
  if (input.software !== undefined) first.push({ tag: 0x0131, text: input.software });
  if (input.captured !== undefined) first.push({ tag: 0x8769, pointer: "exif" });
  const second: Entry[] = input.captured !== undefined ? [{ tag: 0x9003, text: input.captured }] : [];

  const sizeOf = (entries: Entry[]) => 2 + entries.length * 12 + 4;
  const firstAt = 8;
  const secondAt = firstAt + sizeOf(first);
  let dataAt = secondAt + (second.length > 0 ? sizeOf(second) : 0);
  const data: number[] = [];

  const write = (entries: Entry[]): number[] => {
    const out: number[] = [...u16(entries.length)];
    for (const entry of entries) {
      if (entry.pointer) {
        out.push(...u16(entry.tag), ...u16(4), ...u32(1), ...u32(secondAt));
        continue;
      }
      const value = [...bytesOf(entry.text ?? ""), 0];
      out.push(...u16(entry.tag), ...u16(2), ...u32(value.length));
      if (value.length <= 4) {
        out.push(...value, ...new Array<number>(4 - value.length).fill(0));
      } else {
        out.push(...u32(dataAt));
        data.push(...value);
        dataAt += value.length;
      }
    }
    out.push(...u32(0));
    return out;
  };

  const header = big ? [0x4d, 0x4d, 0x00, 0x2a, ...u32(firstAt)] : [0x49, 0x49, 0x2a, 0x00, ...u32(firstAt)];
  const one = write(first);
  const two = second.length > 0 ? write(second) : [];
  return [...header, ...one, ...two, ...data];
}

export function xmpPacket(creatorTool: string, style: "attribute" | "element" = "attribute"): string {
  const inner =
    style === "attribute"
      ? `<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="${creatorTool}"/>`
      : `<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>${creatorTool}</xmp:CreatorTool></rdf:Description>`;
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${inner}</rdf:RDF></x:xmpmeta>`;
}

export type FileInput = { width?: number; height?: number; exif?: ExifInput; xmp?: string; software?: string; cut?: boolean; padding?: number };

function segment(marker: number, body: number[]): number[] {
  const size = body.length + 2;
  return [0xff, marker, (size >> 8) & 0xff, size & 0xff, ...body];
}

/** A JPEG: headers only, up to the start of the picture. `cut` stops before the picture starts. */
export function jpeg(input: FileInput = {}): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  out.push(...segment(0xe0, [...bytesOf("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]));
  if (input.exif) out.push(...segment(0xe1, [...bytesOf("Exif\0\0"), ...tiff(input.exif)]));
  if (input.xmp) out.push(...segment(0xe1, [...bytesOf("http://ns.adobe.com/xap/1.0/\0"), ...bytesOf(input.xmp)]));
  if (input.padding) out.push(...segment(0xfe, new Array<number>(input.padding).fill(0x20)));
  const width = input.width ?? 1920;
  const height = input.height ?? 1080;
  out.push(...segment(0xc0, [8, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]));
  if (!input.cut) out.push(...segment(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]), 0x00, 0xff, 0xd9);
  return Uint8Array.from(out);
}

function chunk(type: string, body: number[]): number[] {
  const size = body.length;
  return [(size >>> 24) & 0xff, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...bytesOf(type), ...body, 0, 0, 0, 0];
}

/** A PNG: signature, header, optional text and EXIF chunks, a stub of picture data, the end. */
export function png(input: FileInput = {}): Uint8Array {
  const width = input.width ?? 1080;
  const height = input.height ?? 2400;
  const be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const out: number[] = [0x89, ...bytesOf("PNG\r\n"), 0x1a, 0x0a];
  out.push(...chunk("IHDR", [...be(width), ...be(height), 8, 6, 0, 0, 0]));
  if (input.software) out.push(...chunk("tEXt", [...bytesOf("Software\0"), ...bytesOf(input.software)]));
  if (input.xmp) out.push(...chunk("iTXt", [...bytesOf("XML:com.adobe.xmp\0\0\0\0\0"), ...bytesOf(input.xmp)]));
  if (input.exif) out.push(...chunk("eXIf", tiff(input.exif)));
  out.push(...chunk("IDAT", [0x78, 0x9c, 0x01, 0x00]));
  out.push(...chunk("IEND", []));
  return Uint8Array.from(out);
}

/** A WebP in the extended layout: canvas size, then optional EXIF. `cut` drops the tail, as a partial read does. */
export function webp(input: FileInput = {}): Uint8Array {
  const width = (input.width ?? 1280) - 1;
  const height = (input.height ?? 960) - 1;
  const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
  const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  const riffChunk = (type: string, body: number[]) => [...bytesOf(type), ...le32(body.length), ...body, ...(body.length % 2 ? [0] : [])];
  const body: number[] = [...bytesOf("WEBP")];
  body.push(...riffChunk("VP8X", [0x08, 0, 0, 0, ...le24(width), ...le24(height)]));
  body.push(...riffChunk("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0, 0, 0, 0]));
  if (input.exif) body.push(...riffChunk("EXIF", tiff(input.exif)));
  if (input.xmp) body.push(...riffChunk("XMP ", bytesOf(input.xmp)));
  const all = [...bytesOf("RIFF"), ...le32(body.length + (input.cut ? 50_000 : 0)), ...body];
  return Uint8Array.from(all);
}

/** A HEIC: the file-type box, a picture size box, and EXIF where a phone puts it when asked for. */
export function heic(input: FileInput = {}): Uint8Array {
  const be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const out: number[] = [...be(24), ...bytesOf("ftypheic"), 0, 0, 0, 0, ...bytesOf("mif1heic")];
  out.push(...be(20), ...bytesOf("ispe"), 0, 0, 0, 0, ...be(160), ...be(120));
  out.push(...be(20), ...bytesOf("ispe"), 0, 0, 0, 0, ...be(input.width ?? 4032), ...be(input.height ?? 3024));
  if (input.exif) out.push(...bytesOf("Exif\0\0"), ...tiff(input.exif));
  if (input.xmp) out.push(...bytesOf(input.xmp));
  return Uint8Array.from(out);
}

export function pdf(): Uint8Array {
  return Uint8Array.from(bytesOf("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"));
}

export function gif(): Uint8Array {
  return Uint8Array.from([...bytesOf("GIF89a"), 1, 0, 1, 0, 0, 0, 0]);
}

export function text(value: string): Uint8Array {
  return Uint8Array.from(bytesOf(value));
}
