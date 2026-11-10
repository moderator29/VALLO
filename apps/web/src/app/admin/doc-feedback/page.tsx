import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/guard";
import { CalmNote, PageHead } from "../_components/panels";
import { readDocFeedback } from "./read";
import { DocFeedbackView } from "./DocFeedbackView";

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
  return <DocFeedbackView read={read} days={DAYS} />;
}
