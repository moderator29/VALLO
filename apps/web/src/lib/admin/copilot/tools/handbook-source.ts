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
  /** The handbook's own index, when it has one. Read for a title only. */
  POSITION_HANDBOOK_INDEX?: unknown;
};

/**
 * THE ONE WIRING LINE. While `lib/admin/position-handbook` does not exist,
 * naming it here would stop the build and fail every test, so it is not named
 * here: this returns nothing and the knowledge base carries no handbooks. The
 * day the module lands, this body becomes
 *
 *     return (await import("@/lib/admin/position-handbook")) as unknown;
 *
 * and nothing else in the copilot changes: the passages, the scoping, the
 * ranking, `get_my_handbook` and their tests are already built around the
 * shape above, and `handbook.test.ts` proves both the present and the absent
 * path through `setPositionHandbookSource`.
 */
async function importPositionHandbook(): Promise<unknown> {
  return null;
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
