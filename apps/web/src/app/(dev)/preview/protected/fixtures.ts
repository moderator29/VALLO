/* Recorded states for the protected payment screens' preview. Example
   content only: the place, the names and the bank details are not real and
   nothing here is read by any live page. The account number is the
   provider's documentation placeholder shape, ten digits of zeros and ones. */
import type { ArrangementStatus } from "@/lib/money/arrangement-states";
import type { ProtectedDeal } from "@/components/money/protected-rail/types";

export const PREVIEW_NOW = Date.parse("2026-11-10T10:00:00Z");

const base: ProtectedDeal = {
  reference: "VAL-PP-7Q2K9M",
  amountMinor: 180_000_00,
  currency: "NGN",
  category: "shortlet",
  milestone: "check_in",
  place: { title: "Example shortlet, two bedrooms", area: "Lekki Phase 1, Lagos", photo: null },
  payerName: "Example guest",
  payeeName: "Example host",
  dates: "12 to 15 December, check-in from 14:00",
  refundTerms: "Full refund up to 7 days before check-in",
  status: "awaiting_payment",
  transferReported: false,
  funding: {
    bank: "Example Bank",
    accountName: "Example Collection Account",
    accountNumber: "0101010101",
    expiresAt: "2026-11-10T10:24:00Z",
  },
  stamps: { fundedAt: null, releaseRequestedAt: null, releaseConfirmedAt: null, refundConfirmedAt: null },
  lastCheckedAt: "2026-11-10T09:58:00Z",
  links: { agreement: "/preview/protected", receipt: "/preview/protected", help: "/help", how: "/docs" },
};

const funded = { fundedAt: "2026-11-10T09:40:00Z", releaseRequestedAt: null, releaseConfirmedAt: null, refundConfirmedAt: null };

function at(status: ArrangementStatus, over: Partial<ProtectedDeal> = {}): ProtectedDeal {
  return { ...base, status, ...over };
}

export const PREVIEW_DEALS: Record<string, ProtectedDeal> = {
  funding: at("awaiting_payment"),
  "funding-no-expiry": at("awaiting_payment", { funding: { ...base.funding!, expiresAt: null } }),
  waiting: at("awaiting_payment", { transferReported: true }),
  expired: at("awaiting_payment", { funding: { ...base.funding!, expiresAt: "2026-11-10T09:00:00Z" } }),
  protected: at("protected", { stamps: funded }),
  "protected-rent": at("protected", {
    stamps: funded,
    category: "residential_rent",
    milestone: "keys",
    place: { title: "Example two bedroom flat", area: "Yaba, Lagos", photo: null },
    dates: "Move-in 1 January",
    payeeName: "Example landlord",
  }),
  releasing: at("release_requested", { stamps: { ...funded, releaseRequestedAt: "2026-11-12T13:10:00Z" } }),
  released: at("released", {
    stamps: { ...funded, releaseRequestedAt: "2026-11-12T13:10:00Z", releaseConfirmedAt: "2026-11-12T13:40:00Z" },
  }),
  dispute: at("disputed", { stamps: funded }),
  refunding: at("refund_requested", { stamps: funded }),
  refunded: at("refunded", { stamps: { ...funded, refundConfirmedAt: "2026-11-13T09:00:00Z" } }),
  review: at("requires_review", { stamps: funded }),
  failed: at("failed", { funding: null }),
  /* The screens nobody asks for (10 November 2026), each a recorded state. */
  "partner-unavailable": at("protected", {
    stamps: funded,
    issue: { kind: "partner_unavailable", lastConfirmedAt: "2026-11-10T09:41:00Z" },
  }),
  "wrong-amount": at("requires_review", { issue: { kind: "amount_mismatch", receivedMinor: 170_000_00 } }),
  "late-transfer": at("requires_review", { issue: { kind: "late_transfer" } }),
  "duplicate-transfer": at("requires_review", { stamps: funded, issue: { kind: "duplicate_transfer" } }),
  "release-delayed": at("release_requested", {
    stamps: { ...funded, releaseRequestedAt: "2026-11-07T13:10:00Z" },
    issue: { kind: "release_delayed", askedAt: "2026-11-07T13:10:00Z" },
  }),
  "refund-delayed": at("refund_requested", {
    stamps: funded,
    issue: { kind: "refund_delayed", askedAt: "2026-11-07T09:00:00Z" },
    receipt: { providerReference: null, agreementVersion: 3, refundRequestedAt: "2026-11-07T09:00:00Z" },
  }),
  "lister-payout": at("protected", { stamps: funded, listerPayoutMissing: true }),
  "lister-review": at("requires_review", { issue: { kind: "amount_mismatch", receivedMinor: 170_000_00 } }),
  receipt: at("released", {
    stamps: { ...funded, releaseRequestedAt: "2026-11-12T13:10:00Z", releaseConfirmedAt: "2026-11-12T13:40:00Z" },
    receipt: { providerReference: "EXAMPLE-REF-0001", agreementVersion: 3, refundRequestedAt: null },
  }),
};
