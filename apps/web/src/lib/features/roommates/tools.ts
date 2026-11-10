/**
 * THE SMALL TOOLS' PURE PARTS (safe on both sides): the house agreement's
 * plain text, built from what the people chose. The words come in from the
 * roommates copy; nothing here holds a figure or a promise, and it is never a
 * legal contract.
 */
export type AgreementWords = { heading: string; who: string; where: string; split: string; rulesHead: string; note: string };
export type AgreementInput = { names: string; where: string; splitLabel: string; rules: readonly string[] };

const clean = (v: string, max: number) => v.replace(/\s+/g, " ").trim().slice(0, max);

export function agreementText(w: AgreementWords, i: AgreementInput): string {
  const names = i.names.split(",").map((n) => clean(n, 40)).filter(Boolean).slice(0, 8).join(", ");
  const where = clean(i.where, 80);
  const rules = i.rules.map((r) => clean(r, 120)).filter(Boolean).slice(0, 20);
  const lines = [w.heading];
  if (names) lines.push(w.who.replace("{names}", names));
  if (where) lines.push(w.where.replace("{where}", where));
  lines.push(w.split.replace("{split}", i.splitLabel));
  lines.push("", w.rulesHead, ...rules.map((r, n) => `${n + 1}. ${r}`), "", w.note);
  return lines.join("\n");
}

/** Which Roommates shelf opens on Saved: the one asked for, else Rooms when it has items, else People when only it does. */
export function openShelf(asked: "rooms" | "people" | undefined, rooms: number, people: number): "rooms" | "people" {
  if (asked) return asked;
  return rooms > 0 || people === 0 ? "rooms" : "people";
}
