import { FIXTURE_NOW } from "@/lib/offers/fixtures";
import { ROOM_AGREED_BUYER, FIXTURE_MANDATE } from "@/lib/offers/fixtures";
import type { AdminDeal, AdminOfferRow, OffersOverview } from "./model";

/** Invented rows for the preview harness only. */
export const ADMIN_NOW = FIXTURE_NOW;

const base: AdminOfferRow = {
  id: "off-a1",
  reference: "OFR-A1",
  listingId: "lst-oniru-1",
  listingTitle: "Four bedroom duplex in Oniru, Lagos",
  buyerName: "Seyi Omojuni",
  sellerName: "Tunde Adebayo",
  agentName: null,
  askingMinor: 85_000_000_00,
  amountMinor: 80_000_000_00,
  state: "open",
  stage: "negotiating",
  version: 1,
  paymentPreference: "cash",
  submittedAt: "2026-11-08T09:30:00.000Z",
  lastActivityAt: "2026-11-09T16:10:00.000Z",
  expiresAt: null,
  disputed: false,
  caseId: null,
  mandateHeld: true,
};

export const ADMIN_ROWS: AdminOfferRow[] = [
  base,
  { ...base, id: "off-a2", reference: "OFR-A2", listingTitle: "Three bedroom flat in Lekki Phase 1", buyerName: "Ngozi Eze", sellerName: "Amina Bello", agentName: "Kunle Bakare", amountMinor: 62_000_000_00, askingMinor: 60_000_000_00, version: 3, paymentPreference: "mortgage" },
  { ...base, id: "off-a3", reference: "OFR-A3", listingTitle: "Land, 600 sqm, Ibeju-Lekki", buyerName: "Chidi Okafor", sellerName: "Ife Adeyemi", agentName: "Kunle Bakare", amountMinor: 18_000_000_00, askingMinor: 18_000_000_00, state: "agreed", stage: "due_diligence", version: 2, paymentPreference: "instalment" },
  { ...base, id: "off-a4", reference: "OFR-A4", listingTitle: "Terrace in Ikoyi", buyerName: "Bola Ajayi", sellerName: "Tunde Adebayo", amountMinor: 140_000_000_00, askingMinor: 150_000_000_00, state: "agreed", stage: "documentation", version: 4, disputed: true, caseId: "case-77", mandateHeld: false },
  { ...base, id: "off-a5", reference: "OFR-A5", listingTitle: "Two bedroom flat in Yaba", buyerName: "Sade Williams", sellerName: "Amina Bello", amountMinor: 30_000_000_00, askingMinor: 35_000_000_00, state: "declined" },
  { ...base, id: "off-a6", reference: "OFR-A6", listingTitle: "Bungalow in Abeokuta", buyerName: "Femi Coker", sellerName: "Ife Adeyemi", amountMinor: 22_000_000_00, askingMinor: 25_000_000_00, state: "expired", expiresAt: "2026-11-05T12:00:00.000Z" },
  { ...base, id: "off-a7", reference: "OFR-A7", listingTitle: "Duplex in Gwarinpa", buyerName: "Hadiza Musa", sellerName: "Tunde Adebayo", amountMinor: 55_000_000_00, askingMinor: 55_000_000_00, state: "withdrawn", paymentPreference: "mortgage" },
];

export const ADMIN_OVERVIEW: OffersOverview = {
  windowDays: 30,
  counts: { submitted: 41, new: 6, awaiting_seller: 14, negotiating: 9, agreed: 7, withdrawn: 4, expired: 5, completed: 2, disputed: 1 },
  medianResponseHours: 19,
  acceptance: { agreed: 7, answered: 22 },
};

export const ADMIN_DEAL: AdminDeal = {
  row: ADMIN_ROWS[3]!,
  versions: ROOM_AGREED_BUYER.versions,
  events: ROOM_AGREED_BUYER.events,
  documents: ROOM_AGREED_BUYER.documents,
  mandate: { ...FIXTURE_MANDATE, held: false, reviewedOn: null, expiresOn: null },
  buyerEligible: true,
};
