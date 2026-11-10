import { photoUrl } from "../listings/supabase-repository";
import type {
  DealDocument, DealRoom, DealStage, DocumentCategory, DocumentState, Eligibility, MandateLine, NextAction, OfferEvent, OfferRow, OfferState,
  OfferTerms, OfferVersion, PaymentPreference, PriceBlock, Requirement, RequirementKey, RequirementState, Side,
} from "./types";

/**
 * Database JSON to the typed contract. Pure, so it is tested without a
 * database. The database already refused to put a buyer's identity data in
 * anything the seller reads; this file only reshapes what arrives.
 */
type J = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" ? v : null);
const n = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : 0);
const b = (v: unknown): boolean => v === true;

export function stateOf(status: unknown): OfferState {
  switch (status) {
    case "approved": return "agreed";
    case "rejected": return "declined";
    case "withdrawn": return "withdrawn";
    case "expired": return "expired";
    case "cancelled": return "cancelled";
    default: return "open";
  }
}

const STAGES: readonly DealStage[] = ["offer", "negotiating", "agreed", "due_diligence", "documentation", "closing", "completed"];
export function stageOf(v: unknown): DealStage {
  return (STAGES as readonly unknown[]).includes(v) ? (v as DealStage) : "offer";
}

/** The difference between an offer and the asking price: an amount and a percentage, signed. */
export function differenceOf(amountMinor: number, askingMinor: number): { differenceMinor: number; differencePct: number } {
  const differenceMinor = amountMinor - askingMinor;
  const differencePct = askingMinor > 0 ? Math.round((differenceMinor / askingMinor) * 1000) / 10 : 0;
  return { differenceMinor, differencePct };
}

export function termsOf(raw: unknown, fallbackProposer: Side = "buyer"): OfferTerms {
  const t = (raw ?? {}) as J;
  const pref = (["cash", "mortgage", "instalment"] as const).includes(t.payment_preference as PaymentPreference) ? (t.payment_preference as PaymentPreference) : "cash";
  return {
    paymentPreference: pref,
    deposit_minor: t.deposit_minor == null ? null : n(t.deposit_minor),
    instalment_months: t.instalment_months == null ? null : n(t.instalment_months),
    instalment_minor: null,
    targetClosing: s(t.target_closing),
    note: s(t.note),
    proposedBy: t.proposed_by === "seller" ? "seller" : fallbackProposer,
    atAskingPrice: b(t.at_asking_price),
  };
}

/** What changed between two versions, in words and figures. */
export function changesBetween(prev: OfferVersion | null, next: Pick<OfferVersion, "amountMinor" | "terms">, fmt: (minor: number) => string): string[] {
  if (!prev) return [];
  const out: string[] = [];
  if (next.amountMinor !== prev.amountMinor) {
    const d = next.amountMinor - prev.amountMinor;
    out.push(`Amount ${d > 0 ? "up" : "down"} ${fmt(Math.abs(d))}, from ${fmt(prev.amountMinor)} to ${fmt(next.amountMinor)}`);
  }
  if (next.terms.paymentPreference !== prev.terms.paymentPreference) out.push(`Payment preference changed from ${prev.terms.paymentPreference} to ${next.terms.paymentPreference}`);
  if ((next.terms.deposit_minor ?? null) !== (prev.terms.deposit_minor ?? null)) out.push("Deposit proposal changed");
  if ((next.terms.instalment_months ?? null) !== (prev.terms.instalment_months ?? null)) out.push("Instalment period changed");
  if ((next.terms.targetClosing ?? null) !== (prev.terms.targetClosing ?? null)) out.push("Proposed closing date changed");
  return out;
}

export function offerRow(raw: J, viewer?: Side): OfferRow {
  const amountMinor = n(raw.amount_minor);
  const askingMinor = n(raw.asking_minor);
  const state = stateOf(raw.status);
  const side = (raw.viewer_side === "seller" ? "seller" : "buyer") as Side;
  const awaiting = raw.awaiting_side === "buyer" || raw.awaiting_side === "seller" ? (raw.awaiting_side as Side) : null;
  const thumb = s(raw.thumb);
  return {
    id: String(raw.id),
    reference: String(raw.reference ?? ""),
    listingId: String(raw.listing_id),
    listingTitle: String(raw.listing_title ?? "Property"),
    listingThumb: thumb ? photoUrl(thumb) : null,
    askingMinor,
    amountMinor,
    ...differenceOf(amountMinor, askingMinor),
    state,
    stage: stageOf(raw.stage),
    turn: state === "open" ? awaiting : null,
    viewerSide: viewer ?? side,
    counterpartyName: String(raw.counterparty_name ?? "A member"),
    paymentPreference: (["cash", "mortgage", "instalment"] as const).includes(raw.payment_preference as PaymentPreference) ? (raw.payment_preference as PaymentPreference) : "cash",
    targetClosing: s(raw.target_closing),
    submittedAt: String(raw.submitted_at ?? raw.updated_at ?? ""),
    lastActivityAt: String(raw.updated_at ?? ""),
    expiresAt: s(raw.expires_at),
    unread: b(raw.unread),
    version: n(raw.version) || 1,
  };
}

export function countsOf(rows: readonly OfferRow[]): Record<OfferState | "all" | "awaiting_you", number> {
  const c = { all: rows.length, awaiting_you: 0, open: 0, agreed: 0, declined: 0, withdrawn: 0, expired: 0, cancelled: 0 };
  for (const r of rows) {
    c[r.state] += 1;
    if (r.state === "open" && r.turn === r.viewerSide) c.awaiting_you += 1;
  }
  return c;
}

const CATEGORIES: readonly DocumentCategory[] = ["certificate_of_occupancy", "deed_of_assignment", "survey_plan", "building_approval", "agent_authorisation", "governors_consent", "agreement_draft", "inspection_report", "other"];
const DOC_STATES: readonly DocumentState[] = ["requested", "uploaded", "under_review", "approved", "rejected", "more_information"];

export function documentOf(raw: J): DealDocument {
  return {
    id: String(raw.id),
    category: (CATEGORIES as readonly unknown[]).includes(raw.category) ? (raw.category as DocumentCategory) : "other",
    state: (DOC_STATES as readonly unknown[]).includes(raw.state) ? (raw.state as DocumentState) : "requested",
    uploadedByName: s(raw.uploaded_by_name),
    uploadedBy: raw.uploaded_by_side === "buyer" || raw.uploaded_by_side === "seller" ? (raw.uploaded_by_side as Side) : null,
    uploadedAt: s(raw.uploaded_at),
    version: n(raw.version),
    reviewedByName: s(raw.reviewed_by_name),
    reviewedAt: s(raw.reviewed_at),
    note: s(raw.note),
  };
}

export function mandateOf(raw: unknown): MandateLine {
  const m = (raw ?? {}) as J;
  return { held: b(m.held), reviewedOn: s(m.reviewed_on), expiresOn: s(m.expires_on) };
}

export function eligibilityOf(raw: unknown): Eligibility {
  const e = (raw ?? {}) as J;
  const rows = Array.isArray(e.requirements) ? (e.requirements as J[]) : [];
  const LABEL: Record<RequirementKey, string> = { government_id: "Government ID", minimum_age: "Minimum age (18+)", phone: "Phone number", email: "Email address" };
  const requirements: Requirement[] = rows.map((r) => {
    const key = r.key as RequirementKey;
    const state = r.state as RequirementState;
    const actionable = state === "required" || state === "in_progress";
    return {
      key,
      label: LABEL[key] ?? String(r.key),
      state,
      // Age follows the id check: one fix covers both, so only the id row carries the button.
      fixHref: !actionable || key === "minimum_age" ? null : key === "government_id" ? "/verification" : key === "phone" ? "/settings" : "/settings",
    };
  });
  return { eligible: b(e.eligible), requirements };
}

/** The honest price block: the asking price, and only the costs the listing really carries. Today a sale listing carries none. */
export function priceBlockOf(askingMinor: number): PriceBlock {
  return { askingMinor, costs: [], totalIsComplete: false, totalMinor: null };
}

export function nextActionOf(offer: OfferRow, docs: readonly DealDocument[]): NextAction | null {
  const mine = offer.viewerSide;
  if (offer.state === "open") {
    if (offer.turn === mine) {
      return mine === "seller"
        ? { kind: "respond", label: "Answer this offer", detail: "Accept it, decline it, send new terms, or ask a question." }
        : { kind: "accept_counter", label: "Answer the new terms", detail: "Accept the seller's version, propose your own, or withdraw." };
    }
    return { kind: "wait", label: "Waiting for the other side", detail: offer.expiresAt ? "You will be told the moment they answer." : "You will be told the moment they answer." };
  }
  if (offer.state === "agreed") {
    if (docs.some((d) => d.state === "uploaded" || d.state === "under_review")) return { kind: "review_document", label: "Review a document", detail: "A document is waiting for a look. Uploaded is not the same as checked." };
    if (offer.stage === "agreed") return { kind: "schedule_inspection", label: "Book the inspection", detail: "Terms are agreed. This is not a sale: the inspection, the documents and the transfer still have to happen." };
    if (offer.stage === "completed") return { kind: "none", label: "Completed", detail: "Both sides recorded completion." };
    return { kind: "mark_closing", label: "Record the next step", detail: "Move the deal forward once the step has really happened." };
  }
  return null;
}

export function dealRoomOf(raw: J, fmtBase?: never): DealRoom {
  void fmtBase;
  const offerRaw = (raw.offer ?? {}) as J;
  const side = (raw.viewer_side === "seller" ? "seller" : "buyer") as Side;
  const offer = offerRow({ ...offerRaw, viewer_side: side }, side);
  const fmt = (m: number) => `NGN ${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(Math.round(m / 100))}`;
  const versions: OfferVersion[] = [];
  for (const v of (Array.isArray(raw.versions) ? raw.versions : []) as J[]) {
    const terms = termsOf(v.terms, v.proposed_by === "seller" ? "seller" : "buyer");
    const base = { version: n(v.version), amountMinor: n(v.amount_minor), terms, proposedBy: terms.proposedBy, at: String(v.at ?? ""), buyerConfirmed: b(v.buyer_confirmed), sellerConfirmed: b(v.seller_confirmed) };
    versions.push({ ...base, changes: changesBetween(versions.at(-1) ?? null, base, fmt) });
  }
  const events: OfferEvent[] = ((Array.isArray(raw.events) ? raw.events : []) as J[]).map((e) => ({
    id: String(e.id),
    at: String(e.at),
    actor: e.actor === "buyer" || e.actor === "seller" ? (e.actor as Side) : "system",
    actorName: s(e.actor_name),
    action: String(e.action),
    note: s(e.note),
    version: n(e.version),
  }));
  const documents = ((Array.isArray(raw.documents) ? raw.documents : []) as J[]).map(documentOf);
  return {
    offer,
    viewerSide: side,
    versions,
    events,
    documents,
    mandate: mandateOf(raw.mandate),
    conversationId: s(raw.conversation_id),
    inspectionId: s(raw.inspection_id),
    buyerEligible: b(raw.buyer_eligible),
    disputed: b(offerRaw.disputed),
    openQuestion: b(offerRaw.open_question),
    next: nextActionOf(offer, documents),
  };
}
