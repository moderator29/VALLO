import type { Metadata } from "next";
import { JsonLd } from "@/components/site/JsonLd";
import { breadcrumbLd } from "@/lib/site/structured-data";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  CHAPTER_INDEX,
  DOC_GROUPS,
  DOCS_REVIEWED,
  chapterBySlug,
  chapterNeighbours,
} from "../chapters";
import "@/components/site/guides/docs-type.css";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import { DocHeader, DocSection } from "@/components/docs/DocArticle";
import { DocToc } from "@/components/docs/DocToc";
import { DocHelpPanel } from "@/components/docs/DocShell";
import { SITE_CARD } from "@/lib/site/site-card";

/**
 * One chapter.
 *
 * The slugs are known at build time, so they are generated rather than
 * rendered on demand, and anything else is a genuine 404 instead of an empty
 * page with a heading on it.
 *
 * The article, the heading rail and the prev and next links are all read from
 * the same chapter record, which is the point of keeping the document as data:
 * there is no second list of headings to fall out of step with the first.
 */

export function generateStaticParams() {
  return CHAPTER_INDEX.map((chapter) => ({ slug: chapter.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const chapter = chapterBySlug(slug);
  if (!chapter) return { title: "Documentation" };
  return {
    title: chapter.title,
    description: chapter.summary,
    /* The chapter's own words on the unfurl (it read the home page's), and
       the site's card, which a page that sets Open Graph must name. */
    openGraph: {
      type: "article",
      siteName: "Vallo",
      title: chapter.title,
      description: chapter.summary,
      images: [SITE_CARD],
    },
  };
}

export default async function DocChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chapter = chapterBySlug(slug);
  if (!chapter) notFound();

  const { previous, next } = chapterNeighbours(chapter.slug);
  const group =
    DOC_GROUPS.find((g) => g.id === chapter.group)?.label ?? "Documentation";
  /* The siblings a reader may actually want instead: the rest of its group. */
  const related = CHAPTER_INDEX.filter(
    (c) => c.group === chapter.group && c.slug !== chapter.slug
  )
    .slice(0, 2)
    .map((c) => ({ href: `/docs/${c.slug}`, label: c.title }));

  return (
    <div>
      {/* A13: where this chapter sits, for a crawler. */}
      <JsonLd
        data={breadcrumbLd([
          { name: "Vallo", path: "/" },
          { name: "Documentation", path: "/docs" },
          { name: chapter.title, path: `/docs/${chapter.slug}` },
        ])}
      />
      {/*
        ON THE KIT (DOCS_AND_PRESENCE_UPGRADE.md 2.3 and 2.4): the category
        pill (the chapter's group), the title, the date the chapter was last
        read against the product, its summary as the scope, the sibling
        chapters, then the contents card, which marks the section being read.
        The section ids are the chapter's own, unchanged, so every link to
        `/docs/<slug>#<section>` still lands; the kit anchors the whole
        section, not only its heading.
      */}
      <article className="grid gap-xl">
        <DocHeader
          category={{ icon: lineGlyphFor(chapter.icon), label: group }}
          title={chapter.title}
          updated={chapter.updated ?? DOCS_REVIEWED}
          related={related}
        >
          <p>{chapter.summary}</p>
          <p className="mt-2xs nf-numeric text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
            Chapter {chapter.number} of {CHAPTER_INDEX.length}
          </p>
        </DocHeader>

        {chapter.sections.length >= 3 ? (
          <DocToc
            sections={chapter.sections.map((section) => ({
              id: section.id,
              title: section.heading,
            }))}
          />
        ) : null}

        <div className="nf-doc-sections grid gap-xl">
          {chapter.sections.map((section, index) => (
            <DocSection
              key={section.id}
              id={section.id}
              number={index + 1}
              title={section.heading}
            >
              <div className="nf-doc-prose">{section.body}</div>
            </DocSection>
          ))}
        </div>

        {/* ---------------------------------------------------- prev / next */}
        <nav
          aria-label="Chapter navigation"
          className="grid gap-row sm:grid-cols-2"
        >
          {previous ? (
            <Link
              href={`/docs/${previous.slug}`}
              rel="prev"
              className="nf-panel nf-panel--card nf-card--interactive flex min-h-11 flex-col p-card-sm"
            >
              <span className="flex items-center gap-inline text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-muted)]">
                <UiIcon name="arrow-left" size={12} />
                Previous
              </span>
              <span className="mt-inline-tight text-[length:var(--nf-text-body-sm)] leading-snug font-semibold text-[var(--nf-content-primary)]">
                {previous.number}. {previous.title}
              </span>
            </Link>
          ) : (
            <span aria-hidden="true" className="hidden sm:block" />
          )}

          {next && (
            <Link
              href={`/docs/${next.slug}`}
              rel="next"
              className="nf-panel nf-panel--card nf-card--interactive flex min-h-11 flex-col p-card-sm sm:items-end sm:text-right"
            >
              <span className="flex items-center gap-inline text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-muted)]">
                Next
                <UiIcon name="arrow-right" size={12} />
              </span>
              <span className="mt-inline-tight text-[length:var(--nf-text-body-sm)] leading-snug font-semibold text-[var(--nf-content-primary)]">
                {next.number}. {next.title}
              </span>
            </Link>
          )}
        </nav>
        <DocHelpPanel href="/contact" />
      </article>
    </div>
  );
}
