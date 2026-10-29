/**
 * THE COMPARE TRAY'S PURE RULES (backlog row 7): which ids a stored or
 * addressed string holds, what a tap does to the list, and the address of the
 * compare page. No React and no storage, so the server page and the device
 * tray (`tray.ts`) share them.
 */

export const COMPARE_MAX = 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pure: the ids a stored string holds, valid, unique, at most the limit. */
export function parseIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === "string" && UUID.test(item) && !out.includes(item.toLowerCase())) out.push(item.toLowerCase());
      if (out.length === COMPARE_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Pure: the next list after a tap on `id`, and whether the tray refused it as full. */
export function toggled(ids: readonly string[], id: string): { ids: string[]; full: boolean } {
  const lower = id.toLowerCase();
  if (!UUID.test(lower)) return { ids: [...ids], full: false };
  if (ids.includes(lower)) return { ids: ids.filter((x) => x !== lower), full: false };
  if (ids.length >= COMPARE_MAX) return { ids: [...ids], full: true };
  return { ids: [...ids, lower], full: false };
}

/** The address of the compare page for these ids. */
export function compareHref(ids: readonly string[]): string {
  return `/compare?ids=${ids.join(",")}`;
}


/** The ids in an address's `ids` value: comma separated, well formed, unique, at most the tray's four. */
export function idsFromQuery(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return parseIds(JSON.stringify(raw.split(",").map((part) => part.trim())));
}
