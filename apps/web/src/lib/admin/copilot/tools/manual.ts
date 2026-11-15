import { z } from "zod";
import { STAFF_SCOPES } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS } from "@/lib/admin/staff-positions";
import { handbookSections, loadPositionHandbook } from "./handbook-source";
import { buildPassages, searchPassages, visiblePassages, type ExtraSources, type ManualPassage } from "./manual-search";
import { buildPlaybook, PLAYBOOKS } from "./playbooks";
import { clip } from "./common";
import { defineTool, type ToolLink } from "./types";

/**
 * SEARCH THE STAFF MANUAL AND THE JOB DESCRIPTIONS, and build playbooks.
 * How-to questions are answered from what staff actually read, not from
 * memory. The index is built once from `MANUAL_CHAPTERS` (through the manual's
 * own bodies, so a chapter added there is picked up with no change here), the
 * position job descriptions, the public docs chapters, the help articles and
 * the money and cancellation constants.
 */

let cache: ManualPassage[] | null = null;

async function moneyFacts(): Promise<NonNullable<ExtraSources["facts"]>> {
  const money = await import("@/lib/money/copy");
  const cancel = await import("@/lib/trust/cancellation");
  const facts: { title: string; text: string; link: string }[] = [
    { title: "Where a refund goes", text: money.REFUND_ROUTE, link: "/cancellations" },
    { title: "What renters and guests pay", text: money.NO_RENTER_FEES_LINE, link: "/terms#listing" },
    { title: "Inspection fees", text: money.NO_INSPECTION_FEE, link: "/docs" },
    { title: "Where money moves", text: money.NO_CUSTODY_SENTENCE, link: "/docs" },
    { title: "Which law governs", text: money.GOVERNING_SENTENCE, link: "/terms" },
  ];
  for (const stop of cancel.CANCELLATION_STOPS) facts.push({ title: `Cancellation: ${stop.label}`, text: stop.detail, link: "/cancellations" });
  return facts.filter((f) => typeof f.text === "string" && f.text.length > 0);
}

/**
 * The position handbooks, when they are built. Absent handbooks are simply not
 * in the index: nothing here throws and no desk waits on them.
 */
export async function handbookSources(): Promise<NonNullable<ExtraSources["handbooks"]>> {
  const module = await loadPositionHandbook();
  if (!module) return [];
  const out: NonNullable<ExtraSources["handbooks"]>[number][] = [];
  for (const position of STAFF_POSITIONS) {
    const sections = handbookSections(module, position);
    if (sections.length === 0) continue;
    out.push({ position, title: JOB_DESCRIPTIONS[position].title, link: "/admin/handbook/position", sections });
  }
  return out;
}

export async function manualPassages(): Promise<ManualPassage[]> {
  if (cache) return cache;
  const [{ MANUAL_BODIES }, { CHAPTERS }, { FAQS }] = await Promise.all([
    import("@/app/admin/manual/_chapters"),
    import("@/app/(site)/docs/chapters"),
    import("@/lib/support/help-articles"),
  ]);
  cache = buildPassages(MANUAL_BODIES, { docs: CHAPTERS, faqs: FAQS, facts: await moneyFacts(), handbooks: await handbookSources() });
  return cache;
}

/** Drops the index, so a test (or the handbook landing) is read afresh. */
export function forgetManualIndex(): void {
  cache = null;
}

export const searchManual = defineTool({
  name: "search_manual",
  description:
    "Search the staff manual, the position job descriptions, the public docs, the help articles and the money and refund facts for how to do something, who decides what, or where to escalate. Returns the best matching passages with the chapter link. Call it for every how-to or 'am I allowed' question before answering, and cite the chapter.",
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Searching the staff manual",
  input: z.object({ query: z.string().min(2).max(200) }),
  handler: async (input, ctx) => {
    const hits = searchPassages(input.query, visiblePassages(await manualPassages(), ctx.viewer), 5, { position: ctx.viewer.position });
    if (hits.length === 0) return { ok: true, data: { matches: [], note: "Nothing in the manual matched. Say so, and point to /admin/manual or their lead." } };
    const links: ToolLink[] = [{ label: "Open the staff manual", href: "/admin/manual" }];
    if (hits.some((h) => h.source === "handbook")) links.push({ label: "Read your handbook", href: "/admin/handbook/position" });
    return {
      ok: true,
      data: { matches: hits.map((h) => ({ source: h.source, chapter: h.title, section: h.heading, passage: clip(h.text, 700), link: h.link })), page: "/admin/manual" },
      links,
    };
  },
});

export const getPlaybook = defineTool({
  name: "get_playbook",
  description: `Get the step by step procedure for a named task, built from the staff manual with the real desk link. Tasks: ${PLAYBOOKS.map((p) => p.title.toLowerCase()).join("; ")}. Use it when someone asks how to do one of these, then cite the chapter and offer to open the desk or draft the next step.`,
  kind: "read",
  scopes: STAFF_SCOPES,
  status: "Building the steps from the manual",
  input: z.object({ task: z.string().min(2).max(120) }),
  handler: async (input, ctx) => {
    const answer = buildPlaybook(input.task, await manualPassages(), ctx.viewer);
    if (!answer.ok) return { ok: true, data: answer };
    return {
      ok: true,
      data: { ...answer, steps: answer.steps.map((s, i) => `${i + 1}. ${clip(s, 400)}`) },
      links: [{ label: `Open ${answer.desk.name}`, href: answer.desk.href }],
    };
  },
});

export const MANUAL_TOOLS = [searchManual, getPlaybook];
