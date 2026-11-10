import Link from "next/link";
import { CalmNote, PageHead, Panel, PanelUnavailable } from "../_components/panels";
import type { DocFeedbackRead } from "./read";

/**
 * The desk itself, apart from its door and its read, so the dev preview can
 * draw the honest "not switched on" state with no data invented.
 */
export function DocFeedbackView({ read, days }: { read: DocFeedbackRead; days: number }) {
  const DAYS = days;
  return (
    <div className="nf-console grid grid-cols-[minmax(0,1fr)] gap-md [overflow-wrap:anywhere]" data-testid="doc-feedback-desk">
      <PageHead
        title="Pages that fail"
        lede={`What members answered to "Was this helpful?" on the help centre, the guides and the docs, over the last ${DAYS} days. The pages with the most "no" come first.`}
      />
      {read.state === "not-switched-on" ? (
        <CalmNote
          kind="unwired"
          title="Not switched on yet"
          fills={`The help pages draw "Was this helpful?" only once the support desk can receive the answers. That needs one database change, which is written and waiting.`}
          creates="Apply supabase/migrations/pending/docs_page_feedback_2026-11-10.sql. The control then appears on every help topic, guide and chapter, and the answers arrive here."
        />
      ) : read.state === "unavailable" ? (
        <PanelUnavailable what="the help page answers" />
      ) : read.rows.length === 0 ? (
        <CalmNote title="No answers yet" fills={`Nobody has answered "Was this helpful?" in the last ${DAYS} days.`} />
      ) : (
        <Panel title="By page" id="doc-feedback-pages" flush>
          <ol className="grid">
            {read.rows.map((row, i) => (
              <li key={row.page} className="grid gap-2xs border-t border-[var(--nf-border-subtle)] px-md py-sm first:border-t-0">
                <div className="flex flex-wrap items-baseline justify-between gap-sm">
                  <Link href={row.page} className="min-w-0 font-semibold text-[var(--nf-content-link)] [overflow-wrap:anywhere] hover:underline">
                    <span className="nf-numeric text-[var(--nf-content-muted)]">{i + 1}. </span>
                    {row.page}
                  </Link>
                  <span className="nf-numeric text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                    {row.notHelpful} no · {row.helpful} yes
                  </span>
                </div>
                {row.notes.length > 0 ? (
                  <ul className="grid gap-2xs ps-md text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)] [list-style:disc]">
                    {row.notes.map((note, n) => (
                      <li key={n}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
