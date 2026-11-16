import { INTELLIGENCE_KINDS, INTELLIGENCE_TABS, type IntelligenceKind, type IntelligenceResult, type IntelligenceTab, type Understood } from "./contract";
import { foldKey } from "./text";

/**
 * VALLO INTELLIGENCE: THE ORDER OF "ALL", THE TABS AND THE CURSOR.
 *
 * "All" is groups, not one interleaved list, because a home, a person and a
 * help page cannot be ranked against each other by any honest score. The
 * groups are ordered by what the words pointed at:
 *
 *   1. the place, when the query is a place;
 *   2. the kind the words point at ("hotels" puts stays first, "my offers"
 *      puts the member's own records first, "how to" puts help first);
 *   3. the place, when one was named beside a kind;
 *   4. everything else, in the contract's default order.
 *
 * Inside a group the source's own order stands (real before example, then
 * the catalogue's order, or price when "cheap" was said).
 */

/** Which kinds each tab shows. Screens sit with help, posts with communities. */
export const TAB_KINDS: Record<IntelligenceTab, IntelligenceKind[]> = {
  all: [...INTELLIGENCE_KINDS],
  property: ["property"],
  stay: ["stay"],
  restaurant: ["restaurant"],
  roommate: ["roommate"],
  person: ["person"],
  community: ["community", "post"],
  guide: ["guide", "screen"],
  personal: ["personal"],
};

export function tabOfKind(kind: IntelligenceKind): IntelligenceTab | null {
  for (const tab of INTELLIGENCE_TABS) {
    if (tab !== "all" && TAB_KINDS[tab].includes(kind)) return tab;
  }
  return null;
}

/** How many of each kind "All" shows before its "See all". */
export const GROUP_CAP: Record<IntelligenceKind, number> = {
  place: 1,
  property: 4,
  stay: 4,
  restaurant: 3,
  roommate: 3,
  person: 3,
  community: 3,
  post: 3,
  screen: 3,
  guide: 3,
  personal: 6,
};

/** The kinds the words point at, strongest first. */
function pointed(u: Understood): IntelligenceKind[] {
  switch (u.kind) {
    case "guide":
      return ["guide", "screen"];
    case "screen":
      return ["screen", "guide"];
    case "personal":
      return ["personal", "screen"];
    case "community":
      return ["community", "post"];
    case undefined:
    case "place":
      return [];
    default:
      return [u.kind];
  }
}

export function groupOrder(u: Understood): IntelligenceKind[] {
  const order: IntelligenceKind[] = [];
  const placeQuery = Boolean(u.place) && (u.kind === undefined || u.kind === "place");
  if (placeQuery) order.push("place");
  for (const k of pointed(u)) if (!order.includes(k)) order.push(k);
  if (u.place && !order.includes("place")) order.push("place");
  for (const k of INTELLIGENCE_KINDS) if (!order.includes(k)) order.push(k);
  return order;
}

export type Group = { kind: IntelligenceKind; results: IntelligenceResult[]; more?: string };

/** "All": the groups that have results, in order, each capped. */
export function rankAll(byKind: Map<IntelligenceKind, { results: IntelligenceResult[]; more?: string }>, u: Understood): Group[] {
  const groups: Group[] = [];
  const seen = new Set<string>();
  for (const kind of groupOrder(u)) {
    const page = byKind.get(kind);
    if (!page) continue;
    const results = page.results.filter((r) => !seen.has(r.key)).slice(0, GROUP_CAP[kind]);
    if (results.length === 0) continue;
    for (const r of results) seen.add(r.key);
    groups.push({ kind, results, ...(page.more ? { more: page.more } : {}) });
  }
  return groups;
}

/* ------------------------------------------------------------------ cursor */

type CursorBody = { t: IntelligenceTab; o: number; q: string };

/** An opaque page marker, tied to the tab and the words so it cannot page another search. */
export function encodeCursor(tab: IntelligenceTab, offset: number, q: string): string {
  const body: CursorBody = { t: tab, o: Math.max(0, Math.trunc(offset)), q: foldKey(q).slice(0, 60) };
  return Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
}

/** The offset a cursor names for this tab and these words, or 0. */
export function decodeCursor(cursor: string | null | undefined, tab: IntelligenceTab, q: string): number {
  if (!cursor || cursor.length > 200) return 0;
  try {
    const body = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<CursorBody>;
    if (body.t !== tab || body.q !== foldKey(q).slice(0, 60)) return 0;
    const o = Number(body.o);
    return Number.isInteger(o) && o >= 0 && o <= 1000 ? o : 0;
  } catch {
    return 0;
  }
}
