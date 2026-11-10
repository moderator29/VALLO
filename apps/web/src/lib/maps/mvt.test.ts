import { describe, expect, it } from "vitest";
import { decodeGeometry, decodeTile } from "./mvt";

/* A minimal protobuf writer, enough to build a Mapbox Vector Tile by hand. */
function varint(n: number): number[] {
  const out: number[] = [];
  let v = n;
  while (v >= 0x80) {
    out.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}
const key = (field: number, wire: number) => varint(field * 8 + wire);
const bytes = (field: number, payload: number[]) => [...key(field, 2), ...varint(payload.length), ...payload];
const str = (field: number, text: string) => bytes(field, [...new TextEncoder().encode(text)]);
const uint = (field: number, n: number) => [...key(field, 0), ...varint(n)];
const packed = (field: number, list: number[]) => bytes(field, list.flatMap(varint));
const zz = (n: number) => (n >= 0 ? n * 2 : -n * 2 - 1);
const cmd = (id: number, count: number) => id + count * 8;

function feature(type: number, tags: number[], geometry: number[]): number[] {
  return [...packed(2, tags), ...uint(3, type), ...packed(4, geometry)];
}

function layer(name: string, features: number[][], keys: string[], values: number[][]): number[] {
  return [
    ...uint(15, 2),
    ...str(1, name),
    ...features.flatMap((f) => bytes(2, f)),
    ...keys.flatMap((k) => str(3, k)),
    ...values.flatMap((v) => bytes(4, v)),
    ...uint(5, 4096),
  ];
}

describe("the vector tile reader", () => {
  it("turns geometry commands into parts, closing rings", () => {
    const square = [cmd(1, 1), zz(10), zz(10), cmd(2, 3), zz(20), 0, 0, zz(20), zz(-20), 0, cmd(7, 1)];
    expect(decodeGeometry(square)).toEqual([[10, 10, 30, 10, 30, 30, 10, 30, 10, 10]]);
    /* Two points in one MoveTo are two parts. */
    expect(decodeGeometry([cmd(1, 2), zz(5), zz(6), zz(1), zz(-1)])).toEqual([[5, 6], [6, 5]]);
  });

  it("decodes only the layers and properties asked for", () => {
    const road = feature(2, [0, 0, 1, 1], [cmd(1, 1), zz(0), zz(0), cmd(2, 1), zz(4096), zz(4096)]);
    const transport = layer("transportation", [road], ["class", "name:fr"], [str(1, "primary"), str(1, "Route")]);
    const place = layer(
      "place",
      [feature(1, [0, 0, 1, 1], [cmd(1, 1), zz(2048), zz(1024)])],
      ["class", "name"],
      [str(1, "suburb"), str(1, "Yaba")],
    );
    const skipped = layer("poi", [feature(1, [], [cmd(1, 1), 0, 0])], [], []);
    const tile = new Uint8Array([...bytes(3, transport), ...bytes(3, skipped), ...bytes(3, place)]);

    const decoded = decodeTile(tile, new Set(["transportation", "place"]), new Set(["class", "name"]));
    expect([...decoded.keys()]).toEqual(["transportation", "place"]);

    const t = decoded.get("transportation");
    expect(t?.extent).toBe(4096);
    expect(t?.features[0]?.type).toBe(2);
    expect(t?.features[0]?.props).toEqual({ class: "primary" });
    expect(t?.features[0]?.parts).toEqual([[0, 0, 4096, 4096]]);

    const p = decoded.get("place")?.features[0];
    expect(p?.props).toEqual({ class: "suburb", name: "Yaba" });
    expect(p?.parts).toEqual([[2048, 1024]]);
  });

  it("reads numbers and booleans as well as strings", () => {
    const values = [
      [...key(4, 0), ...varint(7)],
      [...key(6, 0), ...varint(zz(-3))],
      [...key(7, 0), 1],
    ];
    const l = layer("landuse", [feature(3, [0, 0, 1, 1, 2, 2], [cmd(1, 1), 0, 0])], ["a", "b", "c"], values);
    const decoded = decodeTile(new Uint8Array(bytes(3, l)), new Set(["landuse"]), new Set(["a", "b", "c"]));
    expect(decoded.get("landuse")?.features[0]?.props).toEqual({ a: 7, b: -3, c: true });
  });
});
