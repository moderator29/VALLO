import { describe, expect, it } from "vitest";
import { CHAPTERS } from "./chapters";
import { chapterGlance, chapterText } from "./glance";

/** The "At a glance" panel never says more than its chapter. */
describe("every chapter's at a glance", () => {
  it.each(CHAPTERS.map((c) => [c.slug, c] as const))("%s: lifts its lines from its own text", (_slug, chapter) => {
    const lines = chapterGlance(chapter);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const text = chapterText(chapter);
    for (const line of lines) expect(text, line).toContain(line);
  });
});
