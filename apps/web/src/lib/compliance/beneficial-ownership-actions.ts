"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { adminRefusal, requireAdmin } from "../admin/guard";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";
import { lagosToday } from "../bookings/schema";
import {
  isIdDocumentKind,
  isRelationship,
  isVerifiedHow,
  looksLikeNin,
  readMandateForm,
  type MandateFormField,
  type MandateFormInput,
} from "./beneficial-ownership";

/**
 * SCUML item 17 writes: the lister files a mandate, staff decide it.
 *
 * Both go through definer functions that check their own caller and write
 * their own audit row in the same transaction. The lister's function forces
 * the row to "waiting", and a guard trigger stops anyone writing a decision
 * any other way, so the only path to an approved mandate is a member of
 * staff recording how they confirmed the principal.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED = "That was not saved. Nothing has changed. Try again in a moment.";

const FIELD_MESSAGE: Record<MandateFormField, string> = {
  kind: "Say what the owner asked you to do.",
  principalName: "Write the owner's full name.",
  principalPhone: "Write a mobile number we can ring, from any country, or leave it empty.",
  relationship: "Say how this person stands to the property.",
  dates: "The end date cannot be before the signing date.",
  endsInThePast: "The end date has already passed. Give the date the owner's new instruction ends, or leave it empty.",
};

export async function fileListingMandate(input: {
  listingId: string;
  form: MandateFormInput;
}): Promise<ActionResult<{ state: string }>> {
  if (!UUID.test(input.listingId)) return fail(FAILED);
  const read = readMandateForm(input.form, lagosToday());
  if (!read.ok) return fail(FIELD_MESSAGE[read.field], { [read.field]: FIELD_MESSAGE[read.field] });
  if (!isSupabaseConfigured()) return fail(FAILED);
  try {
    const db = (await createClient()) as unknown as SupabaseClient;
    const v = read.value;
    const { data, error } = await db.rpc("file_listing_mandate", {
      p_listing: input.listingId,
      p_kind: v.kind,
      p_principal_name: v.principalName,
      p_principal_phone: v.principalPhone,
      p_relationship: v.relationship,
      p_exclusive: v.exclusive,
      p_signed_on: v.signedOn,
      p_expires_on: v.expiresOn,
    });
    if (error) return fail(FAILED);
    const state = (data as { state?: unknown } | null)?.state;
    if (typeof state !== "string") return fail(FAILED);
    if (state === "not_yours") return fail("This listing is not yours to file a mandate for. Open one of your own listings to file its mandate.");
    if (state === "owner") return fail("You listed this as the owner, so there is no mandate to file. Nothing more is needed here.");
    if (state === "example") return fail("This is an example listing, so it needs no mandate. Nothing more is needed here.");
    if (state === "closed") return fail("This listing is closed, so there is nothing to file.");
    if (state === "ends_in_the_past") return fail(FIELD_MESSAGE.endsInThePast, { endsInThePast: FIELD_MESSAGE.endsInThePast });
    if (state === "on_file") return fail("The owner's mandate is on file and has more than 30 days to run. You can renew it from 30 days before it ends.");
    revalidatePath(`/agent/listings/${input.listingId}/mandate`);
    revalidatePath("/agent/listings");
    return ok({ state });
  } catch {
    return fail(FAILED);
  }
}

export async function decideListingMandate(input: {
  mandateId: string;
  decision: "approve" | "reject";
  relationship?: string | null;
  verifiedHow?: string | null;
  idDocumentKind?: string | null;
  idDocumentRef?: string | null;
  reason?: string | null;
}): Promise<ActionResult<{ state: string }>> {
  /* Listing-approval staff decide mandates too. The call goes through the
     caller's OWN client: `decide_listing_mandate` checks
     `private.staff_can(auth.uid(), 'listing_approval')`, and the service
     client a staff member is handed has no auth.uid(). */
  const access = await requireAdmin("listing_approval");
  if (access.state !== "admin") return fail(adminRefusal(access));
  if (!UUID.test(input.mandateId) || (input.decision !== "approve" && input.decision !== "reject")) return fail(FAILED);

  const ref = input.idDocumentRef?.trim() || null;
  const kind = input.idDocumentKind?.trim() || null;
  if (input.decision === "approve") {
    if (!isVerifiedHow(input.verifiedHow)) return fail("Say how you confirmed the owner.");
    if (input.relationship && !isRelationship(input.relationship)) return fail("Say how this person stands to the property.");
    if ((kind === null) !== (ref === null)) return fail("Enter both the document type and its reference, or leave both empty.");
    if (kind !== null && !isIdDocumentKind(kind)) return fail("Pick the document type.");
    if (ref !== null && looksLikeNin(ref)) {
      return fail("That looks like a NIN. Never record a NIN here: use a passport, licence, voter's card or CAC number.");
    }
  } else if (!input.reason || input.reason.trim().length < 8) {
    return fail("Write the reason the lister will read.");
  }

  try {
    const db = access.userClient as unknown as SupabaseClient;
    const { data, error } = await db.rpc("decide_listing_mandate", {
      p_mandate: input.mandateId,
      p_decision: input.decision,
      p_relationship: input.relationship || null,
      p_verified_how: input.decision === "approve" ? input.verifiedHow : null,
      p_id_document_kind: input.decision === "approve" ? kind : null,
      p_id_document_ref: input.decision === "approve" ? ref : null,
      p_reason: input.decision === "reject" ? input.reason!.trim().slice(0, 600) : null,
    });
    if (error) return fail(FAILED);
    const state = (data as { state?: unknown } | null)?.state;
    if (state === "gone") return fail("That mandate is no longer there. Refresh the desk.");
    if (state === "already") return fail("Someone has already decided this mandate. Refresh the desk.");
    /* SCUML item 19: the database refuses a staff member who lets the listing. */
    if (state === "own_listing") return fail("You let this listing, so another member of staff must decide its mandate. Leave it in the queue for a colleague.");
    if (state === "ended") return fail("This mandate's end date has passed, so it cannot be approved. Refuse it and ask the lister to file a current one.");
    if (state !== "approved" && state !== "rejected") return fail(FAILED);
    revalidatePath("/admin/listings");
    revalidatePath("/admin/compliance");
    return ok({ state });
  } catch {
    return fail(FAILED);
  }
}
