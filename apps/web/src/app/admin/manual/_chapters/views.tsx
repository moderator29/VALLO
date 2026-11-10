import Link from "next/link";
import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
import { DocCallout, DocCrossLink, DocHeader, DocSection, DocSummary } from "@/components/docs/DocArticle";
import { DocToc } from "@/components/docs/DocToc";
import { DocShell } from "@/components/docs/DocShell";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  MANUAL_CHAPTERS,
  MANUAL_UPDATED,
  manualChapter,
  manualNeighbours,
  type ManualSlug,
} from "@/lib/admin/manual/chapters";
import "@/components/site/guides/docs-type.css";
import { MANUAL_BODIES } from "./index";

/**
 * THE STAFF MANUAL'S TWO VIEWS: the index of chapters and one chapter. Drawn
 * only from the documentation kit, inside the console frame, so it reads as
 * the member documents do in both themes. Server components with no gate of
 * their own: the routes in `app/admin/manual` ask the console door first.
 *
 * The shell's own back control is off: the console frame around it already
 * draws one, and a page never shows two.
 */

const SHELL = { section: "Staff manual", sectionHref: "/admin/manual", back: false } as const;

export function ManualIndexView() {
  return (
    <DocShell {...SHELL} wide>
      <DocHeader
        category={{ icon: "clipboard-list", label: "Staff manual" }}
        title="The Vallo staff manual"
        updated={MANUAL_UPDATED}
        related={[
          { href: "/admin/handbook", label: "Staff handbook" },
          { href: "/admin/handbook/position", label: "Your role" },
        ]}
      >
        <p>
          For support staff, reviewers, moderators and everybody else who works the console. What each desk is for and
          who opens it, how to work a queue, what you may decide alone, what is written down, and where to take what you
          cannot decide. Every page was read against the console&apos;s own code on the date above.
        </p>
      </DocHeader>
      <DocSummary
        items={[
          "Start with the staff handbook: your desks unlock only when you acknowledge it.",
          "Your access areas open your desks and nothing else. The database checks every decision again.",
          "Nobody decides their own case, and every reason you write is read by the member as you wrote it.",
          "When you are unsure, escalate rather than guess.",
        ]}
      />
      <DocCardGrid label="Chapters of the staff manual">
        {MANUAL_CHAPTERS.map((chapter) => (
          <DocCard
            key={chapter.slug}
            href={`/admin/manual/${chapter.slug}`}
            icon={chapter.icon}
            title={`${chapter.number}. ${chapter.title}`}
            description={chapter.description}
          />
        ))}
      </DocCardGrid>
      <DocCallout tone="note" title="The handbook and this manual">
        The <DocCrossLink href="/admin/handbook">staff handbook</DocCrossLink> is the set of rules you acknowledge before
        any desk unlocks. This manual explains how the desks work. Where the two ever disagree, the handbook is the rule
        and this manual is wrong: tell the founder.
      </DocCallout>
    </DocShell>
  );
}

export function ManualChapterView({ slug }: { slug: ManualSlug }) {
  const chapter = manualChapter(slug);
  const body = MANUAL_BODIES[slug];
  const { previous, next } = manualNeighbours(slug);
  return (
    <DocShell {...SHELL}>
      <article className="grid gap-xl">
        <DocHeader
          category={{ icon: chapter.icon, label: "Staff manual" }}
          title={chapter.title}
          updated={MANUAL_UPDATED}
          related={[
            { href: "/admin/manual", label: "All chapters" },
            { href: "/admin/handbook", label: "Staff handbook" },
          ]}
        >
          {body.intro}
          <p className="mt-2xs nf-numeric text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
            Chapter {chapter.number} of {MANUAL_CHAPTERS.length}
          </p>
        </DocHeader>
        <DocSummary items={body.glance} />
        <DocToc sections={body.sections.map((s) => ({ id: s.id, title: s.title }))} />
        <div className="nf-doc-sections grid gap-xl">
          {body.sections.map((section, index) => (
            <DocSection key={section.id} id={section.id} number={index + 1} title={section.title}>
              <div className="nf-doc-prose">{section.body}</div>
            </DocSection>
          ))}
        </div>
        <nav aria-label="Chapter navigation" className="grid gap-sm sm:grid-cols-2">
          {previous ? (
            <Link
              href={`/admin/manual/${previous.slug}`}
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
          {next ? (
            <Link
              href={`/admin/manual/${next.slug}`}
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
          ) : null}
        </nav>
      </article>
    </DocShell>
  );
}
