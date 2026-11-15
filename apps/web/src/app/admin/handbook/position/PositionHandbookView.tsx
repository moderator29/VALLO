import Link from "next/link";
import { DocCallout, DocCrossLink, DocHeader, DocSection, DocSummary, formatDocDate } from "@/components/docs/DocArticle";
import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
import { DocShell } from "@/components/docs/DocShell";
import { DocToc } from "@/components/docs/DocToc";
import {
  POSITION_HANDBOOK_INDEX,
  POSITION_HANDBOOK_UPDATED,
  positionHandbook,
  positionHandbookDocument,
  positionHandbookRoute,
} from "@/lib/admin/position-handbook";
import { JOB_DESCRIPTIONS, type StaffPosition } from "@/lib/admin/staff-positions";
import { SaveHandbook } from "./SaveHandbook";
import "./handbook-print.css";

/**
 * ONE POSITION'S HANDBOOK ON THE SCREEN, and the index of all of them.
 *
 * Drawn only with the documentation kit, inside the console frame, so a
 * handbook reads exactly as the staff manual and the member documents do in
 * both themes. Server components with no gate of their own: the routes in
 * `app/admin/handbook/position` ask the console door first.
 *
 * The article carries `data-handbook-print`, which is the only thing
 * `handbook-print.css` keys on, so "Save as PDF" prints the handbook and
 * none of the console around it. The save controls and the contents card
 * carry `nf-hbp-noprint`, because a printed page cannot be pressed.
 */

const SHELL = { section: "Staff handbook", sectionHref: "/admin/handbook", back: false, search: false } as const;

/** One handbook, in full. */
export function PositionHandbookView({
  position,
  own,
  canReadEveryPosition = false,
}: {
  position: StaffPosition;
  /** True where this is the viewer's own position. */
  own: boolean;
  /** True for an admin or super admin: the index link is drawn. */
  canReadEveryPosition?: boolean;
}) {
  const job = JOB_DESCRIPTIONS[position];
  const body = positionHandbook(position);
  const document = positionHandbookDocument(position);
  return (
    <DocShell {...SHELL}>
      <article className="nf-hbp grid gap-xl" data-handbook-print="" data-testid={`position-handbook-${position}`}>
        <DocHeader
          category={{ icon: "file-text", label: "Position handbook" }}
          title={`${job.title}: your handbook`}
          updated={POSITION_HANDBOOK_UPDATED}
          related={[
            { href: "/admin/handbook", label: "Staff handbook" },
            { href: "/admin/manual", label: "Staff manual" },
          ]}
        >
          <p className="mb-sm" data-testid="handbook-whose">
            <strong>This handbook is for the {job.title}.</strong>{" "}
            {own
              ? "That is your position, so this is your own handbook."
              : "That is not your position. You are reading it so the team can understand each other, and nothing here opens a desk your access does not."}
          </p>
          {body.intro}
        </DocHeader>
        <SaveHandbook document={document} />
        <DocSummary items={body.glance} />
        <div className="nf-hbp-noprint">
          <DocToc sections={body.sections.map((section) => ({ id: section.id, title: section.title }))} />
        </div>
        <div className="grid gap-xl">
          {body.sections.map((section, index) => (
            <DocSection key={section.id} id={section.id} number={index + 1} title={section.title}>
              {section.body}
            </DocSection>
          ))}
        </div>
        <DocCallout tone="note" title="Where this handbook sits">
          The <DocCrossLink href="/admin/handbook">staff handbook</DocCrossLink> is the short set of rules you
          acknowledge before any desk unlocks, and it is the rule wherever the two disagree. The{" "}
          <DocCrossLink href="/admin/manual">staff manual</DocCrossLink> explains every desk for everybody. This
          handbook is your position, in detail. All three are read against the console&apos;s own code often, and the
          screen is always the live answer.
        </DocCallout>
        {canReadEveryPosition ? (
          <p className="nf-hbp-noprint">
            <Link href="/admin/handbook/position" className="font-semibold text-[var(--nf-content-link)] underline underline-offset-2">
              Every position&apos;s handbook
            </Link>
          </p>
        ) : null}
        {/* The running foot: nothing on screen, on every page in print. */}
        <p className="nf-hbp-foot" aria-hidden="true">
          Vallo staff handbook: {job.title}. Read against the console on{" "}
          {formatDocDate(POSITION_HANDBOOK_UPDATED)}. The screen is the live answer.
        </p>
      </article>
    </DocShell>
  );
}

/** The index of every position's handbook, for an admin. */
export function PositionHandbookIndex({ heading = true }: { heading?: boolean }) {
  return (
    <section className="grid gap-md" data-testid="position-handbook-index" id="every-handbook">
      {heading ? <h2 className="nf-h3">Every position&apos;s handbook</h2> : null}
      <p className="nf-body">
        One handbook for each named position, with what the job is for, every desk it opens, the work step by step and
        who to go to. Anybody with console access may read any of them.
      </p>
      <DocCardGrid label="Position handbooks">
        {POSITION_HANDBOOK_INDEX.map((entry) => (
          <DocCard
            key={entry.position}
            href={positionHandbookRoute(entry.position)}
            icon="file-text"
            title={entry.title}
            description={entry.summary}
          />
        ))}
      </DocCardGrid>
    </section>
  );
}
