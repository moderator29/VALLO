import { describe, expect, it } from "vitest";
import { unbackedClaim } from "@/lib/trust/claims";
import { GUIDES, GUIDE_CATEGORIES, blockText, guideBySlug, readingMinutes } from "./articles";
import { GUIDE_SLUGS } from "./slugs";

const EVERY_TEXT = (slug: string) => {
  const guide = guideBySlug(slug);
  if (!guide) return [];
  return [
    guide.title,
    guide.description,
    ...(guide.beforeYouStart ?? []),
    ...guide.sections.flatMap((s) => [s.title, ...s.blocks.flatMap(blockText)]),
  ];
};

describe("A14 guides", () => {
  it("publishes exactly the slugs the sitemap names, once each", () => {
    expect(GUIDES.map((g) => g.slug).sort()).toEqual([...GUIDE_SLUGS].sort());
  });

  it("carries a review date and a reading time on every guide", () => {
    for (const guide of GUIDES) {
      expect(guide.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(readingMinutes(guide)).toBeGreaterThanOrEqual(1);
      expect(guide.sections.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("prints no unbacked claim, no em dash and no invented statistic", () => {
    for (const slug of GUIDE_SLUGS) {
      for (const text of EVERY_TEXT(slug)) {
        expect(unbackedClaim(text), `${slug}: ${text}`).toBeNull();
        expect(text).not.toContain("—");
        /* A percentage may appear only as the cited rule's maximum. */
        const percents = text.match(/\d+(\.\d+)?%/g) ?? [];
        if (percents.length > 0) expect(text, `${slug}: a percent outside the cited rule`).toMatch(/Tenancy Law/);
      }
    }
  });

  it("pulls every pull-quote from the guide's own paragraphs, so it is never a new claim", () => {
    for (const guide of GUIDES) {
      const blocks = guide.sections.flatMap((section) => section.blocks);
      const prose = blocks
        .filter((block) => typeof block === "string" || !("quote" in block))
        .flatMap(blockText)
        .join(" ")
        .toLowerCase();
      for (const block of blocks) {
        if (typeof block === "object" && "quote" in block) expect(prose, `${guide.slug}: ${block.quote}`).toContain(block.quote.toLowerCase());
      }
    }
  });

  it("leads the index with exactly one featured guide, and fills every category chip", () => {
    expect(GUIDES.filter((g) => g.featured)).toHaveLength(1);
    for (const category of GUIDE_CATEGORIES) expect(GUIDES.some((g) => g.category === category.id), category.id).toBe(true);
  });

  it("gives every screen in a guide words for somebody who cannot see it", () => {
    for (const guide of GUIDES) {
      for (const shot of [guide.cover, ...guide.sections.map((s) => s.shot)]) {
        if (!shot) continue;
        expect(shot.alt.length, guide.slug).toBeGreaterThan(20);
        expect(unbackedClaim(shot.alt), shot.alt).toBeNull();
        expect(shot.dark).toMatch(/^\/help\/shots\/[a-z0-9-]+\.webp$/);
        expect(shot.light).toMatch(/^\/help\/shots\/[a-z0-9-]+\.webp$/);
      }
    }
  });

  it("sends every guide somewhere real and public", () => {
    for (const guide of GUIDES) expect(guide.next.href.startsWith("/")).toBe(true);
  });
});
