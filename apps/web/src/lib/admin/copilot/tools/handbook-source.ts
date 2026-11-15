import type { StaffPosition } from "@/lib/admin/staff-positions";

/**
 * THE POSITION HANDBOOK, AS THE COPILOT READS IT (16 November 2026).
 *
 * Each position has its own staff handbook, written in
 * `lib/admin/position-handbook/`, which is owned by another part of the
 * build. The copilot folds its passages into the knowledge base so
 * `search_manual` finds them and `get_my_handbook` reads the viewer's own back
 * section by section.
 *
 * IT DEGRADES. The handbook may not be built yet, and a desk must not break
 * because of it: the loader is lazy, its answer is checked against the shape
 * below before anything is used, and a missing or malformed handbook leaves
 * the knowledge base exactly as it was, with no handbooks in it. Every test
 * passes either way, because both paths are tested.
 */

/** One section of a position's handbook. */
export type PositionHandbookPassage = { id: string; title: string; text: string };

/** What `lib/admin/position-handbook` is expected to export. */
export type PositionHandbookModule = {
  positionHandbookPassages: (position: StaffPosition) => readonly PositionHandbookPassage[];
  /** Where one position's handbook is read, when the module says. */
  positionHandbookRoute?: (position: StaffPosition) => string;
  /** The handbook's own index, when it has one. Read for a title only. */
  POSITION_HANDBOOK_INDEX?: unknown;
};

/**
 * THE ONE WIRING LINE (the handbooks landed on 16 November 2026).
 *
 * It is a lazy import, so the handbooks are loaded the first time somebody
 * asks and not on every console request, and it is wrapped: if the module is
 * ever absent or broken, `loadPositionHandbook` answers null, the knowledge
 * base carries no handbooks, and every desk goes on working.
 */
async function importPositionHandbook(): Promise<unknown> {
  return import("@/lib/admin/position-handbook");
}

/** Only a module with a working `positionHandbookPassages` is used. */
export function asHandbookModule(candidate: unknown): PositionHandbookModule | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const maybe = candidate as { positionHandbookPassages?: unknown };
  return typeof maybe.positionHandbookPassages === "function" ? (candidate as PositionHandbookModule) : null;
}

let source: PositionHandbookModule | null | undefined;

/** The handbook module for a test, or null to prove the absent path. */
export function setPositionHandbookSource(handbook: PositionHandbookModule | null | undefined): void {
  source = handbook;
}

/** The handbook module, or null when there is none. Never throws. */
export async function loadPositionHandbook(): Promise<PositionHandbookModule | null> {
  if (source !== undefined) return source;
  try {
    return asHandbookModule(await importPositionHandbook());
  } catch {
    return null;
  }
}

/** One position's sections, cleaned and capped. Empty when the handbook has none. */
export function handbookSections(handbook: PositionHandbookModule | null, position: StaffPosition | null): PositionHandbookPassage[] {
  if (!handbook || !position) return [];
  let raw: unknown;
  try {
    raw = handbook.positionHandbookPassages(position);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: PositionHandbookPassage[] = [];
  for (const item of raw.slice(0, 60)) {
    if (item === null || typeof item !== "object") continue;
    const row = item as { id?: unknown; title?: unknown; text?: unknown };
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const title = typeof row.title === "string" ? row.title.replace(/\s+/g, " ").trim() : "";
    const text = typeof row.text === "string" ? row.text.replace(/\s+/g, " ").trim() : "";
    if (!id || !title || !text) continue;
    out.push({ id, title, text });
  }
  return out;
}

/** Where this position's handbook is read: the module's own route, or the index page. */
export function handbookRoute(handbook: PositionHandbookModule | null, position: StaffPosition | null): string {
  if (!handbook || !position || typeof handbook.positionHandbookRoute !== "function") return "/admin/handbook/position";
  try {
    const route = handbook.positionHandbookRoute(position);
    return typeof route === "string" && route.startsWith("/admin/handbook/position") ? route : "/admin/handbook/position";
  } catch {
    return "/admin/handbook/position";
  }
}
