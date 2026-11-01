"use server";

import { z } from "zod";
import { resolveSession } from "@/lib/actions/session";
import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { passcodeMoneyRefusal } from "@/lib/passcode/money";
import { getListingRepository } from "@/lib/listings/repository";
import { bookViewingSlot } from "@/lib/viewings/actions";
import { toggleSave } from "@/lib/saved/actions";
import { startCardCheckout } from "@/lib/bookings/checkout";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { assertPermission, auditAction } from "./access";
import {
  createProposal,
  decideProposal,
  readOwnProposal,
  recordProposalResult,
  refusalWords,
  retryProposal,
  type ProposalKind,
} from "./proposals";
import type { AssistantSlot } from "./types";
import { readOpenSlots } from "./tools/viewings";
import { readPayable } from "./tools/money";
import { naira, when } from "./tools/private-common";

/**
 * EVERY BUTTON ON THE ASSISTANT'S SCREEN LANDS HERE.
 *
 * Each action signs the person in from the session, is paced, asks the DATABASE
 * whether the assistant is on and the permission is granted (the browser's word
 * is never taken), and for anything consequential goes through a proposal:
 * single use, hash bound, ten minutes, fails closed if the permission was revoked
 * meanwhile. The action itself is then the EXISTING code path (book a viewing,
 * toggle a save, open a card checkout) with all its own rules, so the assistant
 * is a faster way to ask for what the member could do by hand and never a way
 * around a rule. Nothing says "done" until that code says so.
 *
 * "use server": async exports only.
 */

type Signed = Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>;

const SIGNED_OUT = "Sign in to use this.";
const PACED = "That is a lot at once. Give it a moment and try again.";

async function gate(bucket: string): Promise<{ session: Signed } | { refusal: ActionResult<never> }> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return { refusal: fail(SIGNED_OUT) };
  const pace = await consume({ bucket, subject: subjectForUser(session.user.id), limit: 40, windowSeconds: 600 });
  if (!pace.allowed) return { refusal: fail(`${PACED} Try again ${pace.retryIn}.`) };
  return { session };
}

const uuid = z.string().uuid();

/* ------------------------------------------------------------------ reads */

const listingInput = z.object({ listingId: uuid });

/** The real pictures of one listing, for the "More pictures" button. Public data. */
export async function assistantListingPhotos(input: unknown): Promise<ActionResult<{ title: string; urls: string[] }>> {
  const parsed = validate(listingInput, input);
  if (!parsed.ok) return fail("That place could not be found.");
  const g = await gate("assistant_action");
  if ("refusal" in g) return g.refusal;
  const l = await getListingRepository().byId(parsed.data.listingId);
  if (!l || l.isDemo) return fail("There are no pictures to show for that place.");
  const urls = l.photos.filter((p) => /^https?:\/\//.test(p)).slice(0, 20);
  if (urls.length === 0) return fail("This place has no pictures yet.");
  return ok({ title: l.title, urls });
}

/** Real open viewing times for the "Request viewing" button. Needs the bookings and viewings permission. */
export async function assistantViewingSlots(input: unknown): Promise<ActionResult<{ listingId: string; title: string; slots: AssistantSlot[] }>> {
  const parsed = validate(listingInput, input);
  if (!parsed.ok) return fail("That place could not be found.");
  const g = await gate("assistant_action");
  if ("refusal" in g) return g.refusal;
  const verdict = await assertPermission(g.session.supabase, "bookings_viewings", "viewing_slots_button");
  if (!verdict.ok) return fail(refusalWords("not_granted"));
  const l = await getListingRepository().byId(parsed.data.listingId);
  if (!l) return fail("That place could not be found.");
  if (l.isDemo) return fail("This is an example listing, so there is nothing to view. Open a real listing from search.");
  const slots = await readOpenSlots(g.session.supabase, l.id);
  if (slots === null) return fail("Viewing times could not be read just now. Try again in a moment.");
  if (slots.length === 0) return fail("There are no open viewing times for this place. You can ask the lister for a time from the listing page.");
  return ok({ listingId: l.id, title: l.title, slots: slots.slice(0, 12).map((s) => ({ slotAt: s.slot_at, label: when(s.slot_at) })) });
}

/* --------------------------------------------------------------- proposals */

const proposeViewingInput = z.object({ listingId: uuid, slotAt: z.string().max(40) });

/** A tapped time becomes a proposal to confirm. Re-checks the time against the real open slots. */
export async function assistantProposeViewing(
  input: unknown,
): Promise<ActionResult<{ proposalId: string; payloadHash: string; title: string; whenLabel: string }>> {
  const parsed = validate(proposeViewingInput, input);
  if (!parsed.ok) return fail("That time could not be read.");
  const g = await gate("assistant_action");
  if ("refusal" in g) return g.refusal;
  const l = await getListingRepository().byId(parsed.data.listingId);
  if (!l || l.isDemo) return fail("That place cannot be viewed.");
  const slots = await readOpenSlots(g.session.supabase, l.id);
  const wanted = Date.parse(parsed.data.slotAt);
  const match = slots?.find((s) => Date.parse(s.slot_at) === wanted);
  if (!match) return fail("That time is no longer open. Pick another.");
  const made = await createProposal(g.session.supabase, "viewing_request", { listing_id: l.id, slot_at: match.slot_at, title: l.title });
  if (!made.ok) return fail(refusalWords(made.reason));
  return ok({ proposalId: made.id, payloadHash: made.payloadHash, title: l.title, whenLabel: when(match.slot_at) });
}

const saveInput = z.object({ listingId: uuid, want: z.boolean() });

/**
 * Save or unsave: the member's own tap on a Save button is the approval, so the
 * proposal is made and confirmed in this one call. It is still permission gated,
 * hash bound, single use and audited.
 */
export async function assistantSave(input: unknown): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = validate(saveInput, input);
  if (!parsed.ok) return fail("That place could not be found.");
  const g = await gate("assistant_action");
  if ("refusal" in g) return g.refusal;
  const kind: ProposalKind = parsed.data.want ? "save_listing" : "unsave_listing";
  const made = await createProposal(g.session.supabase, kind, { listing_id: parsed.data.listingId });
  if (!made.ok) return fail(refusalWords(made.reason));
  const decided = await decideProposal(g.session.supabase, made.id, "confirm", made.payloadHash);
  if (!decided.ok) return fail(refusalWords(decided.reason));
  const result = await toggleSave({ listingId: parsed.data.listingId, want: parsed.data.want });
  if (!result.ok) {
    await recordProposalResult(g.session.supabase, made.id, { ok: false, reason: "save_failed" });
    return fail(result.error);
  }
  await recordProposalResult(g.session.supabase, made.id, { ok: true });
  return ok({ saved: parsed.data.want });
}

/* ----------------------------------------------------------------- decide */

const decideInput = z.object({
  proposalId: uuid,
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(["confirm", "cancel"]),
});

export type DecideAnswer =
  | { kind: "cancelled" }
  | { kind: "viewing_booked"; message: string }
  | { kind: "open_checkout"; url: string; message: string };

/**
 * The member tapped Confirm or Cancel on a proposal. Before anything is
 * consumed, a payment is pre-checked (money lock, and the amount still being
 * the amount that was shown); then the database decides the proposal; then the
 * existing code runs and its real answer is returned.
 */
export async function assistantDecide(input: unknown): Promise<ActionResult<DecideAnswer>> {
  const parsed = validate(decideInput, input);
  if (!parsed.ok) return fail("That button is no longer valid. Ask again.");
  const { proposalId, payloadHash, decision } = parsed.data;
  const g = await gate("assistant_action");
  if ("refusal" in g) return g.refusal;
  const { supabase, user } = g.session;

  if (decision === "cancel") {
    const out = await decideProposal(supabase, proposalId, "cancel", payloadHash);
    return out.ok ? ok({ kind: "cancelled" }) : fail(refusalWords(out.reason));
  }

  const stored = await readOwnProposal(supabase, proposalId);
  if (!stored) return fail(refusalWords("not_found"));

  /* A payment is pre-checked WITHOUT using the proposal up, so a locked session or a changed
     price never costs the member their button. */
  if (stored.kind === "payment_review") {
    const locked = await passcodeMoneyRefusal(user.id);
    if (locked) {
      await auditAction(supabase, { event: "payment_blocked", permission: "payment_assist", outcome: "refused", detail: { reason: "session_locked" } });
      return fail(locked);
    }
    const bookingId = String(stored.payload.booking_id ?? "");
    const kind = stored.payload.target_kind === "rent" ? "rent" : "booking";
    const payable = await readPayable(supabase, user.id, "booking", bookingId);
    if (!payable || payable.totalMinor !== Number(stored.payload.amount_minor)) {
      await decideProposal(supabase, proposalId, "cancel", payloadHash);
      await auditAction(supabase, { event: "payment_blocked", permission: "payment_assist", outcome: "refused", detail: { reason: "amount_changed", kind } });
      return fail("The amount or the state of this payment changed since I showed it, so I stopped. Nothing was charged. Ask me again to see the current figure.");
    }
  }

  const out = await decideProposal(supabase, proposalId, "confirm", payloadHash);
  if (!out.ok) return fail(refusalWords(out.reason));
  if (out.decision !== "confirm") return fail(refusalWords("unavailable"));

  switch (out.kind) {
    case "viewing_request": {
      const result = await bookViewingSlot({
        listingId: String(out.payload.listing_id ?? ""),
        slotAt: String(out.payload.slot_at ?? ""),
        tapKey: proposalId,
      });
      if (!result.ok) {
        await recordProposalResult(supabase, proposalId, { ok: false, reason: "booking_refused" });
        return fail(result.error);
      }
      await recordProposalResult(supabase, proposalId, { ok: true });
      return ok({ kind: "viewing_booked", message: `Booked and confirmed: ${String(out.payload.title ?? "your viewing")}, ${when(String(out.payload.slot_at ?? ""))}. It is on your Plans.` });
    }
    case "payment_review": {
      const result = await startCardCheckout({ bookingId: String(out.payload.booking_id ?? ""), idempotencyKey: proposalId });
      if (!result.ok || !result.data) {
        await recordProposalResult(supabase, proposalId, { ok: false, reason: "checkout_refused" });
        return fail(result.ok ? "The payment page could not be opened. Nothing was charged." : result.error);
      }
      await recordProposalResult(supabase, proposalId, { ok: true, reference: result.data.reference });
      return ok({
        kind: "open_checkout",
        url: result.data.authorizationUrl,
        message: `The secure payment page for ${naira(Number(out.payload.amount_minor ?? 0))} is ready. You pay there; I will show the real result when you come back.`,
      });
    }
    default:
      await recordProposalResult(supabase, proposalId, { ok: false, reason: "unsupported" });
      return fail("I cannot do that one for you yet. Human support can help from Settings, Help.");
  }
}

/* ------------------------------------------------------- status and retry */

const idInput = z.object({ proposalId: uuid });

type Q = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => {
        order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown }> };
        maybeSingle: () => PromiseLike<{ data: unknown }>;
      };
    };
  };
};

/** What really happened to a payment, read from the booking and its transaction. Never guessed. */
export async function assistantPaymentStatus(input: unknown): Promise<ActionResult<{ paid: boolean; message: string }>> {
  const parsed = validate(idInput, input);
  if (!parsed.ok) return fail("That payment could not be found.");
  const g = await gate("assistant_status");
  if ("refusal" in g) return g.refusal;
  const stored = await readOwnProposal(g.session.supabase, parsed.data.proposalId);
  if (!stored || stored.kind !== "payment_review") return fail("That payment could not be found.");
  const bookingId = String(stored.payload.booking_id ?? "");
  const db = g.session.supabase as unknown as Q;
  const { data: b } = await db.from("bookings").select("status").eq("id", bookingId).maybeSingle();
  const status = String((b as { status?: unknown } | null)?.status ?? "");
  if (status === "CONFIRMED" || status === "COMPLETED") return ok({ paid: true, message: "Paid. The provider confirmed it and your booking is confirmed." });
  if (status === "CANCELLED") return ok({ paid: false, message: "This booking was cancelled, so nothing is due." });
  const { data: tx } = await db.from("transactions").select("status").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1);
  const last = String(((Array.isArray(tx) ? tx[0] : null) as { status?: unknown } | null)?.status ?? "");
  if (last === "FAILED") return ok({ paid: false, message: "The payment did not go through and nothing was charged. You can try again." });
  return ok({ paid: false, message: "Not paid yet. If you have just paid, give it a minute and check again." });
}

/** A failed attempt is offered again as a NEW proposal, never by replaying the old one. */
export async function assistantRetry(input: unknown): Promise<ActionResult<{ proposalId: string; payloadHash: string }>> {
  const parsed = validate(idInput, input);
  if (!parsed.ok) return fail("That cannot be retried.");
  const g = await gate("assistant_action");
  if ("refusal" in g) return g.refusal;
  const made = await retryProposal(g.session.supabase, parsed.data.proposalId);
  if (!made.ok) return fail(refusalWords(made.reason));
  return ok({ proposalId: made.id, payloadHash: made.payloadHash });
}
