import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";
import { FAQS } from "@/lib/support/help-articles";
import { GUIDES } from "@/lib/guides/articles";
import { GUIDE_SLUGS } from "@/lib/guides/slugs";
import { HELP_ANCHORS, topicId } from "./help/topics";

/**
 * EVERY LINK INTO THE WRITTEN SURFACE LANDS (the founder's pass, 10 November
 * 2026: "every link must resolve"). Anywhere in `src`, a literal address to
 * the help centre or a guide, with or without a section, must name a page
 * that exists and an anchor that page draws:
 *
 *   /help#<anchor>             a topic's id or one of HELP_ANCHORS
 *   /guides/<slug>[#<section>] a published guide, and one of its section ids
 *
 * The docs chapters' anchors are `docs/docs-links.dom.test.tsx`'s, and the
 * routes themselves `app/static-hrefs.test.ts`'s.
 */
const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const helpAnchors = new Set([...Object.keys(HELP_ANCHORS), ...new Set(FAQS.map((f) => topicId(f.category)))]);
const guideSections = new Map(GUIDES.map((g) => [g.slug as string, new Set(g.sections.map((s) => s.id))]));

describe("links into the help centre and the guides", () => {
  const found: { at: string; href: string }[] = [];
  for (const file of walk(SRC)) {
    const text = withoutComments(readFileSync(file, "utf8"));
    for (const m of text.matchAll(/["'`](\/(?:help|guides)(?:\/[a-z0-9-]+)?(?:#[a-z0-9-]+)?)["'`]/g)) {
      found.push({ at: relative(SRC, file), href: m[1] ?? "" });
    }
  }

  it("finds the links it checks", () => {
    expect(found.length).toBeGreaterThan(10);
  });

  it("lands every /help# link on a topic or a short anchor", () => {
    const bad = found.filter((f) => f.href.startsWith("/help#") && !helpAnchors.has(f.href.slice(6)));
    expect(bad).toEqual([]);
  });

  it("lands every /guides link on a published guide and a section it has", () => {
    const bad = found.filter(({ href }) => {
      const m = href.match(/^\/guides\/([a-z0-9-]+)(?:#([a-z0-9-]+))?$/);
      if (!m) return false;
      const [, slug, anchor] = m;
      if (!(GUIDE_SLUGS as readonly string[]).includes(slug ?? "")) return true;
      return anchor !== undefined && !guideSections.get(slug ?? "")?.has(anchor);
    });
    expect(bad).toEqual([]);
  });
});
