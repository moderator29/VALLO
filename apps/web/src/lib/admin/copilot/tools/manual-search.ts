import { isValidElement, type ReactNode } from "react";
import { MANUAL_CHAPTERS } from "@/lib/admin/manual/chapters";
import type { StaffScope } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS } from "@/lib/admin/staff-positions";

/** Pure passage building and ranking for search_manual; no server imports, so it can be tested alone. */

export type ManualPassage = {
  source: "manual" | "position" | "docs" | "help" | "money";
  title: string;
  heading: string;
  text: string;
  link: string;
  /** Present when the passage belongs to one desk: only a viewer holding one of these scopes (or an admin) is shown its text. */
  scopes?: readonly StaffScope[];
};

/**
 * WHICH MANUAL SECTIONS BELONG TO ONE DESK. The manual itself is open to all
 * staff (every chapter is readable at /admin/manual), so this is the copilot's
 * own, conservative rule: it does not read out the step by step of a desk the
 * person has no access area for, and points to the lead instead. Keyed by
 * chapter slug and section id.
 */
export const SECTION_SCOPES: Readonly<Record<string, readonly StaffScope[]>> = {
  "queues#identity": ["kyc_review"],
  "queues#refunds": ["finance", "support"],
};

/** What the viewer may be shown. Admins and super admins see everything. */
export function visiblePassages(passages: readonly ManualPassage[], viewer: { isAdmin: boolean; isSuperAdmin: boolean; scopes: readonly StaffScope[] }): ManualPassage[] {
  if (viewer.isAdmin || viewer.isSuperAdmin) return [...passages];
  return passages.filter((p) => !p.scopes || p.scopes.some((s) => viewer.scopes.includes(s)));
}

/** The text sources beyond the staff manual, handed in by the caller so this file stays server-free. */
export type ExtraSources = {
  docs?: readonly { slug: string; number: number; title: string; sections: readonly { id: string; heading: string; body: ReactNode }[] }[];
  faqs?: readonly { category: string; q: string; a: string }[];
  facts?: readonly { title: string; text: string; link: string }[];
};

const SKIP_KEYS = new Set(["id", "key", "icon", "kind", "tone", "href", "className", "role", "testId", "numeric", "ref"]);
const TEXT_PROPS = new Set(["caption", "title", "label", "note", "summary", "children"]);

/** The plain words inside a node tree. Function components are not rendered; their props are read. */
export function nodeText(node: unknown, depth = 0): string {
  if (depth > 40 || node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((n) => nodeText(n, depth + 1)).join(" ");
  if (isValidElement(node)) {
    const props = (node.props ?? {}) as Record<string, unknown>;
    return Object.entries(props)
      .filter(([key, value]) => !SKIP_KEYS.has(key) && (typeof value !== "string" || TEXT_PROPS.has(key)))
      .map(([, value]) => nodeText(value, depth + 1))
      .join(" ");
  }
  if (typeof node === "object") {
    return Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !SKIP_KEYS.has(key))
      .map(([, value]) => nodeText(value, depth + 1))
      .join(" ");
  }
  return "";
}

function scopeOf(slug: string, id: string): { scopes?: readonly StaffScope[] } {
  const scopes = SECTION_SCOPES[`${slug}#${id}`];
  return scopes ? { scopes } : {};
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/** Cut long text into windows of about `size` characters at sentence ends. */
function windows(text: string, size = 650): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let current = "";
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (current && current.length + sentence.length > size) {
      out.push(current);
      current = "";
    }
    current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) out.push(current);
  return out;
}

export type ManualBodies = Record<string, { intro: ReactNode; glance: ReactNode[]; sections: { id: string; title: string; body: ReactNode }[] }>;

export function buildPassages(bodies: ManualBodies, extra: ExtraSources = {}): ManualPassage[] {
  const out: ManualPassage[] = [];
  for (const chapter of MANUAL_CHAPTERS) {
    const body = bodies[chapter.slug];
    if (!body) continue;
    const base = `/admin/manual/${chapter.slug}`;
    const glance = squash(nodeText([body.intro, body.glance]));
    for (const w of windows(glance)) out.push({ source: "manual", title: `Chapter ${chapter.number}: ${chapter.title}`, heading: "At a glance", text: w, link: base });
    for (const section of body.sections) {
      const text = squash(nodeText(section.body));
      for (const w of windows(text)) out.push({ source: "manual", title: `Chapter ${chapter.number}: ${chapter.title}`, heading: section.title, text: w, link: `${base}#${section.id}`, ...scopeOf(chapter.slug, section.id) });
    }
  }
  for (const position of STAFF_POSITIONS) {
    const job = JOB_DESCRIPTIONS[position];
    const link = "/admin/handbook/position";
    out.push({ source: "position", title: `Job description: ${job.title}`, heading: "Summary", text: `${job.summary} Reports to ${job.reportsTo}.`, link });
    out.push({ source: "position", title: `Job description: ${job.title}`, heading: "Responsibilities", text: job.responsibilities.join(" "), link });
    out.push({ source: "position", title: `Job description: ${job.title}`, heading: "What is expected of you", text: job.expectations.join(" "), link });
    out.push({ source: "position", title: `Job description: ${job.title}`, heading: "Where to take what you cannot decide", text: job.escalate.join(" "), link });
  }
  for (const chapter of extra.docs ?? []) {
    for (const section of chapter.sections) {
      for (const w of windows(squash(nodeText(section.body)))) out.push({ source: "docs", title: `Public docs: ${chapter.title}`, heading: section.heading, text: w, link: `/docs/${chapter.slug}#${section.id}` });
    }
  }
  for (const faq of extra.faqs ?? []) out.push({ source: "help", title: `Help article: ${faq.category}`, heading: faq.q, text: faq.a, link: "/help" });
  for (const fact of extra.facts ?? []) out.push({ source: "money", title: `Money and refund facts: ${fact.title}`, heading: fact.title, text: fact.text, link: fact.link });
  return out;
}

const STOP = new Set(["the", "and", "for", "with", "how", "what", "when", "where", "who", "can", "does", "did", "that", "this", "from", "into", "are", "was", "will", "you", "your", "its", "not", "has", "have", "about", "need", "should", "which", "do", "to", "of", "in", "on", "a", "an", "is", "it", "be", "me", "my", "i"]);

export function tokens(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t)))];
}

/** Best passages for a question, strongest first. Pure over the passage list. */
export function searchPassages(query: string, passages: readonly ManualPassage[], limit = 4): (ManualPassage & { score: number })[] {
  const words = tokens(query);
  if (words.length === 0) return [];
  const scored = passages.map((p) => {
    const body = p.text.toLowerCase();
    const head = `${p.title} ${p.heading}`.toLowerCase();
    let score = 0;
    let hit = 0;
    for (const w of words) {
      const inBody = body.split(w).length - 1;
      const inHead = head.split(w).length - 1;
      if (inBody + inHead > 0) hit += 1;
      score += Math.min(inBody, 4) + inHead * 3;
    }
    if (hit > 1) score += hit * 2;
    return { ...p, score };
  });
  return scored.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

