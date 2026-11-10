import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** One page's answers in the window, as the desk shows them. */
export type DocFeedbackRow = {
  page: string;
  helpful: number;
  notHelpful: number;
  notes: string[];
  lastAt: string | null;
};

export type DocFeedbackRead =
  | { state: "ok"; rows: DocFeedbackRow[] }
  /** The function is not there yet: the pending SQL file is not applied. */
  | { state: "not-switched-on" }
  | { state: "unavailable" };

/**
 * "WAS THIS HELPFUL?", SUMMED PER PAGE, for the support desk
 * (`public.staff_doc_feedback_summary`, in
 * supabase/migrations/pending/docs_page_feedback_2026-11-10.sql). Called with
 * the reader's OWN client, because the function checks `private.is_staff()`
 * against `auth.uid()`. A function that does not exist yet (PostgREST
 * PGRST202, or Postgres 42883) is the honest "not switched on" state, never
 * an empty table that reads as "every page is fine".
 */
export async function readDocFeedback(client: SupabaseClient, days = 30): Promise<DocFeedbackRead> {
  try {
    const { data, error } = await client.rpc("staff_doc_feedback_summary", { p_days: days });
    if (error) {
      return error.code === "PGRST202" || error.code === "42883" ? { state: "not-switched-on" } : { state: "unavailable" };
    }
    const rows = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
      page: String(r.page ?? ""),
      helpful: Number(r.helpful ?? 0) || 0,
      notHelpful: Number(r.not_helpful ?? 0) || 0,
      notes: Array.isArray(r.latest_notes) ? r.latest_notes.filter((n): n is string => typeof n === "string") : [],
      lastAt: typeof r.last_at === "string" ? r.last_at : null,
    }));
    return { state: "ok", rows: rankByNo(rows) };
  } catch {
    return { state: "unavailable" };
  }
}

/** Most "no" answers first; a tie goes to the larger share of "no", then the page. */
export function rankByNo(rows: DocFeedbackRow[]): DocFeedbackRow[] {
  const share = (r: DocFeedbackRow) => (r.helpful + r.notHelpful === 0 ? 0 : r.notHelpful / (r.helpful + r.notHelpful));
  return [...rows].sort((a, b) => b.notHelpful - a.notHelpful || share(b) - share(a) || a.page.localeCompare(b.page));
}
