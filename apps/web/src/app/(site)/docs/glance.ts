import { textOf } from "@/lib/support/search-entries";
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
    const first = sentences(textOf(section.body)).find(
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
    .map((section) => textOf(section.body))
    .join(" ")
    .replace(/\s+/g, " ");
}
