import { z } from "zod";
import { STAFF_SCOPES } from "@/lib/admin/guard";
import { buildPassages, searchPassages, type ManualPassage } from "./manual-search";
import { clip } from "./common";
import { defineTool } from "./types";

/**
 * SEARCH THE STAFF MANUAL AND THE JOB DESCRIPTIONS. How-to questions are
 * answered from the chapters staff actually read (`/admin/manual`), not from
 * memory. The chapters load on first use, once, and the best passages come
 * back with the chapter link.
 */

let cache: ManualPassage[] | null = null;

async function passages(): Promise<ManualPassage[]> {
  if (cache) return cache;
  const { MANUAL_BODIES } = await import("@/app/admin/manual/_chapters");
  cache = buildPassages(MANUAL_BODIES);
  return cache;
}

export const searchManual = defineTool({
  name: "search_manual",
  description:
    "Search the staff manual chapters and the position job descriptions for how to do something, who decides what, or where to escalate. Returns the best matching passages with the chapter link. Use it for every how-to or 'am I allowed' question instead of answering from memory.",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Searching the staff manual",
  input: z.object({ query: z.string().min(2).max(200) }),
  handler: async (input) => {
    const hits = searchPassages(input.query, await passages());
    if (hits.length === 0) return { ok: true, data: { matches: [], note: "Nothing in the manual matched. Say so, and point to /admin/manual or their lead." } };
    return { ok: true, data: { matches: hits.map((h) => ({ source: h.source, chapter: h.title, section: h.heading, passage: clip(h.text, 700), link: h.link })), page: "/admin/manual" } };
  },
});

export const MANUAL_TOOLS = [searchManual];
