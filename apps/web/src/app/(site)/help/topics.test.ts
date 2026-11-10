import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQS } from "@/lib/support/help-articles";
import { HELP_ANCHORS, questionAlias, topicAliases, topicId } from "./topics";

/**
 * EVERY /help# LINK LANDS (DOCS_AND_PRESENCE_UPGRADE.md 8). The search
 * sheet's popular topics, and links from inside the product, point at short
 * anchors on the help centre. Each must be an alias here, and each alias must
 * point at a topic or a question the help centre still prints, or the link
 * scrolls nowhere. Read from the sheet's source because it is a client module.
 */
const SRC = join(process.cwd(), "src");

describe("the help centre's anchors", () => {
  const categories = new Set(FAQS.map((f) => f.category));
  const questions = new Set(FAQS.map((f) => f.q));

  it("points every short anchor at a topic or an answer that exists", () => {
    for (const [alias, target] of Object.entries(HELP_ANCHORS)) {
      if ("category" in target) expect(categories.has(target.category), alias).toBe(true);
      else expect(questions.has(target.question), alias).toBe(true);
    }
  });

  it("gives each answer and each topic at most one alias, and never an id a topic already uses", () => {
    const topicIds = new Set([...categories].map(topicId));
    for (const alias of Object.keys(HELP_ANCHORS)) expect(topicIds.has(alias), alias).toBe(false);
    const counted = [...categories].flatMap(topicAliases).length + FAQS.filter((f) => questionAlias(f.q)).length;
    expect(counted).toBe(Object.keys(HELP_ANCHORS).length);
  });

  it("resolves every /help# link the search sheet and the product make", () => {
    const files = ["components/docs/popular-topics.ts"];
    const anchors = files.flatMap((file) =>
      [...readFileSync(join(SRC, file), "utf8").matchAll(/"\/help#([a-z0-9-]+)"/g)].map((m) => m[1] ?? ""),
    );
    expect(anchors.length).toBeGreaterThan(0);
    const topicIds = new Set([...categories].map(topicId));
    for (const anchor of anchors) expect(anchor in HELP_ANCHORS || topicIds.has(anchor), anchor).toBe(true);
  });
});
