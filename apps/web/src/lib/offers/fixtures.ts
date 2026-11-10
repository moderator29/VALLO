import type { OfferGate, OfferCounts } from "./queries";
import { differenceOf } from "./format";
import type {
  DealDocument,
  DealRoom,
  DealStage,
  Eligibility,
  MandateLine,
  OfferEvent,
  OfferRow,
  OfferState,
  OfferVersion,
  PriceBlock,
  Side,
} from "./types";

/**
 * TYPED FIXTURES FOR EVERY OFFER STATE. Invented names and invented figures,
 * used only by the preview harness (`app/(dev)/preview/offers`) and by tests.
 * They prove the LOOK of a screen, never a number. Nothing here reads a
 * database, and nothing in the product imports this file.
 */

export const FIXTURE_NOW = "2026-11-10T10:00:00.000Z";
export const FIXTURE_NOW_MS = Date.parse(FIXTURE_NOW);

const ASKING = 85_000_000_00; // kobo: N85,000,000

export const FIXTURE_PRICE_COMPLETE: PriceBlock = {
  askingMinor: ASKING,
  costs: [
    { label: "Survey plan fee", amountMinor: 350_000_00, basis: "confirmed" },
    { label: "Legal fees (your own solicitor)", amountMinor: 1_700_000_00, basis: "estimated" },
    { label: "Stamp duty", amountMinor: 850_000_00, basis: "paid_to_third_party" },
    { label: "Furniture package", amountMinor: 2_000_000_00, basis: "optional" },
  ],
  totalIsComplete: true,
  totalMinor: ASKING + 350_000_00 + 1_700_000_00 + 850_000_00,
};

export const FIXTURE_PRICE_PARTIAL: PriceBlock = {
  askingMinor: ASKING,
  costs: [{ label: "Survey plan fee", amountMinor: 350_000_00, basis: "confirmed" }],
  totalIsComplete: false,
  totalMinor: null,
};

export const FIXTURE_PRICE_BARE: PriceBlock = { askingMinor: ASKING, costs: [], totalIsComplete: false, totalMinor: null };

export const FIXTURE_MANDATE: MandateLine = { held: true, reviewedOn: "2026-09-14", expiresOn: "2027-09-13" };
export const FIXTURE_NO_MANDATE: MandateLine = { held: false, reviewedOn: null, expiresOn: null };

export const FIXTURE_ELIGIBLE: Eligibility = {
  eligible: true,
  requirements: [
    { key: "government_id", label: "Government ID", state: "met", fixHref: null },
    { key: "minimum_age", label: "Minimum age 18+", state: "met", fixHref: null },
  ],
};

export const FIXTURE_BLOCKED: Eligibility = {
  eligible: false,
  requirements: [
    { key: "government_id", label: "Government ID", state: "required", fixHref: "/verification" },
    { key: "minimum_age", label: "Minimum age 18+", state: "required", fixHref: "/verification" },
    { key: "phone", label: "Phone number", state: "in_progress", fixHref: "/settings/phone" },
  ],
};

export const FIXTURE_REVIEW: Eligibility = {
  eligible: false,
  requirements: [
    { key: "government_id", label: "Government ID", state: "needs_review", fixHref: null },
    { key: "minimum_age", label: "Minimum age 18+", state: "met", fixHref: null },
  ],
};

export function gate(over: Partial<OfferGate> = {}): OfferGate {
  return {
    listingId: "lst-oniru-1",
    listingTitle: "Four bedroom duplex in Oniru, Lagos",
    price: FIXTURE_PRICE_PARTIAL,
    eligibility: FIXTURE_ELIGIBLE,
    mandate: FIXTURE_MANDATE,
    canOffer: true,
    reason: null,
    viewerSide: "none",
    existingOfferId: null,
    ...over,
  };
}

export const FIXTURE_GATE_BLOCKED = gate({ eligibility: FIXTURE_BLOCKED, canOffer: false, reason: "Finish the requirements below to send an offer." });
export const FIXTURE_GATE_OWN = gate({ canOffer: false, reason: "You cannot make an offer on your own listing.", viewerSide: "seller" });
export const FIXTURE_GATE_EXISTING = gate({ canOffer: false, reason: "You already have an open offer on this property.", existingOfferId: "off-open" });

/* ------------------------------------------------------------------- rows */

type RowOver = Partial<OfferRow> & { id: string };

function row(over: RowOver): OfferRow {
  const amountMinor = over.amountMinor ?? ASKING;
  const askingMinor = over.askingMinor ?? ASKING;
  const diff = differenceOf(amountMinor, askingMinor);
  return {
    reference: `OFR-${over.id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`,
    listingId: "lst-oniru-1",
    listingTitle: "Four bedroom duplex in Oniru, Lagos",
    listingThumb: null,
    askingMinor,
    amountMinor,
    differenceMinor: diff.minor,
    differencePct: diff.pct,
    state: "open",
    stage: "negotiating",
    turn: "seller",
    viewerSide: "buyer",
    counterpartyName: "Tunde Adebayo",
    paymentPreference: "cash",
    targetClosing: "2026-12-15",
    submittedAt: "2026-11-08T09:30:00.000Z",
    lastActivityAt: "2026-11-09T16:10:00.000Z",
    expiresAt: null,
    unread: false,
    version: 1,
    ...over,
  };
}

export const ROW_OPEN_WITH_SELLER = row({ id: "off-open", amountMinor: 80_000_000_00, turn: "seller", version: 1, unread: false });
export const ROW_AWAITING_BUYER = row({ id: "off-counter", amountMinor: 82_500_000_00, turn: "buyer", version: 2, unread: true, paymentPreference: "mortgage", expiresAt: "2026-11-14T12:00:00.000Z" });
export const ROW_AGREED = row({ id: "off-agreed", amountMinor: 83_000_000_00, state: "agreed", stage: "due_diligence", turn: null, version: 3, paymentPreference: "mortgage" });
export const ROW_DECLINED = row({ id: "off-declined", amountMinor: 60_000_000_00, state: "declined", stage: "negotiating", turn: null });
export const ROW_WITHDRAWN = row({ id: "off-withdrawn", amountMinor: 79_000_000_00, state: "withdrawn", stage: "negotiating", turn: null, paymentPreference: "instalment" });
export const ROW_EXPIRED = row({ id: "off-expired", amountMinor: 85_000_000_00, state: "expired", stage: "offer", turn: null, expiresAt: "2026-11-05T12:00:00.000Z" });
export const ROW_CANCELLED = row({ id: "off-cancelled", amountMinor: 85_500_000_00, state: "cancelled", stage: "agreed", turn: null });
export const ROW_ABOVE = row({ id: "off-above", amountMinor: 87_000_000_00, turn: "seller" });

export const BUYER_ROWS: OfferRow[] = [ROW_AWAITING_BUYER, ROW_OPEN_WITH_SELLER, ROW_AGREED, ROW_DECLINED, ROW_WITHDRAWN, ROW_EXPIRED];

function asSeller(r: OfferRow, name: string, over: Partial<OfferRow> = {}): OfferRow {
  return { ...r, viewerSide: "seller", counterpartyName: name, turn: r.turn === "seller" ? "seller" : r.turn === "buyer" ? "buyer" : null, ...over };
}

export const SELLER_ROWS: OfferRow[] = [
  asSeller(ROW_OPEN_WITH_SELLER, "Ngozi Eze", { id: "off-s1", reference: "OFR-S1", unread: true }),
  asSeller(ROW_ABOVE, "Chidi Okafor", { id: "off-s2", reference: "OFR-S2", paymentPreference: "instalment" }),
  asSeller(ROW_AWAITING_BUYER, "Amina Bello", { id: "off-s3", reference: "OFR-S3", unread: false }),
  asSeller(ROW_AGREED, "Ife Adeyemi", { id: "off-s4", reference: "OFR-S4" }),
  asSeller(ROW_DECLINED, "Kunle Bakare", { id: "off-s5", reference: "OFR-S5" }),
];

export function countsFor(rows: OfferRow[], viewerTurn: Side): OfferCounts {
  const counts: OfferCounts = { all: 0, awaiting_you: 0, open: 0, agreed: 0, declined: 0, withdrawn: 0, expired: 0, cancelled: 0 };
  for (const r of rows) {
    counts.all += 1;
    counts[r.state as OfferState] += 1;
    if (r.state === "open" && r.turn === viewerTurn) counts.awaiting_you += 1;
  }
  return counts;
}

/* ------------------------------------------------------------- deal rooms */

function version(n: number, amountMinor: number, by: Side, at: string, changes: string[], buyer: boolean, seller: boolean, pay: "cash" | "mortgage" | "instalment" = "cash"): OfferVersion {
  return {
    version: n,
    amountMinor,
    terms: { paymentPreference: pay, proposedBy: by, atAskingPrice: amountMinor === ASKING, targetClosing: "2026-12-15", note: n === 1 ? "I have viewed the property twice and would like to move quickly." : null },
    proposedBy: by,
    at,
    changes,
    buyerConfirmed: buyer,
    sellerConfirmed: seller,
  };
}

const VERSIONS_3: OfferVersion[] = [
  version(1, 78_000_000_00, "buyer", "2026-11-06T09:30:00.000Z", [], false, false),
  version(2, 84_000_000_00, "seller", "2026-11-07T11:00:00.000Z", ["Amount changed from ₦78,000,000 to ₦84,000,000"], false, false),
  version(3, 83_000_000_00, "buyer", "2026-11-08T08:45:00.000Z", ["Amount changed from ₦84,000,000 to ₦83,000,000", "Payment changed from Cash to Mortgage"], true, true, "mortgage"),
];

const EVENTS: OfferEvent[] = [
  { id: "e1", at: "2026-11-06T09:30:00.000Z", actor: "buyer", actorName: "Seyi Omojuni", action: "submitted", note: null, version: 1 },
  { id: "e2", at: "2026-11-07T11:00:00.000Z", actor: "seller", actorName: "Tunde Adebayo", action: "countered", note: "Closer to the asking price, please.", version: 2 },
  { id: "e3", at: "2026-11-08T08:45:00.000Z", actor: "buyer", actorName: "Seyi Omojuni", action: "countered", note: null, version: 3 },
  { id: "e4", at: "2026-11-08T14:20:00.000Z", actor: "seller", actorName: "Tunde Adebayo", action: "confirmed", note: null, version: 3 },
];

export const FIXTURE_DOCUMENTS: DealDocument[] = [
  { id: "d1", category: "certificate_of_occupancy", state: "approved", uploadedByName: "Tunde Adebayo", uploadedAt: "2026-11-09T09:00:00.000Z", version: 1, reviewedByName: "Seyi Omojuni", reviewedAt: "2026-11-09T12:00:00.000Z", note: null },
  { id: "d2", category: "deed_of_assignment", state: "uploaded", uploadedByName: "Tunde Adebayo", uploadedAt: "2026-11-09T09:05:00.000Z", version: 1, reviewedByName: null, reviewedAt: null, note: null },
  { id: "d3", category: "survey_plan", state: "under_review", uploadedByName: "Tunde Adebayo", uploadedAt: "2026-11-09T09:10:00.000Z", version: 2, reviewedByName: null, reviewedAt: null, note: null },
  { id: "d4", category: "building_approval", state: "rejected", uploadedByName: "Tunde Adebayo", uploadedAt: "2026-11-09T09:15:00.000Z", version: 1, reviewedByName: "Seyi Omojuni", reviewedAt: "2026-11-09T13:00:00.000Z", note: "The copy is cut off at the edge. Please upload the whole page." },
  { id: "d5", category: "governors_consent", state: "more_information", uploadedByName: "Tunde Adebayo", uploadedAt: "2026-11-09T09:20:00.000Z", version: 1, reviewedByName: "Seyi Omojuni", reviewedAt: "2026-11-09T13:10:00.000Z", note: "Which registry issued this?" },
  { id: "d6", category: "agent_authorisation", state: "requested", uploadedByName: null, uploadedAt: null, version: 1, reviewedByName: null, reviewedAt: null, note: null },
];

function room(r: OfferRow, over: Partial<DealRoom> = {}): DealRoom {
  return {
    offer: r,
    viewerSide: r.viewerSide,
    versions: VERSIONS_3.slice(0, Math.max(1, r.version)),
    events: EVENTS.slice(0, Math.max(1, r.version + 1)),
    documents: [],
    mandate: FIXTURE_MANDATE,
    conversationId: "conv-1",
    inspectionId: null,
    buyerEligible: true,
    next: null,
    ...over,
  };
}

export const ROOM_BUYER_WAITING = room(ROW_OPEN_WITH_SELLER, {
  next: { kind: "wait", label: "Waiting for the seller", detail: "The seller has your offer. You will be told when they answer." },
});

export const ROOM_BUYER_COUNTER = room(ROW_AWAITING_BUYER, {
  next: { kind: "accept_counter", label: "Review the counteroffer", detail: "The seller proposed ₦82,500,000. Accepting confirms this exact version." },
});

export const ROOM_SELLER_RESPOND = room(asSeller(ROW_OPEN_WITH_SELLER, "Ngozi Eze", { id: "off-s1", reference: "OFR-S1", unread: true }), {
  next: { kind: "respond", label: "Respond to this offer", detail: "Accept, decline, counter or ask a question." },
});

export const ROOM_AGREED_BUYER = room(ROW_AGREED, {
  versions: VERSIONS_3,
  events: EVENTS,
  documents: FIXTURE_DOCUMENTS,
  inspectionId: "insp-1",
  next: { kind: "schedule_inspection", label: "Schedule the inspection", detail: "Terms are agreed. Inspect the property before you go further." },
});

export const ROOM_AGREED_SELLER = room(asSeller(ROW_AGREED, "Seyi Omojuni", { id: "off-s4", reference: "OFR-S4" }), {
  versions: VERSIONS_3,
  events: EVENTS,
  documents: FIXTURE_DOCUMENTS,
  next: { kind: "upload_document", label: "Upload the requested document", detail: "The buyer asked for the agent's authority to sell." },
});

export const ROOM_DECLINED = room(ROW_DECLINED, { next: null });
export const ROOM_WITHDRAWN = room(ROW_WITHDRAWN, { next: null });
export const ROOM_EXPIRED = room(ROW_EXPIRED, { next: null });
export const ROOM_CANCELLED = room(ROW_CANCELLED, { next: null });

export const ROOMS_BY_STATE: Record<OfferState, DealRoom> = {
  open: ROOM_BUYER_WAITING,
  agreed: ROOM_AGREED_BUYER,
  declined: ROOM_DECLINED,
  withdrawn: ROOM_WITHDRAWN,
  expired: ROOM_EXPIRED,
  cancelled: ROOM_CANCELLED,
};

export const STAGES_IN_ORDER: readonly DealStage[] = ["offer", "negotiating", "agreed", "due_diligence", "documentation", "closing", "completed"];
