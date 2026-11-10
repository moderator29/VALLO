/**
 * A SMALL MAPBOX VECTOR TILE READER, FOR THE MAPS THAT DO NOT LOAD MAPLIBRE.
 *
 * OpenFreeMap serves vector tiles only, so the still area tiles and the
 * lightweight fallback map (`still.ts`, `lite-layer.ts`) have to read them
 * without a WebGL engine. MapLibre carries a full reader, but it is the
 * 300 KB this path exists to avoid, and a second package would be a second
 * dependency for the same job. The format is small and stable (Mapbox Vector
 * Tile 2.1: protobuf, three message types, three geometry commands), so it is
 * read here in one page, and only the layers and properties a caller asks for
 * are decoded at all: a z14 city tile carries dozens of translated names per
 * place, and none of them is ever read.
 *
 * Pure and synchronous. Tested against a hand-built tile in `mvt.test.ts`.
 */

export type MvtValue = string | number | boolean;

export type MvtFeature = {
  /** 1 point, 2 line, 3 polygon. */
  type: number;
  props: Record<string, MvtValue>;
  /** Each part flattened as x0, y0, x1, y1... in tile units; rings closed. */
  parts: number[][];
};

export type MvtLayer = { name: string; extent: number; features: MvtFeature[] };

export type MvtTile = Map<string, MvtLayer>;

const utf8 = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8");

class Reader {
  readonly buf: Uint8Array;
  pos: number;
  readonly end: number;
  constructor(buf: Uint8Array, start = 0, end = buf.length) {
    this.buf = buf;
    this.pos = start;
    this.end = end;
  }

  varint(): number {
    let value = 0;
    let scale = 1;
    let byte: number;
    do {
      byte = this.buf[this.pos++] ?? 0;
      value += (byte & 0x7f) * scale;
      scale *= 128;
    } while (byte >= 0x80 && this.pos < this.end);
    return value;
  }

  /** The bounds of a length-delimited field, with the cursor moved past it. */
  bytes(): [number, number] {
    const length = this.varint();
    const start = this.pos;
    this.pos += length;
    return [start, this.pos];
  }

  string(): string {
    const [start, end] = this.bytes();
    const slice = this.buf.subarray(start, end);
    if (utf8) return utf8.decode(slice);
    let out = "";
    for (const byte of slice) out += String.fromCharCode(byte);
    return out;
  }

  skip(wire: number): void {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.bytes();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`mvt: unsupported wire type ${wire}`);
  }
}

function zigzag(n: number): number {
  return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
}

function readValue(buf: Uint8Array, start: number, end: number): MvtValue {
  const reader = new Reader(buf, start, end);
  let value: MvtValue = "";
  while (reader.pos < end) {
    const tag = reader.varint();
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    if (field === 1) value = reader.string();
    else if (field === 2 && wire === 5) {
      value = new DataView(buf.buffer, buf.byteOffset + reader.pos, 4).getFloat32(0, true);
      reader.pos += 4;
    } else if (field === 3 && wire === 1) {
      value = new DataView(buf.buffer, buf.byteOffset + reader.pos, 8).getFloat64(0, true);
      reader.pos += 8;
    } else if (field === 4 || field === 5) value = reader.varint();
    else if (field === 6) value = zigzag(reader.varint());
    else if (field === 7) value = reader.varint() !== 0;
    else reader.skip(wire);
  }
  return value;
}

function packed(reader: Reader, wire: number): number[] {
  if (wire !== 2) return [reader.varint()];
  const [start, end] = reader.bytes();
  const inner = new Reader(reader.buf, start, end);
  const out: number[] = [];
  while (inner.pos < end) out.push(inner.varint());
  return out;
}

/** Commands to parts: MoveTo starts a part, LineTo extends it, ClosePath closes it. */
export function decodeGeometry(commands: readonly number[]): number[][] {
  const parts: number[][] = [];
  let current: number[] | null = null;
  let x = 0;
  let y = 0;
  let i = 0;
  while (i < commands.length) {
    const command = commands[i++] ?? 0;
    const id = command & 7;
    const count = Math.floor(command / 8);
    if (id === 1 || id === 2) {
      for (let k = 0; k < count && i + 1 < commands.length; k++) {
        x += zigzag(commands[i++] ?? 0);
        y += zigzag(commands[i++] ?? 0);
        if (id === 1 || !current) {
          current = [];
          parts.push(current);
        }
        current.push(x, y);
      }
    } else if (id === 7) {
      if (current && current.length >= 2) current.push(current[0] ?? 0, current[1] ?? 0);
    } else {
      break;
    }
  }
  return parts;
}

function readLayer(buf: Uint8Array, start: number, end: number, wantedKeys: ReadonlySet<string>): MvtLayer {
  const reader = new Reader(buf, start, end);
  let name = "";
  let extent = 4096;
  const features: [number, number][] = [];
  const keys: string[] = [];
  const values: [number, number][] = [];
  while (reader.pos < end) {
    const tag = reader.varint();
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    if (field === 1) name = reader.string();
    else if (field === 2) features.push(reader.bytes());
    else if (field === 3) keys.push(reader.string());
    else if (field === 4) values.push(reader.bytes());
    else if (field === 5) extent = reader.varint();
    else reader.skip(wire);
  }

  /* Values are decoded on demand: most of them are names in other scripts. */
  const decoded = new Map<number, MvtValue>();
  const valueAt = (index: number): MvtValue => {
    let value = decoded.get(index);
    if (value === undefined) {
      const bounds = values[index];
      value = bounds ? readValue(buf, bounds[0], bounds[1]) : "";
      decoded.set(index, value);
    }
    return value;
  };

  const out: MvtFeature[] = [];
  for (const [fStart, fEnd] of features) {
    const f = new Reader(buf, fStart, fEnd);
    let type = 0;
    let tags: number[] = [];
    let geometry: number[] = [];
    while (f.pos < fEnd) {
      const tag = f.varint();
      const field = Math.floor(tag / 8);
      const wire = tag & 7;
      if (field === 2) tags = packed(f, wire);
      else if (field === 3) type = f.varint();
      else if (field === 4) geometry = packed(f, wire);
      else f.skip(wire);
    }
    const props: Record<string, MvtValue> = {};
    for (let t = 0; t + 1 < tags.length; t += 2) {
      const key = keys[tags[t] ?? -1];
      if (key !== undefined && wantedKeys.has(key)) props[key] = valueAt(tags[t + 1] ?? -1);
    }
    out.push({ type, props, parts: decodeGeometry(geometry) });
  }
  return { name, extent, features: out };
}

/** The layer's name without decoding the rest of it. */
function layerName(buf: Uint8Array, start: number, end: number): string {
  const reader = new Reader(buf, start, end);
  while (reader.pos < end) {
    const tag = reader.varint();
    if (Math.floor(tag / 8) === 1) return reader.string();
    reader.skip(tag & 7);
  }
  return "";
}

/**
 * Decode the named layers of a tile, with only the named properties read.
 * Layers not asked for are skipped by length and never parsed.
 */
export function decodeTile(
  data: Uint8Array,
  wantedLayers: ReadonlySet<string>,
  wantedKeys: ReadonlySet<string>,
): MvtTile {
  const tile: MvtTile = new Map();
  const reader = new Reader(data);
  while (reader.pos < data.length) {
    const tag = reader.varint();
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    if (field === 3 && wire === 2) {
      const [start, end] = reader.bytes();
      const name = layerName(data, start, end);
      if (wantedLayers.has(name)) tile.set(name, readLayer(data, start, end, wantedKeys));
    } else {
      reader.skip(wire);
    }
  }
  return tile;
}
