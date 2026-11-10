import { isValidElement, type ReactNode } from "react";
import type { DocChapter } from "./chapters";

/**
 * AT A GLANCE, FOR EVERY CHAPTER (the founder's pass, 10 November 2026: key
 * facts pulled to the top). Never a new sentence: a chapter may name its own
 * (`DocChapter.glance`), and otherwise the first full sentence of each of its
 * first sections is lifted as written, because the house style puts each
 * section's rule in its first sentence. `glance.test.ts` holds every line to
 * the chapter's own text, so the panel can never say more than the page.
 */
const MIN_WORDS = 6;

/**
 * The prose of a section only: what its elements hold as children. A flow's
 * steps and a table's cells live in props and are skipped, because a step
 * name run into its outcome is not a sentence.
 */
function plainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join(" ");
  if (isValidElement(node)) return plainText((node.props as { children?: ReactNode }).children);
  return "";
}
const MAX_CHARS = 200;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim());
}

export function chapterGlance(chapter: DocChapter, count = 3): string[] {
  if (chapter.glance && chapter.glance.length > 0) return chapter.glance;
  const out: string[] = [];
  for (const section of chapter.sections) {
    const first = sentences(plainText(section.body)).find(
      (s) => /[.!?]$/.test(s) && s.split(" ").length >= MIN_WORDS && s.length <= MAX_CHARS && !out.includes(s),
    );
    if (first) out.push(first);
    if (out.length === count) break;
  }
  return out;
}

/** Every word a chapter prints, flattened, for the test that holds the panel to the page. */
export function chapterText(chapter: DocChapter): string {
  return chapter.sections
    .map((section) => plainText(section.body))
    .join(" ")
    .replace(/\s+/g, " ");
}
