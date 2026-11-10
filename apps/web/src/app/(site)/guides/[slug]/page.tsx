import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/i18n/public-metadata";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { JsonLd } from "@/components/site/JsonLd";
import { ButtonLink } from "@/components/ui/Button";
import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
import {
  DocCallout,
  DocHeader,
  DocSection,
  DocSummary,
  type DocCalloutTone,
} from "@/components/docs/DocArticle";
import { DocToc } from "@/components/docs/DocToc";
import { DocHelpPanel, DocShell } from "@/components/docs/DocShell";
import {
  GUIDES,
  guideBySlug,
  guideCategory,
  readingMinutes,
  type GuideBlock,
} from "@/lib/guides/articles";
import { GUIDE_SLUGS } from "@/lib/guides/slugs";
import { articleLd, breadcrumbLd } from "@/lib/site/structured-data";
import { GuideShot } from "../GuideShot";
import { StepPlayer } from "../StepPlayer";
import { CopyButton } from "@/components/docs/CopyButton";
import { DocHelpfulSlot } from "@/components/docs/DocHelpfulSlot";

/** A14. One guide. Unknown slugs are a 404; the list is fixed at build. */
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    /* A10: canonical in the page's language, and the hreflang set. */
    alternates: (await localizedAlternates(path)) ?? { canonical: path },
    openGraph: {
      url: path,
      type: "article",
      title: guide.title,
      description: guide.description,
      modifiedTime: guide.reviewed,
      publishedTime: guide.published,
    },
  };
}

/** A guide's own callout tones, on the kit's: what Vallo does, a published rule, a step not to skip. */
const TONE: Record<"vallo" | "rule" | "warn", DocCalloutTone> = {
  vallo: "tip",
  rule: "note",
  warn: "warning",
};

/** From four sections a guide gets the contents card; a short one reads straight through. */
const TOC_FROM = 4;

/**
 * ONE GUIDE, ON THE DOCUMENTATION KIT (DOCS_AND_PRESENCE_UPGRADE.md 2.3, 2.8;
 * R85 to R90, R97). It opens by saying what it will say: the category pill,
 * the title, the date a person last read it against the product, the scope
 * and the sibling guides. Then "Before you start" where the guide is a
 * how-to, the contents card for a long one, the numbered sections with their
 * callouts and the real screens, the sources, the next step and more guides.
 * Every section keeps its id, so a link to `/guides/<slug>#<section>` lands.
 */
export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const locale = await getLocale();
  const g = getDictionary(locale).publicDoors.guides;
  const path = `/guides/${guide.slug}`;
  const category = guideCategory(guide.category);
  const toc = guide.sections.map(({ id, title }) => ({ id, title }));
  /* The siblings a reader may want instead: the same category first. */
  const others = [
    ...GUIDES.filter(
      (o) => o.slug !== guide.slug && o.category === guide.category
    ),
    ...GUIDES.filter(
      (o) => o.slug !== guide.slug && o.category !== guide.category
    ),
  ];

  return (
    <>
      <JsonLd
        data={[
          articleLd({
            path,
            title: guide.title,
            description: guide.description,
            reviewed: guide.reviewed,
            published: guide.published,
          }),
          breadcrumbLd([
            { name: "Vallo", path: "/" },
            { name: g.chip, path: "/guides" },
            { name: guide.title, path },
          ]),
        ]}
      />
      <DocShell section="Guides" sectionHref="/guides" back={false} wide>
        {/* From 64rem the contents card stands in its own sticky column
            beside the guide; below that it sits in the flow. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-xl lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <article
            lang="en"
            className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-xl"
            aria-label={guide.title}
          >
            <DocHeader
              category={{ icon: category.icon, label: category.label }}
              title={guide.title}
              updated={guide.reviewed}
              related={others
                .slice(0, 2)
                .map((o) => ({ href: `/guides/${o.slug}`, label: o.title }))}
            >
              <p>{guide.description}</p>
              <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                {g.readTime.replace("{minutes}", String(readingMinutes(guide)))}
              </p>
              {locale !== "en" ? (
                <p className="mt-2xs text-[length:var(--nf-text-caption)]">
                  {g.englishOnly}
                </p>
              ) : null}
            </DocHeader>

            {guide.beforeYouStart && guide.beforeYouStart.length > 0 ? (
              <DocSummary
                title="Before you start"
                items={guide.beforeYouStart}
              />
            ) : null}

            {guide.sections.length >= TOC_FROM ? (
              <div className="lg:hidden">
                <DocToc title={g.onThisPage} sections={toc} />
              </div>
            ) : null}

            {guide.player ? (
              <StepPlayer
                label={guide.player}
                icon={category.icon}
                steps={guide.sections.map((section) => ({
                  id: section.id,
                  title: section.title,
                  text:
                    section.blocks.find(
                      (b): b is string => typeof b === "string"
                    ) ?? "",
                  shot: section.shot,
                }))}
              />
            ) : null}

            <div className="grid gap-xl">
              {guide.sections.map((section, index) => (
                <DocSection
                  key={section.id}
                  id={section.id}
                  number={index + 1}
                  title={section.title}
                >
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                  {section.shot ? (
                    <GuideShot
                      dark={section.shot.dark}
                      light={section.shot.light}
                      alt={section.shot.alt}
                    />
                  ) : null}
                </DocSection>
              ))}
            </div>

            {guide.sources.length > 0 ? (
              <section aria-labelledby="guide-sources" className="grid gap-xs">
                <h2 id="guide-sources" className="nf-doc-search__eyebrow">
                  {g.sources}
                </h2>
                <ol className="grid list-decimal gap-2xs ps-md text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {guide.sources.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            <DocHelpfulSlot page={path} />

            <section aria-labelledby="guide-next" className="grid gap-sm">
              <h2 id="guide-next" className="nf-doc-search__eyebrow">
                {g.nextLabel}
              </h2>
              <ButtonLink
                href={guide.next.href}
                variant="primary"
                size="md"
                full
                trailingIcon="arrow-right"
              >
                {guide.next.label}
              </ButtonLink>
            </section>

            <section aria-labelledby="guide-more" className="grid gap-sm">
              <h2 id="guide-more" className="nf-h3">
                {g.more}
              </h2>
              <DocCardGrid label={g.more}>
                {others.slice(0, 4).map((o) => (
                  <DocCard
                    key={o.slug}
                    href={`/guides/${o.slug}`}
                    icon={guideCategory(o.category).icon}
                    title={o.title}
                    description={o.description}
                    meta={g.readTime.replace(
                      "{minutes}",
                      String(readingMinutes(o))
                    )}
                  />
                ))}
              </DocCardGrid>
            </section>
          </article>
          {guide.sections.length >= TOC_FROM ? (
            <aside
              className="hidden lg:sticky lg:top-24 lg:block"
              aria-label={g.onThisPage}
            >
              <DocToc title={g.onThisPage} sections={toc} />
              <div className="mt-sm flex items-center gap-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                <CopyButton text={path} label="Link" icon="link" />
                <span>Copy a link to this guide</span>
              </div>
            </aside>
          ) : null}
        </div>
        <DocHelpPanel href="/help" label="Open the help centre" />
      </DocShell>
    </>
  );
}

function Block({ block }: { block: GuideBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  if ("list" in block) {
    return (
      <ul role="list">
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if ("quote" in block) {
    /* A sentence the guide already says, set large on a brand rule. */
    return (
      <figure className="m-0 border-s-2 border-[var(--nf-brand-primary)] ps-md">
        <blockquote className="font-[family-name:var(--nf-font-display)] text-[length:var(--nf-text-body-lg)] leading-snug font-semibold text-[var(--nf-content-primary)]">
          <p>{block.quote}</p>
        </blockquote>
      </figure>
    );
  }
  return (
    <DocCallout tone={TONE[block.tone]} title={block.title}>
      {block.callout}
    </DocCallout>
  );
}
