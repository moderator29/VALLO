import { z } from "zod";
import { STAFF_SCOPES } from "@/lib/admin/guard";
import { canOpenDesk, deskLink, findDesks, myDesks, type DeskEntry } from "../desk-map";
import { defineTool, type ToolLink } from "./types";

/**
 * WHERE DO I GO (16 November 2026). "Where do I do X" answered from the
 * console's own menu: the desk map is read from `nav.ts`, so the answer cannot
 * name a desk the rail does not have or an address it does not use.
 *
 * It only ever answers with desks THIS person can open, and it hands each one
 * back as a destination, so the answer carries a button rather than a path to
 * copy. Nothing is read from the database here: it is the map, not the work.
 */

/*
 * HOW MANY DESKS THE WHOLE-LIST ANSWER NAMES.
 *
 * It was 12, and 12 is fewer than the desks a scoped staff member holds: a
 * support agent holds 19, so the list was cut in the rail's order and their
 * own Support desk fell off the end. The answer then named eleven desks they
 * rarely touch and not the one they live in. The widest staff grant is inside
 * this number, so a staff member is shown all of theirs; an admin holds every
 * desk and is shown a sample with the true count beside it (`deskCount`),
 * which is what the count is for.
 */
const MAX_LIST = 24;

const row = (entry: DeskEntry) => ({ desk: entry.label, where: entry.href, section: entry.group, forWhat: entry.purpose });

export const whereDoIGo = defineTool({
  name: "where_do_i_go",
  description:
    "Find the desk for a piece of work from the console's own menu. Give a few words of what the person wants to do ('approve a listing', 'a member cannot sign in', 'what SQL still has to run') and it returns the matching desks THEY can open, what each is for, and the link. Call it whenever somebody asks where something is done, where a screen is, or what a desk is for. With no words it lists every desk they can open.",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Reading the console map",
  input: z.object({ doing: z.string().max(200).optional() }),
  handler: async (input, ctx) => {
    const asked = (input.doing ?? "").trim();
    const mine = myDesks(ctx.viewer);
    if (asked.length < 3) {
      const links = mine.slice(0, 5).map(deskLink).filter((l): l is ToolLink => l !== null);
      return {
        ok: true,
        data: {
          matched: null,
          note: "No particular job was named, so this is the whole list of desks this person can open.",
          deskCount: mine.length,
          desks: mine.slice(0, MAX_LIST).map(row),
          more: mine.length > MAX_LIST,
        },
        links,
        note: "Ask what they are trying to do, then name the one or two desks that fit.",
      };
    }
    const hits = findDesks(asked, ctx.viewer);
    if (hits.length === 0) {
      return {
        ok: true,
        data: {
          matched: [],
          deskCount: mine.length,
          desks: mine.slice(0, MAX_LIST).map(row),
          note: "No desk on this person's rail matches those words. Say so plainly, offer the closest desks from this list, and point to the staff manual or their lead rather than guessing an address.",
        },
        links: mine.slice(0, 3).map(deskLink).filter((l): l is ToolLink => l !== null),
      };
    }
    return {
      ok: true,
      data: { matched: hits.map(row), bestFirst: true },
      links: hits.map(deskLink).filter((l): l is ToolLink => l !== null),
      note: "Lead with the one desk that fits, say in one line what it is for, then offer it as a destination. A desk this person cannot open is not in this list, so do not name one from memory.",
    };
  },
});

/** Whether a desk is on this viewer's rail at all, for the tools that offer one. */
export function deskOpenTo(entry: DeskEntry, viewer: Parameters<typeof canOpenDesk>[1]): boolean {
  return canOpenDesk(entry, viewer);
}

export const WAYFINDING_TOOLS = [whereDoIGo];
