"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { requireAdmin, ADMIN_FORBIDDEN_MESSAGE } from "./guard";

/**
 * Approve or reject one verification document.
 *
 * THE REASON IS REQUIRED AND THIS IS THE THIRD PLACE IT IS REQUIRED. The
 * database has a check constraint, private.review_kyc_document refuses without
 * one, and the schema below refuses without one. That is not belt and braces
 * for its own sake: a rejection with no reason is the single most common way a
 * verification flow becomes cruel. Somebody is told no, cannot tell what was
 * wrong, uploads the same photograph again, is told no again, and concludes the
 * platform is refusing them personally. Each of the three layers is bypassed by
 * a different kind of mistake, so all three stay.
 *
 * The minimum is 12 characters rather than a token 4, because "blurry" is a
 * complete and useful sentence in this context and "no" is not.
 */

const SERVICE_DOWN =
  "That decision could not be recorded just now. Nothing was changed. Please try again.";

const reviewSchema = z
  .object({
    documentId: z.string().trim().uuid("We could not identify that document."),
    approve: z.boolean(),
    reason: z.string().trim().max(500, "Keep the reason under 500 characters.").optional(),
    /** The name exactly as printed on an ID, typed by the reviewer approving it. */
    nameOnId: z.string().trim().max(200, "Keep the name under 200 characters.").optional(),
  })
  .refine((value) => value.approve || (value.reason ?? "").length >= 12, {
    message: "Say what is wrong with it. The person is sent this, word for word.",
    path: ["reason"],
  });

export async function reviewKycDocument(input: {
  documentId: string;
  approve: boolean;
  reason?: string;
  nameOnId?: string;
}): Promise<ActionResult<null>> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return fail(ADMIN_FORBIDDEN_MESSAGE);

  const parsed = validate(reviewSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  try {
    /* An ID is approved with the name printed on it (manual verification,
       2 November 2026): that name is what the bank account name is matched
       against and what the person's confirmed identity carries. Saved first;
       the review function refuses an ID approval without it. */
    if (parsed.data.approve && parsed.data.nameOnId) {
      const named = await (access.userClient as unknown as {
        rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
      }).rpc("set_document_name", { p_document: parsed.data.documentId, p_name: parsed.data.nameOnId });
      const namedStatus =
        named.data && typeof named.data === "object" ? String((named.data as { status?: unknown }).status ?? "") : "";
      if (named.error) return fail(SERVICE_DOWN);
      if (namedStatus === "invalid_name") return fail("Type the full name as it is printed on the ID.", { nameOnId: "Type the full name as it is printed on the ID." });
      if (namedStatus === "own_document") return fail("This is your own document, so somebody else has to review it. Leave it in the queue for another reviewer.");
      if (namedStatus === "forbidden") return fail(ADMIN_FORBIDDEN_MESSAGE);
      if (namedStatus !== "ok" && namedStatus !== "not_identity") return fail(SERVICE_DOWN);
    }
    /*
     * NO acting_admin ARGUMENT, AND THAT IS THE POINT.
     *
     * Migration 20260809054243 moved this out of the private schema, because
     * PostgREST exposes public only and a console calling private.* got
     * PGRST202. The public wrapper deliberately takes ONE ARGUMENT FEWER: the
     * acting admin is auth.uid(), never something the caller states, because
     * "a function that let the caller name which admin was acting would put
     * the name on the audit entry under the caller's control, and an audit
     * trail somebody can write their colleague's name into is not an audit
     * trail".
     *
     * This call site kept passing it for 37 days. PostgREST resolves an RPC by
     * ARGUMENT NAME, so every call resolved nothing, returned PGRST202, and
     * this action answered "service down". No admin could approve or reject a
     * verification document in that window, so no agent could be verified, so
     * the supply side of the marketplace could not start. Typecheck did not
     * catch it and nothing else looks at these call sites.
     *
     * If you are adding an argument here, check the wrapper's signature in
     * supabase/migrations first, not the generated types, which nothing
     * regenerates automatically.
     */
    const { data, error } = await access.userClient.rpc("review_kyc_document", {
      p_document: parsed.data.documentId,
      p_approve: parsed.data.approve,
      /* An approval carries no reason, and the function's argument is not
         nullable in the generated types, so an empty string stands in. The
         database ignores it on the approve branch and the check constraint
         only bites on a rejection. */
      p_reason: parsed.data.reason ?? "",
    });
    if (error) return fail(SERVICE_DOWN);

    const status =
      data && typeof data === "object" && !Array.isArray(data)
        ? String((data as Record<string, unknown>)["status"] ?? "")
        : "";

    if (status === "ok") {
      revalidatePath("/admin/kyc");
      return ok(null);
    }
    if (status === "needs_a_reason") {
      return fail("Say what is wrong with it.", {
        reason: "The person is sent this, word for word.",
      });
    }
    if (status === "needs_a_name") {
      return fail("Type the name exactly as it is printed on the ID, then approve.", {
        nameOnId: "Type the name exactly as it is printed on the ID.",
      });
    }
    if (status === "not_found") {
      return fail("That document is no longer here. Reload the page.");
    }
    if (status === "own_document") return fail("This is your own document, so somebody else has to review it. Leave it in the queue for another reviewer.");
    if (status === "forbidden") return fail(ADMIN_FORBIDDEN_MESSAGE);
    return fail(SERVICE_DOWN);
  } catch {
    return fail(SERVICE_DOWN);
  }
}

/**
 * ASK FOR A SELFIE HOLDING THE ID (2 November 2026). Only when a reviewer
 * cannot confirm a document; never a step of the flow. The person is sent the
 * reviewer's words and answers with one photo from /verification. The acting
 * reviewer is auth.uid() inside `request_selfie_with_id`, which also writes
 * the audit row and refuses a request about the reviewer themself.
 */
const requestSchema = z.object({
  subjectId: z.string().trim().uuid("We could not identify that person."),
  message: z
    .string()
    .trim()
    .min(12, "Say what you need and why. The person is sent this, word for word.")
    .max(600, "Keep the message under 600 characters."),
});

export async function requestSelfieWithId(input: { subjectId: string; message: string }): Promise<ActionResult<null>> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return fail(ADMIN_FORBIDDEN_MESSAGE);
  const parsed = validate(requestSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  try {
    const { data, error } = await (access.userClient as unknown as {
      rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
    }).rpc("request_selfie_with_id", { p_subject: parsed.data.subjectId, p_message: parsed.data.message });
    if (error) return fail(SERVICE_DOWN);
    const status = data && typeof data === "object" ? String((data as { status?: unknown }).status ?? "") : "";
    if (status === "ok") {
      revalidatePath("/admin/kyc");
      return ok(null);
    }
    if (status === "already_asked") return fail("They have already been asked and have not answered yet.");
    if (status === "own_document") return fail("This is your own account, so somebody else has to review it.");
    if (status === "needs_a_message") return fail("Say what you need and why.", { message: "The person is sent this, word for word." });
    if (status === "forbidden") return fail(ADMIN_FORBIDDEN_MESSAGE);
    return fail(SERVICE_DOWN);
  } catch {
    return fail(SERVICE_DOWN);
  }
}
