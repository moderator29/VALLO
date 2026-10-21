import type { BrandIconName } from "@/design-system/icons/BrandIcon";

/**
 * The docs navigation, with no chapter text in it.
 *
 * The chapter rail (`DocsSidebar`) is a client component, and a client module
 * carries everything it imports into the browser. When it imported
 * `chaptersByGroup` from `./chapters`, it carried every chapter's paragraphs
 * with it, and through `chapters-more.tsx` the whole `@vallo/i18n` dictionary
 * and zod: /docs and every chapter shipped about 840 KB of gzipped script on
 * first load, 499 KB of it the dictionary (measured on the production build's
 * `route-bundle-stats.json`, 17 October 2026). The groups, the index type and
 * the grouping helper live here so the rail can import them alone.
 * `chapters.tsx` re-exports all of them, so server callers are unchanged.
 */

/** The groups the chapters sit in, in reading order. */
export const DOC_GROUPS = [
  { id: "start", label: "Start here" },
  { id: "renting", label: "Renting and buying" },
  { id: "stays", label: "Stays and restaurants" },
  { id: "money", label: "Money" },
  { id: "listing", label: "Listing and hosting" },
  { id: "tools", label: "Messages and tools" },
  { id: "trust", label: "Trust and privacy" },
] as const;

export type DocGroupId = (typeof DOC_GROUPS)[number]["id"];

/**
 * The navigation shape: plain data, no React elements.
 *
 * This is what crosses into the client sidebar, as props. Importing `CHAPTERS`
 * itself from a client component would pull every paragraph of the whole
 * document into the browser bundle.
 */
export type DocChapterIndexEntry = {
  slug: string;
  number: number;
  title: string;
  summary: string;
  icon: BrandIconName;
  group: DocGroupId;
};

/** The groups with their chapters, in reading order, for the index and the sidebar. */
export function chaptersByGroup<T extends { group: DocGroupId }>(
  items: readonly T[],
): { id: DocGroupId; label: string; items: T[] }[] {
  return DOC_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}
