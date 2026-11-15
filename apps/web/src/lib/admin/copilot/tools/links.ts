import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { isConsolePath, MAX_DESTINATIONS, type Destination } from "../destinations";
import { holdsAny } from "./common";
import type { CopilotViewer, ToolLink } from "./types";

/**
 * THE LINK FILTER (16 November 2026).
 *
 * A tool may hand back the desks its answer is about. Every one of them is
 * checked here, on the server, BEFORE the model is shown the result: the same
 * rule `isOfferable` applies to a tool is applied to a link, so a destination
 * the viewer may not open is dropped rather than merely left unsaid. The model
 * cannot offer what it was never given, and the renderer draws a button only
 * for an address that survived this filter (`destinations.ts`).
 *
 * Pure. No reads, no server imports.
 */

/** The COO door, as the COO desk itself draws it: a super admin or the whole bundle. */
export function holdsCooBundle(viewer: CopilotViewer): boolean {
  return viewer.isSuperAdmin || JOB_DESCRIPTIONS.coo.scopes.every((scope) => viewer.scopes.includes(scope));
}

/** The same test `isOfferable` makes of a tool, made of one link. */
export function isLinkOfferable(link: ToolLink, viewer: CopilotViewer): boolean {
  if (!isConsolePath(link.href)) return false;
  if (link.label.trim().length === 0) return false;
  if (link.requires === "super_admin" && !viewer.isSuperAdmin) return false;
  if (link.requires === "admin" && !(viewer.isAdmin || viewer.isSuperAdmin)) return false;
  if (link.requires === "coo" && !holdsCooBundle(viewer)) return false;
  if (!link.scope) return true;
  return holdsAny(viewer, [link.scope]);
}

/**
 * The destinations this viewer may be offered: the ones they can open, in the
 * order the tool gave them, one per address, capped so an answer offers a
 * handful of buttons and not a menu.
 */
export function offerableLinks(
  links: readonly ToolLink[] | undefined,
  viewer: CopilotViewer,
  limit = MAX_DESTINATIONS,
): Destination[] {
  if (!links || links.length === 0) return [];
  const out: Destination[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (out.length >= limit) break;
    if (!isLinkOfferable(link, viewer)) continue;
    const href = link.href.trim();
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ label: link.label.replace(/\s+/g, " ").trim(), href });
  }
  return out;
}
