"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { adminRefusal, requireAdmin } from "../admin/guard";
import { parseNairaToKobo } from "../money/amount";
import { getAdminClient } from "../supabase/service";
import { DOOR_FALLBACK, DOOR_WORDS } from "./door-words";
import { callAs, writeDoor } from "./server";
import type { PaymentPreference } from "./types";

/**
 * THE DOORS FOR OFFERS. Every one calls a `sale_offer_*_as` database function
 * with the session's user id; the database is the authority on whose turn it
 * is, which version is current and whether the listing still takes offers.
 * Every write that a retry could duplicate carries an idempotency key made
 * once per form mount. Nothing here moves money: Vallo takes no money for a
 * purchase, and accepting an offer creates no transaction.
 */

const uuid = z.string().uuid("That is not an id we recognise.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");
const key = z.string().trim().min(8, "Something went wrong with the form. Reload and try again.").max(100);
const MAX_KOBO = 10_000_000_000_000; // matches offer_policy.max_amount_minor

export type SubmitOfferInput = {
  listingId: string;
  /** Naira as typed. Blank or null means the asking price; the figure is resolved server-side. */
  amountNaira: string | null;
  paymentPreference: PaymentPreference;
  depositNaira?: string | null;
  instalmentMonths?: number | null;
  /** ISO date, proposed. */
  targetClosing?: string | null;
  note?: string | null;
  idempotencyKey: string;
};

function nairaToKobo(raw: string | null | undefined, field: string): { kobo: number | null; error?: string } {
  const text = (raw ?? "").trim();
  if (text === "") return { kobo: null };
  const kobo = parseNairaToKobo(text);
  if (kobo === null || kobo <= 0) return { kobo: null, error: `${field}: enter a figure in naira, like 78,000,000.` };
  if (kobo > MAX_KOBO) return { kobo: null, error: DOOR_WORDS.amount_too_large };
  return { kobo };
}

const PaymentSchema = z.enum(["cash", "mortgage", "instalment"]);

function touch(offerId: string) {
  revalidatePath("/offers");
  revalidatePath(`/offers/${offerId}`);
}

export async function submitOffer(input: SubmitOfferInput): Promise<ActionResult<{ offerId: string; reference: string }>> {
  const parsed = validate(
    z.object({
      listingId: uuid,
      amountNaira: z.string().nullable(),
      paymentPreference: PaymentSchema,
      depositNaira: z.string().nullable().optional(),
      instalmentMonths: z.number().int().min(1).max(120).nullable().optional(),
      targetClosing: isoDate.nullable().optional().or(z.literal("")),
      note: z.string().trim().max(2000, DOOR_WORDS.note_too_long).nullable().optional(),
      idempotencyKey: key,
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const amount = nairaToKobo(parsed.data.amountNaira, "Offer");
  if (amount.error) return fail(amount.error, { amountNaira: amount.error });
  const deposit = nairaToKobo(parsed.data.depositNaira, "Deposit");
  if (deposit.error) return fail(deposit.error, { depositNaira: deposit.error });
  const result = await writeDoor(
    "sale_offer_submit_as",
    (userId) => ({
      p_actor: userId,
      p_listing: parsed.data.listingId,
      p_amount_minor: amount.kobo,
      p_pref: parsed.data.paymentPreference,
      p_deposit_minor: parsed.data.paymentPreference === "cash" ? null : deposit.kobo,
      p_months: parsed.data.paymentPreference === "instalment" ? (parsed.data.instalmentMonths ?? null) : null,
      p_target: parsed.data.targetClosing ? parsed.data.targetClosing : null,
      p_note: parsed.data.note ?? null,
      p_key: parsed.data.idempotencyKey,
    }),
    (a) => ({ offerId: String(a.agreement_id), reference: String(a.reference ?? "") }),
  );
  if (result.ok) {
    revalidatePath("/offers");
    revalidatePath(`/listing/${parsed.data.listingId}`);
  }
  return result;
}

/** Accept the version being looked at (the version is checked in the database). Seller on a buyer's offer, buyer on a seller's counter. */
export async function acceptOffer(input: { offerId: string; version: number; idempotencyKey: string }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid, version: z.number().int().min(1), idempotencyKey: key }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor(
    "sale_offer_accept_as",
    (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_version: parsed.data.version, p_key: parsed.data.idempotencyKey }),
    () => null,
  );
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

export async function acceptCounter(input: { offerId: string; version: number; idempotencyKey: string }): Promise<ActionResult<null>> {
  return acceptOffer(input);
}

export async function declineOffer(input: { offerId: string; reason?: string | null }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid, reason: z.string().trim().max(1000, DOOR_WORDS.note_too_long).nullable().optional() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor(
    "sale_offer_decline_as",
    (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_reason: parsed.data.reason ?? null }),
    () => null,
  );
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

/** Either side proposes new terms: a NEW version. Never an edit of the version before. */
export async function counterOffer(input: {
  offerId: string;
  /** The version being answered. The database refuses if it is no longer the latest. */
  baseVersion: number;
  amountNaira: string;
  paymentPreference?: PaymentPreference;
  depositNaira?: string | null;
  instalmentMonths?: number | null;
  targetClosing?: string | null;
  note?: string | null;
  idempotencyKey: string;
}): Promise<ActionResult<{ version: number }>> {
  const parsed = validate(
    z.object({
      offerId: uuid,
      baseVersion: z.number().int().min(1),
      amountNaira: z.string().trim().min(1, DOOR_WORDS.bad_amount),
      paymentPreference: PaymentSchema.optional(),
      depositNaira: z.string().nullable().optional(),
      instalmentMonths: z.number().int().min(1).max(120).nullable().optional(),
      targetClosing: isoDate.nullable().optional().or(z.literal("")),
      note: z.string().trim().max(2000, DOOR_WORDS.note_too_long).nullable().optional(),
      idempotencyKey: key,
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const amount = nairaToKobo(parsed.data.amountNaira, "Counteroffer");
  if (amount.kobo === null) {
    const words = amount.error ?? DOOR_WORDS.bad_amount ?? "Enter an offer above zero.";
    return fail(words, { amountNaira: words });
  }
  const deposit = nairaToKobo(parsed.data.depositNaira, "Deposit");
  if (deposit.error) return fail(deposit.error, { depositNaira: deposit.error });
  // The terms not restated carry over from the version being answered, in the database.
  const room = await callAs("sale_offer_room_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId }));
  if (!room.ok) return fail(room.error);
  if (room.answer.status !== "ok") return fail(DOOR_WORDS[String(room.answer.status)] ?? DOOR_FALLBACK);
  const offer = room.answer.offer as { version: number; payment_preference: PaymentPreference; target_closing: string | null };
  const versions = room.answer.versions as { version: number; terms: { deposit_minor?: number | null; instalment_months?: number | null } }[];
  const current = versions.find((v) => v.version === offer.version);
  const pref = parsed.data.paymentPreference ?? offer.payment_preference;
  const result = await writeDoor(
    "sale_offer_counter_as",
    (userId) => ({
      p_actor: userId,
      p_agreement: parsed.data.offerId,
      p_base_version: parsed.data.baseVersion,
      p_amount_minor: amount.kobo,
      p_pref: pref,
      p_deposit_minor: pref === "cash" ? null : (parsed.data.depositNaira !== undefined ? deposit.kobo : (current?.terms.deposit_minor ?? null)),
      p_months: pref === "instalment" ? (parsed.data.instalmentMonths ?? current?.terms.instalment_months ?? null) : null,
      p_target: parsed.data.targetClosing === undefined ? offer.target_closing : parsed.data.targetClosing || null,
      p_note: parsed.data.note ?? null,
      p_key: parsed.data.idempotencyKey,
    }),
    (a) => ({ version: Number(a.terms_version ?? 0) }),
  );
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

export async function requestMoreInformation(input: { offerId: string; question: string }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid, question: z.string().trim().min(3, "Write your question.").max(2000, DOOR_WORDS.note_too_long) }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor("sale_offer_info_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_text: parsed.data.question, p_asking: true }), () => null);
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

export async function answerInformationRequest(input: { offerId: string; answer: string }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid, answer: z.string().trim().min(3, "Write your answer.").max(2000, DOOR_WORDS.note_too_long) }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor("sale_offer_info_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_text: parsed.data.answer, p_asking: false }), () => null);
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

export async function withdrawOffer(input: { offerId: string }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor("sale_offer_withdraw_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId }), () => null);
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

/** Recorded stage advance after agreement. Never by elapsed time. "completed" needs both sides. */
export async function markStage(input: { offerId: string; stage: "due_diligence" | "documentation" | "closing" | "completed" }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid, stage: z.enum(["due_diligence", "documentation", "closing", "completed"]) }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor("sale_offer_stage_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_stage: parsed.data.stage }), () => null, ["waiting_for_other_side"]);
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

/** Join a booked inspection to the deal. */
export async function linkInspection(input: { offerId: string; inspectionId: string }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid, inspectionId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor("sale_offer_link_inspection_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_inspection: parsed.data.inspectionId }), () => null);
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

export async function raiseDealDispute(input: { offerId: string; reason: string; detail: string }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid, reason: z.enum(["scam", "not_as_described", "other"]), detail: z.string().trim().min(20, DOOR_WORDS.describe_more).max(2000) }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor("sale_offer_dispute_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_reason: parsed.data.reason, p_detail: parsed.data.detail }), () => null);
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

const CATEGORY = z.enum(["certificate_of_occupancy", "deed_of_assignment", "survey_plan", "building_approval", "agent_authorisation", "governors_consent", "agreement_draft", "inspection_report", "other"]);

export async function requestDocument(input: { offerId: string; category: string; label?: string | null }): Promise<ActionResult<{ documentId: string }>> {
  const parsed = validate(z.object({ offerId: uuid, category: CATEGORY, label: z.string().trim().max(120).nullable().optional() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor(
    "sale_doc_request_as",
    (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_category: parsed.data.category, p_label: parsed.data.label ?? null }),
    (a) => ({ documentId: String(a.document_id ?? "") }),
  );
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

const MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 15 * 1024 * 1024;
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Returns a short-lived signed upload URL; the file never touches a public bucket. Pass `documentId` for a requested document, or `category` for a new one. */
export async function startDocumentUpload(input: {
  offerId: string;
  documentId?: string;
  category?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<ActionResult<{ uploadUrl: string; path: string; documentId: string }>> {
  const parsed = validate(
    z.object({
      offerId: uuid,
      documentId: uuid.optional(),
      category: CATEGORY.optional(),
      fileName: z.string().trim().min(1).max(200),
      contentType: z.enum(MIME, { error: "Upload a PDF or a photo (JPEG, PNG or WebP)." }),
      sizeBytes: z.number().int().min(1, "That file is empty.").max(MAX_BYTES, "Keep the file under 15 MB."),
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const prepared = await callAs("sale_doc_prepare_as", (userId) => ({
    p_actor: userId,
    p_agreement: parsed.data.offerId,
    p_doc: parsed.data.documentId ?? null,
    p_category: parsed.data.category ?? null,
    p_label: null,
  }));
  if (!prepared.ok) return fail(prepared.error);
  if (prepared.answer.status !== "ok") return fail(DOOR_WORDS[String(prepared.answer.status)] ?? DOOR_FALLBACK);
  const documentId = String(prepared.answer.document_id);
  const version = Number(prepared.answer.next_version ?? 1);
  const admin = getAdminClient();
  if (!admin) return fail(DOOR_FALLBACK);
  const path = `${parsed.data.offerId}/${documentId}/${version}-${crypto.randomUUID()}.${EXT[parsed.data.contentType]}`;
  const signed = await admin.storage.from("deal-documents").createSignedUploadUrl(path);
  if (signed.error || !signed.data) return fail(DOOR_FALLBACK);
  return ok({ uploadUrl: signed.data.signedUrl, path, documentId });
}

export async function finishDocumentUpload(input: {
  offerId: string;
  documentId: string;
  path: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
}): Promise<ActionResult<null>> {
  const parsed = validate(
    z.object({ offerId: uuid, documentId: uuid, path: z.string().min(10).max(300), fileName: z.string().max(200).optional(), contentType: z.string().optional(), sizeBytes: z.number().int().optional() }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error);
  const admin = getAdminClient();
  if (!admin) return fail(DOOR_FALLBACK);
  // The file's real size and type come from storage, never from the client.
  const info = await admin.storage.from("deal-documents").info(parsed.data.path);
  if (info.error || !info.data) return fail("The file did not arrive. Try uploading it again.");
  const size = Number((info.data as { size?: number }).size ?? 0);
  const mime = String((info.data as { contentType?: string }).contentType ?? parsed.data.contentType ?? "");
  const result = await writeDoor(
    "sale_doc_register_as",
    (userId) => ({
      p_actor: userId,
      p_agreement: parsed.data.offerId,
      p_doc: parsed.data.documentId,
      p_path: parsed.data.path,
      p_file_name: parsed.data.fileName ?? parsed.data.path.split("/").pop() ?? "document",
      p_mime: mime,
      p_size: size,
    }),
    () => null,
  );
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

/** A signed, time-limited read URL. The database logs every call before it is minted. */
export async function openDocument(input: { offerId: string; documentId: string }): Promise<ActionResult<{ url: string; expiresInSeconds: number }>> {
  const parsed = validate(z.object({ offerId: uuid, documentId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await callAs("sale_doc_access_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_doc: parsed.data.documentId }));
  if (!result.ok) return fail(result.error);
  if (result.answer.status !== "ok") return fail(DOOR_WORDS[String(result.answer.status)] ?? DOOR_FALLBACK);
  const admin = getAdminClient();
  if (!admin) return fail(DOOR_FALLBACK);
  const signed = await admin.storage.from("deal-documents").createSignedUrl(String(result.answer.path), 120);
  if (signed.error || !signed.data) return fail(DOOR_FALLBACK);
  return ok({ url: signed.data.signedUrl, expiresInSeconds: 120 });
}

export async function reviewDocument(input: { offerId: string; documentId: string; decision: "under_review" | "approved" | "rejected" | "more_information"; note?: string | null }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ offerId: uuid, documentId: uuid, decision: z.enum(["under_review", "approved", "rejected", "more_information"]), note: z.string().trim().max(1000).nullable().optional() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const result = await writeDoor("sale_doc_review_as", (userId) => ({ p_actor: userId, p_agreement: parsed.data.offerId, p_doc: parsed.data.documentId, p_decision: parsed.data.decision, p_note: parsed.data.note ?? null }), () => null);
  if (result.ok) touch(parsed.data.offerId);
  return result;
}

/** Admin (console second factor enforced in the database): intervention that never rewrites agreed terms. */
export async function adminIntervene(input: { offerId: string; action: "cancel" | "note" | "flag_dispute" | "resolve_dispute"; note: string }): Promise<ActionResult<null>> {
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(z.object({ offerId: uuid, action: z.enum(["cancel", "note", "flag_dispute", "resolve_dispute"]), note: z.string().trim().min(10, DOOR_WORDS.reason_required).max(1000) }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await access.userClient.rpc("admin_sale_offer_intervene" as never, { p_agreement: parsed.data.offerId, p_action: parsed.data.action, p_note: parsed.data.note } as never);
  if (error) return fail(DOOR_FALLBACK);
  const status = String((data as { status?: string } | null)?.status ?? "");
  if (status !== "ok") return fail(DOOR_WORDS[status] ?? DOOR_FALLBACK);
  revalidatePath("/admin/offers");
  revalidatePath(`/admin/offers/${parsed.data.offerId}`);
  return ok(null);
}
