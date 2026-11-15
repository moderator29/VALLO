import { z } from "zod";
import { STAFF_SCOPES, STAFF_SCOPE_LABEL } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { clip } from "./common";
import { handbookRoute, handbookSections, loadPositionHandbook } from "./handbook-source";
import { defineTool } from "./types";

/**
 * YOUR OWN HANDBOOK (16 November 2026). The handbook for the position the
 * viewer actually holds, section by section, with the link to read or save it.
 * Open to every member of staff; a person is only ever read their own.
 *
 * When `lib/admin/position-handbook` is not built yet, this falls back to the
 * job description the console already carries (what the position is, what it
 * is responsible for, what is expected, where to take what they cannot
 * decide), says plainly that the full handbook is not in place, and offers the
 * same page. It never invents a section.
 */

const INDEX = "/admin/handbook/position";
const HANDBOOK = "/admin/handbook";

export const getMyHandbook = defineTool({
  name: "get_my_handbook",
  description:
    "The viewer's OWN position handbook, section by section, with the link to read or save it. Use it for 'what does my handbook say', 'what am I responsible for', 'what am I allowed to decide', 'what is expected of me' and 'where do I take this'. It is their own position only; it never reads out somebody else's handbook.",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Reading your handbook",
  input: z.object({ section: z.string().max(120).optional() }),
  handler: async (input, ctx) => {
    const position = ctx.viewer.position;
    const job = position ? JOB_DESCRIPTIONS[position] : null;
    const handbook = await loadPositionHandbook();
    const sections = handbookSections(handbook, position);
    /* The module's own route for this position, or the index page when the
       handbooks are not built. A link is never guessed. */
    const PAGE = position ? handbookRoute(handbook, position) : INDEX;
    const asked = (input.section ?? "").trim().toLowerCase();
    const picked = asked.length >= 3 ? sections.filter((s) => `${s.title} ${s.text}`.toLowerCase().includes(asked)) : sections;
    const shown = (picked.length > 0 ? picked : sections).slice(0, 12);
    const links = [
      { label: "Read your handbook", href: PAGE },
      { label: "Open the staff handbook", href: HANDBOOK },
    ];

    if (!position) {
      return {
        ok: true,
        data: {
          position: null,
          handbookBuilt: sections.length > 0,
          note: "This person holds no named position, so there is no position handbook for them. The staff handbook every member of staff acknowledges is at /admin/handbook. Say that, and do not invent a handbook.",
          accessAreas: ctx.viewer.scopes.map((s) => STAFF_SCOPE_LABEL[s]),
        },
        links,
      };
    }

    if (sections.length === 0) {
      return {
        ok: true,
        data: {
          position: job?.title ?? position,
          handbookBuilt: false,
          note: "The written handbook for this position is not in place on this server yet. Answer from the job description below, say that the full handbook is not in place, and offer the page. Do not invent a section.",
          jobDescription: job
            ? {
                summary: job.summary,
                reportsTo: job.reportsTo,
                responsibilities: job.responsibilities,
                expectations: job.expectations,
                whereToTakeWhatYouCannotDecide: job.escalate,
                accessAreas: job.scopes.map((s) => STAFF_SCOPE_LABEL[s]),
              }
            : null,
          page: PAGE,
        },
        links,
      };
    }

    return {
      ok: true,
      data: {
        position: job?.title ?? position,
        handbookBuilt: true,
        sectionCount: sections.length,
        askedFor: asked.length >= 3 ? input.section : null,
        matched: asked.length >= 3 ? picked.length : null,
        sections: shown.map((s) => ({ section: s.title, says: clip(s.text, 900), link: `${PAGE}#${s.id}` })),
        more: sections.length > shown.length,
        page: PAGE,
      },
      links,
      note: "This is their own handbook. Lead with the part that answers the question, quote it in plain words, name the section, then offer the page.",
    };
  },
});

export const HANDBOOK_TOOLS = [getMyHandbook];
