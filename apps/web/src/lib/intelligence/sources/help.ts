import "server-only";

import { findScreens } from "@/lib/assistant/tools/find-screen";
import { prepare, searchPrepared, SECTION_LABEL, type PreparedEntry } from "@/lib/support/search";
import { buildSupportEntries } from "@/lib/support/search-entries";
import type { IntelligenceResult } from "../contract";
import { compact } from "./format";
import type { Source, SourceContext } from "./types";

/**
 * SCREENS AND HELP.
 *
 * Screens come from the app's own route registry through the assistant's
 * `findScreens` (AI-05): only screens `route-parents.ts` declares and
 * `route-labels.ts` names, never a path with a hole in it, never `/admin`,
 * and only the member frame. Nothing here writes a path.
 *
 * Help comes from the one support index (`lib/support/search-entries.ts`):
 * every Help answer, Docs chapter and section, Guide and legal page, the same
 * entries the Help and Docs search boxes run on, so a corrected answer is
 * corrected here too.
 */

const EXTRA_WORDS: Readonly<Record<string, string>> = {
  /* What people say for the screens whose names do not say it. */
  "make an offer": "offers",
  "list a property": "listing",
  "list my property": "listing",
};

function screenWords(ctx: SourceContext): string {
  let words = ctx.words;
  for (const [phrase, also] of Object.entries(EXTRA_WORDS)) {
    if (words.toLowerCase().includes(phrase)) words = `${words} ${also}`;
  }
  return words;
}

function sentence(label: string): string {
  const bare = label.replace(/^(?:the|your)\s+/i, "");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

export const screenSource: Source = {
  kind: "screen",
  applies: ({ understood }) => ["screen", "guide", "personal"].includes(understood.kind ?? "") || understood.kind === undefined,
  async run(ctx) {
    const screens = findScreens(screenWords(ctx), "consumer");
    const results: IntelligenceResult[] = screens.map((s) =>
      compact({
        key: `screen:${s.href}`,
        kind: "screen",
        title: sentence(s.label),
        href: s.href,
        subtitle: "Vallo screen",
        actions: [{ id: "open", label: "Open", href: s.href }],
      }),
    );
    return { results: results.slice(ctx.offset, ctx.offset + ctx.limit), total: results.length };
  },
};

let INDEX: PreparedEntry[] | null = null;
function index(): PreparedEntry[] {
  if (!INDEX) INDEX = prepare(buildSupportEntries());
  return INDEX;
}

export const guideSource: Source = {
  kind: "guide",
  applies: ({ understood }) => ["guide", "screen"].includes(understood.kind ?? "") || understood.kind === undefined || understood.kind === "property",
  async run(ctx) {
    const hits = searchPrepared(index(), screenWords(ctx), 40);
    const results: IntelligenceResult[] = hits.map((hit) =>
      compact({
        key: `guide:${hit.entry.id}`,
        kind: "guide",
        title: hit.entry.title,
        href: hit.entry.href,
        subtitle: `${SECTION_LABEL[hit.entry.section]} · ${hit.entry.trail}`,
        actions: [{ id: "open", label: "Read", href: hit.entry.href }],
      }),
    );
    return {
      results: results.slice(ctx.offset, ctx.offset + ctx.limit),
      total: results.length,
      more: `/help?q=${encodeURIComponent(ctx.words.slice(0, 80))}`,
    };
  },
};
