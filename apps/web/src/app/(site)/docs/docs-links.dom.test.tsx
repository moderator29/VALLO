import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";
import { CHAPTERS, CHAPTER_INDEX, DOC_GROUPS } from "./chapters";

/**
 * NO DEAD LINK INTO THE DOCS (the docs track, 13 October 2026).
 *
 * `static-hrefs.test.ts` resolves `/docs/anything` to the `[slug]` route, so a
 * link to a chapter that was renamed or retired passed it and gave a reader a
 * 404. This holds the docs to their own register:
 *
 *   - every `/docs/<slug>` written anywhere in `src` is a live chapter or a
 *     redirect in `next.config.ts`, and every `#anchor` on a live chapter is
 *     one of its section ids;
 *   - every retired chapter has a redirect, and every docs redirect lands on
 *     a live chapter;
 *   - slugs and section ids are unique, and every chapter sits in a group.
 */
const SRC = join(process.cwd(), "src");
const CONFIG = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

/** Retired chapters, kept here so a redirect cannot be dropped by accident. */
const RETIRED = ["your-wallet", "money-and-the-guarantee", "booking-and-paying"] as const;

const live = new Map(CHAPTERS.map((chapter) => [chapter.slug, new Set(chapter.sections.map((s) => s.id))]));

/* Static docs pages beside the chapters (a folder with its own page.tsx,
   such as /docs/how-protection-works): live too, and an anchor on one is
   live when the page's own source names that id. */
const DOCS_DIR = join(SRC, "app", "(site)", "docs");
const staticPages = new Map(
  readdirSync(DOCS_DIR)
    .filter((name) => /^[a-z0-9-]+$/.test(name) && statSync(join(DOCS_DIR, name)).isDirectory())
    .flatMap((name) => {
      try {
        return [[name, readFileSync(join(DOCS_DIR, name, "page.tsx"), "utf8")] as const];
      } catch {
        return [];
      }
    }),
);

const redirects = new Map(
  [...CONFIG.matchAll(/source:\s*"\/docs\/([a-z0-9-]+)",\s*destination:\s*"\/docs\/([a-z0-9-]+)"/g)].map((m) => [
    m[1] ?? "",
    m[2] ?? "",
  ]),
);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("the docs register", () => {
  it("has unique slugs, unique section ids and a group for every chapter", () => {
    expect(new Set(CHAPTERS.map((c) => c.slug)).size).toBe(CHAPTERS.length);
    const groups = new Set(DOC_GROUPS.map((g) => g.id));
    for (const chapter of CHAPTERS) {
      const ids = chapter.sections.map((s) => s.id);
      expect(new Set(ids).size, chapter.slug).toBe(ids.length);
      expect(groups.has(chapter.group ?? "missing" as never), chapter.slug).toBe(true);
    }
    expect(CHAPTER_INDEX.map((c) => c.number)).toEqual(CHAPTERS.map((_, i) => i + 1));
  });

  it.each(RETIRED)("redirects the retired chapter %s to a live chapter", (slug) => {
    expect(live.has(slug)).toBe(false);
    const to = redirects.get(slug);
    expect(to, slug).toBeDefined();
    expect(live.has(to ?? "")).toBe(true);
  });

  it("sends every docs redirect to a live chapter, never to another redirect", () => {
    expect(redirects.size).toBeGreaterThanOrEqual(RETIRED.length);
    for (const [from, to] of redirects) {
      expect(live.has(from), `${from} is a live chapter and a redirect`).toBe(false);
      expect(live.has(to), `${from} -> ${to}`).toBe(true);
    }
  });

  it("has no link to a chapter or a heading that does not exist", () => {
    const dead: string[] = [];
    let seen = 0;
    for (const file of walk(SRC)) {
      /* Comments may name an address as history; only code is a link. */
      const text = withoutComments(readFileSync(file, "utf8"));
      for (const m of text.matchAll(/["'`(]\/docs\/([a-z0-9-]+)(?:#([a-z0-9-]+))?/g)) {
        seen += 1;
        const slug = m[1] ?? "";
        const anchor = m[2];
        const at = `${relative(SRC, file)}: /docs/${slug}${anchor ? `#${anchor}` : ""}`;
        const sections = live.get(slug);
        const page = staticPages.get(slug);
        if (page !== undefined) {
          if (anchor && !page.includes(`"${anchor}"`)) dead.push(`${at} (no such heading)`);
        } else if (sections) {
          if (anchor && !sections.has(anchor)) dead.push(`${at} (no such heading)`);
        } else if (!redirects.has(slug)) {
          dead.push(`${at} (no such chapter)`);
        }
      }
    }
    expect(seen).toBeGreaterThan(20);
    expect(dead).toEqual([]);
  });
});
