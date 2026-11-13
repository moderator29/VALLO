"use server";

/**
 * The host's answer to a review.
 *
 * A review is final: public.reviews carries no update policy, deliberately, so
 * nobody can edit what a guest wrote. An answer is a different object living
 * in public.review_responses, one per review, owned by the agent whose listing
 * was reviewed.
 *
 * Nothing here restates the database's rules. Ownership is a policy
 * (review_responses_insert_own), authorship is a BEFORE trigger that stamps
 * agent_id from the caller, the length bound is a check constraint, and the
 * guest's notification is an AFTER trigger. This file validates the shape of
 * the input, writes through the agent's own RLS-bound client, and turns a
 * refusal into a sentence a person can act on.
 *
 * The service role is never used here. An answer written as the service role
 * would bypass the ownership check that is the entire point of the policy.
 */

import { revalidatePath } from "next/cache";
import { catalogueChanged } from "@/lib/catalogue/invalidate";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE } from "../actions/session";
import { getAgentContext } from "./listings-queries";
import { contentRefusal } from "../safety/content-refusal";
import { REPLY_MAX, replyInputSchema, replyRemoveSchema } from "./reviews-schema";

const NOT_AGENT_MESSAGE =
  "Only the host of a listing can answer its reviews. Apply to host and we will take it from there.";

const NOT_YOURS_MESSAGE =
  "That review is not on one of your listings, so it is not yours to answer. Open it from the listing it was left on.";

const SERVICE_DOWN_MESSAGE =
  "We could not save your reply just then. Nothing was lost, please try again in a moment.";

export type ReplyReceipt = { reviewId: string; body: string };

/**
 * The answer appears under the review on the public listing page too, so that
 * page has to be revalidated as well as the console. Best effort: a stale
 * public page is a cosmetic lag, never a reason to tell a host their reply
 * failed to save when it did.
 */
async function revalidateListingOf(
  supabase: SupabaseClient<Database>,
  reviewId: string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("reviews")
      .select("listing_id")
      .eq("id", reviewId)
      .maybeSingle();
    if (data?.listing_id) {
      catalogueChanged({ listingId: data.listing_id });
      revalidatePath(`/listing/${data.listing_id}`);
    }
  } catch {
    // The console is already revalidated; the public page follows on its own.
  }
}

/**
 * Write or correct the answer to one review.
 *
 * An upsert on the review id, because there is exactly one answer per review
 * and a host correcting a typo should not have to delete and write again. The
 * scanner covers both paths, so a correction cannot smuggle in an account
 * number that the original could not.
 */
export async function replyToReview(
  _prev: ActionResult<ReplyReceipt> | null,
  formData: FormData,
): Promise<ActionResult<ReplyReceipt>> {
  const context = await getAgentContext();
  if (context.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (context.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (context.state === "not-agent") return fail(NOT_AGENT_MESSAGE);

  const parsed = validate(replyInputSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { reviewId, body } = parsed.data;

  try {
    /* agent_id defaults to current_agent_id() in the database, but the
       generated Insert type requires it, and stating it here is the honest
       version anyway: this row belongs to the agent whose listing the review
       is on, and that is exactly who the context resolved. The policy still
       decides, on `private.owns_review_listing(review_id)`. */
    const { error } = await context.supabase
      .from("review_responses")
      .upsert({ review_id: reviewId, agent_id: context.agent.id, body }, { onConflict: "review_id" });

    if (error) {
      // 42501 is the policy refusing a review on somebody else's listing, and
      // it is the only refusal here a host can do anything about.
      if (error.code === "42501") return fail(NOT_YOURS_MESSAGE);
      // RM004: the content scanner refused the wording (SEC-05).
      const refused = contentRefusal(error);
      if (refused) return fail(refused, { body: refused });
      if (error.code === "23514") {
        return fail(`Keep your reply under ${REPLY_MAX} characters.`, {
          body: "This reply is too long.",
        });
      }
      return fail(SERVICE_DOWN_MESSAGE);
    }

    revalidatePath("/agent/reviews");
    await revalidateListingOf(context.supabase, reviewId);
    return ok({ reviewId, body });
  } catch {
    return fail(SERVICE_DOWN_MESSAGE);
  }
}

/**
 * Withdraw an answer.
 *
 * A host who says something they regret should be able to take it back
 * themselves rather than write to support about it. The review stays exactly
 * where it was.
 */
export async function removeReviewReply(
  _prev: ActionResult<{ reviewId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ reviewId: string }>> {
  const context = await getAgentContext();
  if (context.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (context.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (context.state === "not-agent") return fail(NOT_AGENT_MESSAGE);

  const parsed = validate(replyRemoveSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  try {
    const { error } = await context.supabase
      .from("review_responses")
      .delete()
      .eq("review_id", parsed.data.reviewId);
    if (error) return fail(SERVICE_DOWN_MESSAGE);

    revalidatePath("/agent/reviews");
    await revalidateListingOf(context.supabase, parsed.data.reviewId);
    return ok({ reviewId: parsed.data.reviewId });
  } catch {
    return fail(SERVICE_DOWN_MESSAGE);
  }
}
