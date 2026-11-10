import type { Metadata } from "next";
import { JsonLd } from "@/components/site/JsonLd";
import { breadcrumbLd } from "@/lib/site/structured-data";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CHAPTER_INDEX, DOC_GROUPS, chapterBySlug, chapterNeighbours } from "../chapters";
import "@/components/site/guides/docs-type.css";
import { DepthWords } from "@/components/motion/DepthWords";
import { MotionReveal } from "@/components/motion/Reveal";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import { SITE_CARD } from "@/lib/site/site-card";
import { DocHeader } from "@/components/docs/DocHeader";
import { DocSummary } from "@/components/docs/DocSummary";
import { DocToc } from "@/components/docs/DocToc";
import { DocButtons } from "@/components/docs/DocButton";
import { DocCrossLink } from "@/components/docs/DocCrossLink";
import { WasThisHelpful } from "@/components/docs/WasThisHelpful";
import { CONTACT_EMAIL } from "@/lib/docs/contact";
import "@/components/docs/docs-kit.css";

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
    openGraph: { type: "article", siteName: "Vallo", title: chapter.title, description: chapter.summary, images: [SITE_CARD] },
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
  const headings = chapter.sections.map((section) => ({
    id: section.id,
    heading: section.heading,
  }));

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
      {/* --------------------------------------------------------- heading */}
      <nav aria-label="Breadcrumb" className="mb-row">
        <Link
          href="/docs"
          className="nf-tap inline-flex min-h-11 items-center gap-inline text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-muted)] transition-colors hover:text-[var(--nf-content-primary)]"
        >
          <UiIcon name="arrow-left" size={16} />
          All chapters
        </Link>
      </nav>
      <div className="nf-rise">
        <DocHeader
          category={`${DOC_GROUPS.find((group) => group.id === chapter.group)?.label ?? "Documentation"}, chapter ${chapter.number} of ${CHAPTER_INDEX.length}`}
          categoryIcon={lineGlyphFor(chapter.icon)}
          title={chapter.title}
          updated={chapter.updated}
        >
          <p>{chapter.summary}</p>
          {chapter.related && chapter.related.length > 0 ? (
            <p>
              Also see{" "}
              {chapter.related.map((link, index) => (
                <span key={link.href}>
                  {index > 0 ? ", " : ""}
                  <DocCrossLink href={link.href}>{link.label}</DocCrossLink>
                </span>
              ))}
              .
            </p>
          ) : null}
        </DocHeader>
        {chapter.glance && chapter.glance.length > 0 ? <DocSummary points={chapter.glance} /> : null}
      </div>

      {/*
        The article and the heading rail.

        The rail is declared first so a phone meets it directly under the
        chapter heading, which is where a contents list is worth having, and
        `xl:order-last` moves it to the right the moment there is room for a
        third column. `min-w-0` on the article is what stops a long reference
        from widening the column and giving the page a sideways scroll.
      */}
      <div className="mt-heading flex flex-col gap-block xl:mt-block xl:flex-row xl:items-start">
        <div className="xl:order-last xl:w-64 xl:shrink-0">
          <div className="xl:sticky xl:top-24">
            <DocToc items={headings} />
          </div>
        </div>

        <article className="min-w-0 flex-1 xl:order-first">
          {/* ---------------------------------------------------- sections */}
          <div className="nf-panel nf-panel--card block nf-rise p-card sm:p-lg" style={{ animationDelay: "80ms" }}>
            <div className="nf-doc-sections">
              {/* Each section rises in as it arrives, its heading word by word
                  and its lists a step at a time (docs-motion.css); a section
                  already on screen is simply there. */}
              {chapter.sections.map((section, index) => (
                <MotionReveal as="section" key={section.id} id={section.id} className="nf-doc-section nf-depth-gate scroll-mt-28">
                  <span className="nf-doc-section__n nf-numeric" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="nf-doc-section__title">
                    <DepthWords text={section.heading} />
                  </h2>
                  <div className="nf-doc-prose">{section.body}</div>
                </MotionReveal>
              ))}
            </div>
          </div>

          {/* -------------------------------------------------- prev / next */}
          <nav aria-label="Chapter navigation" className="mt-block grid gap-row sm:grid-cols-2">
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

          {/* ---------------------------------------------------- closing */}
          {chapter.actions && chapter.actions.length > 0 ? (
            <div className="mt-block">
              <DocButtons items={chapter.actions} title="Go straight to it" foot />
            </div>
          ) : null}
          <WasThisHelpful path={`/docs/${chapter.slug}`} title={chapter.title} />

          <p className="mt-block text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            Something here unclear, or something missing?{" "}
            <Link
              href="/contact"
              className="font-semibold text-[var(--nf-content-link)] hover:underline"
            >
              Tell us
            </Link>{" "}
            and a person will answer within one business day, or write to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[var(--nf-content-link)] hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </article>
      </div>
    </div>
  );
}
