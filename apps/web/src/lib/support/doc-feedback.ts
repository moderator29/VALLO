"use server";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { createClient } from "../supabase/server";
import { isSupabaseConfigured } from "../supabase/env";
import { consume, ipFromHeaders, subjectForIp, subjectForUser } from "../security/rate-limit";
import { DOC_FEEDBACK_PAGE } from "./doc-feedback-page";

/**
 * "WAS THIS HELPFUL?" (DOCS_AND_PRESENCE_UPGRADE.md 4.6): one yes or no, and
 * an optional line on what was missing, from a help answer, a guide or a docs
 * chapter, to the support desk's own table (`public.submit_doc_feedback`, in
 * supabase/migrations/pending/docs_page_feedback_2026-11-10.sql, NOT APPLIED).
 * Until that file is applied the control is not drawn at all
 * (`docFeedbackReady`), so nobody presses a button that goes nowhere.
 *
 * Open to visitors as well as members: the database function stamps the
 * member when there is one and takes nothing else about the person. Counted
 * by account or by address, twenty an hour; the limiter fails open, so an
 * outage in the counter never stops somebody answering.
 */
const schema = z.object({
  page: z.string().max(200).regex(DOC_FEEDBACK_PAGE),
  helpful: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export async function submitDocFeedback(input: z.input<typeof schema>): Promise<ActionResult<{ saved: true }>> {
  const parsed = validate(schema, input);
  if (!parsed.ok) return parsed;
  if (!isSupabaseConfigured()) return fail("Your answer could not be saved just now.");

  const session = await resolveSession();
  const verdict = await consume({
    bucket: "doc_feedback",
    subject: session.state === "signed-in" ? subjectForUser(session.user.id) : subjectForIp(ipFromHeaders(await headers())),
    limit: 20,
    windowSeconds: 3_600,
  });
  if (!verdict.allowed) return fail(`That is a lot of answers in one hour. Try again ${verdict.retryIn}.`);

  try {
    /* Not in the generated types until the pending file is applied. */
    const db = (session.state === "signed-in" ? session.supabase : await createClient()) as unknown as SupabaseClient;
    const { data, error } = await db.rpc("submit_doc_feedback", {
      p_page: parsed.data.page,
      p_helpful: parsed.data.helpful,
      p_note: parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null,
    });
    if (error || data !== true) return fail("Your answer could not be saved just now. Try again in a moment.");
    return ok({ saved: true as const });
  } catch {
    return fail("Your answer could not be saved just now. Try again in a moment.");
  }
}
