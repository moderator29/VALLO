import { docFeedbackReady } from "@/lib/support/doc-feedback-ready";
import { DocHelpful } from "./DocHelpful";

/**
 * "Was this helpful?", only where the support desk can receive it: until the
 * desk's table exists (supabase/migrations/pending/docs_page_feedback_2026-11-10.sql)
 * this draws nothing, so no reader presses a button that goes nowhere.
 */
export async function DocHelpfulSlot({ page }: { page: string }) {
  if (!(await docFeedbackReady())) return null;
  return <DocHelpful page={page} />;
}
