import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ButtonLink } from "@/components/ui/Button";
import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
import { DocHelpPanel } from "@/components/docs/DocShell";
import { formatDocDate } from "@/components/docs/DocArticle";
import { DocsSearch } from "@/components/site/support/SupportSearch";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import { CHAPTER_INDEX, CHAPTERS, DOCS_REVIEWED, chaptersByGroup } from "./chapters";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("docs");
}

/**
 * THE DOCUMENTATION HOME, on the kit (DOCS_AND_PRESENCE_UPGRADE.md 4.2 and
 * 8: "a documentation home, with the three sections and the search").
 *
 * Every chapter in reading order, under its group (Start here, Renting and
 * buying, Stays and restaurants, Money, Listing and hosting, Messages and
 * tools, Trust and privacy), each a card saying what it answers and how long
 * it is, so somebody arriving with a specific question can pick the right
 * page without opening three. The search field is here as well as in the
 * shell's sheet, because this is the page people arrive on to look.
 *
 * Underneath, the surfaces this document deliberately does not duplicate:
 * the help centre, the guides and the legal documents. Documentation that
 * restates a policy is documentation that will one day contradict it.
 */
export default async function DocsHomePage() {
  const x = getDictionary(await getLocale()).experienceLanding.docs.docs;
  const sectionCount = new Map(CHAPTERS.map((chapter) => [chapter.slug, chapter.sections.length]));

  return (
    <div className="grid gap-block">
      <header className="grid gap-sm">
        <h1 className="font-[family-name:var(--nf-font-display)] text-[length:var(--nf-text-title-lg)] font-bold leading-tight">
          How Vallo works
        </h1>
        <p className="max-w-measure-body text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
          Plain answers for everyone on Vallo: renters, buyers and guests, owners and landlords, agents, hosts and
          restaurants. Pick your topic below, or start with the quick start.
        </p>
        <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
          Last updated <time dateTime={DOCS_REVIEWED}>{formatDocDate(DOCS_REVIEWED)}</time>
        </p>
        <div className="mt-2xs flex flex-wrap gap-row">
          <ButtonLink href="/docs/quick-start" variant="primary">
            Quick start
          </ButtonLink>
          <ButtonLink href="/docs/paying-on-vallo" variant="secondary">
            How paying works
          </ButtonLink>
        </div>
      </header>

      <DocsSearch />

      {chaptersByGroup(CHAPTER_INDEX).map((group) => (
        <section key={group.id} className="grid gap-sm" aria-labelledby={`docs-group-${group.id}`}>
          <h2 id={`docs-group-${group.id}`} className="nf-h3">
            {group.label}
          </h2>
          <DocCardGrid label={group.label}>
            {group.items.map((chapter) => {
              const count = sectionCount.get(chapter.slug) ?? 0;
              return (
                <DocCard
                  key={chapter.slug}
                  href={`/docs/${chapter.slug}`}
                  icon={lineGlyphFor(chapter.icon)}
                  title={`${chapter.number}. ${chapter.title}`}
                  description={chapter.summary}
                  meta={count === 1 ? x.sectionOne : x.sections.replace("{count}", String(count))}
                />
              );
            })}
          </DocCardGrid>
        </section>
      ))}

      <section className="grid gap-sm" aria-labelledby="docs-elsewhere">
        <h2 id="docs-elsewhere" className="nf-h3">
          Where else to look
        </h2>
        <DocCardGrid label="Where else to look">
          <DocCard
            href="/help"
            icon="headset"
            title="Help centre"
            description="Short answers, searchable, plus a way to reach a person."
          />
          <DocCard
            href="/guides"
            icon="file-text"
            title="Guides"
            description="Step by steps and longer reads: listing a property, scams, move-in costs, renting in Lagos and Abuja, and how stays work."
          />
          <DocCard
            href="/legal"
            icon="scale"
            title="Legal and policies"
            description="The terms, privacy and every policy, each one dated. Where these docs and a policy differ, the policy governs."
          />
          <DocCard
            href="/cancellations"
            icon="calendar-clock"
            title="Cancellations"
            description="The standard refund schedule for stays, and the four policies a host business can pick."
          />
        </DocCardGrid>
      </section>

      <DocHelpPanel href="/contact" />
    </div>
  );
}
