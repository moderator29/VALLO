import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ButtonLink } from "@/components/ui/Button";
import { CHAPTER_INDEX, CHAPTERS, chaptersByGroup } from "./chapters";
import { IndexRows } from "@/components/site/guides/IndexRows";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("docs");
}

/**
 * The table of contents.
 *
 * Every chapter in reading order, under its group (Start here, Renting and
 * buying, Stays and restaurants, Money, Listing and hosting, Messages and
 * tools, Trust and privacy), each saying what it answers, so somebody
 * arriving with a specific question can pick the right page without opening
 * three. The row carries its heading count, because "how long is this" is the
 * second thing anybody wants to know about a page.
 *
 * The surfaces underneath are the places this document deliberately does not
 * duplicate: the searchable help centre, the guides, the refund schedule and
 * the policies. Documentation that restates a policy is documentation that
 * will one day contradict it.
 */
export default async function DocsHomePage() {
  const x = getDictionary(await getLocale()).experienceLanding.docs.docs;
  const sectionCount = new Map(CHAPTERS.map((chapter) => [chapter.slug, chapter.sections.length]));

  return (
    <div>
      {/* ------------------------------------------------------------ hero */}
      <div className="nf-rise">
        <h1 className="nf-h1 max-w-[18ch]">How Vallo works</h1>
        <p className="mt-group max-w-[62ch] text-[length:var(--nf-text-body-lg)] leading-[1.6] text-[var(--nf-content-secondary)]">
          Plain answers for everyone on Vallo: renters, buyers and guests, owners and landlords,
          agents, hosts and restaurants. Pick your topic below, or start with the quick start.
        </p>
        <div className="mt-heading flex flex-wrap gap-row">
          <ButtonLink href="/docs/quick-start" variant="primary">
            Quick start
          </ButtonLink>
          <ButtonLink href="/docs/paying-on-vallo" variant="secondary">
            How paying works
          </ButtonLink>
          <ButtonLink href="/help" variant="secondary">
            Help centre
          </ButtonLink>
        </div>
      </div>

      {/* -------------------------------------------------------- chapters */}
      {/* THE INDEX (reference 7086): one list per group, a Plate row per
          chapter, each a glyph plate, the chapter's title and its one line,
          with how long it is on the right. */}
      {chaptersByGroup(CHAPTER_INDEX).map((group) => (
        <section key={group.id} className="mt-block" aria-labelledby={`docs-group-${group.id}`}>
          <h2 id={`docs-group-${group.id}`} className="nf-h3">
            {group.label}
          </h2>
          <IndexRows
            as="ol"
            label={group.label}
            className="mt-group"
            items={group.items.map((chapter) => {
              const count = sectionCount.get(chapter.slug) ?? 0;
              return {
                href: `/docs/${chapter.slug}`,
                icon: lineGlyphFor(chapter.icon),
                title: chapter.title,
                line: chapter.summary,
                meta: count === 1 ? x.sectionOne : x.sections.replace("{count}", String(count)),
              };
            })}
          />
        </section>
      ))}

      {/* --------------------------------------------------- other surfaces */}
      <section className="mt-section" aria-labelledby="docs-elsewhere">
        <h2 id="docs-elsewhere" className="nf-h3">
          Where else to look
        </h2>
        <IndexRows
          label="Where else to look"
          className="mt-group"
          items={[
            {
              href: "/help",
              icon: "headset",
              title: "Help centre",
              line: "Short answers, searchable, plus a way to reach a person.",
            },
            {
              href: "/guides",
              icon: "file-text",
              title: "Guides",
              line: "Longer reads for renters and guests: scams, move-in costs, renting in Lagos and Abuja, and how stays work.",
            },
            {
              href: "/cancellations",
              icon: "calendar-clock",
              title: "Cancellations",
              line: "The standard refund schedule for stays, and the four policies a host business can pick.",
            },
            {
              href: "/terms",
              icon: "file-text",
              title: "Terms and privacy",
              line: "The formal documents. Where these docs and a policy differ, the policy governs.",
            },
          ]}
        />
      </section>
    </div>
  );
}
