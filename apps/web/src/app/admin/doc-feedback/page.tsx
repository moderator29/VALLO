import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/guard";
import { CalmNote, PageHead, Panel, PanelUnavailable } from "../_components/panels";
import { readDocFeedback } from "./read";

export const metadata: Metadata = { title: "Pages that fail", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DAYS = 30;

/**
 * PAGES THAT FAIL (DOCS_AND_PRESENCE_UPGRADE.md 4.6: "a was this helpful that
 * writes to the support desk, so the help centre tells you which pages are
 * failing"). Every help topic, guide and docs chapter asks "Was this
 * helpful?"; this desk sums the answers of the last thirty days per page,
 * the most "no" first, with the latest notes a reader left, so the support
 * team knows which page to rewrite next.
 *
 * Read only. The door is the support desk's (`requireAdmin("support")`).
 * While the pending SQL file is not applied the read function does not
 * exist, and the desk says so plainly instead of drawing an empty table.
 */
export default async function DocFeedbackPage() {
  const door = await requireAdmin("support");
  if (door.state !== "admin") {
    return (
      <div className="nf-console" data-testid="doc-feedback-refused">
        <PageHead title="Pages that fail" />
        <CalmNote
          title="This is a support desk"
          fills="Your access covers other desks. Ask a super admin for the support scope to read the answers members give the help pages."
          action={{ href: "/admin", label: "Back to your console" }}
        />
      </div>
    );
  }

  const read = await readDocFeedback(door.userClient as unknown as SupabaseClient, DAYS);

  return (
    <div className="nf-console grid gap-md" data-testid="doc-feedback-desk">
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
