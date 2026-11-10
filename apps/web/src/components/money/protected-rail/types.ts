import type { ArrangementStatus } from "@/lib/money/arrangement-states";
import type { ProtectedCategory } from "@/lib/money/protected-categories";
import type { JourneyStamps, MilestoneKind, ProtectedStage } from "@/lib/money/protected-journey";
import type { ProtectedIssue } from "./issues";

/**
 * One protected payment as the screens read it. Every field comes from the
 * server: the agreement, the arrangement row Vallo recorded from the
 * provider's own report, and the provider's funding instructions. Nothing
 * here is decided in the browser.
 */
export type ProtectedDeal = {
  /** Vallo's own reference for the payment. */
  reference: string;
  amountMinor: number;
  currency: "NGN";
  category: ProtectedCategory;
  milestone: MilestoneKind;
  place: { title: string; area: string; photo?: string | null };
  payerName: string;
  payeeName: string;
  /** The deal's dates, already worded ("12 to 15 December"), or null. */
  dates: string | null;
  /** One line on refunds, from the agreement. */
  refundTerms: string;
  status: ArrangementStatus;
  transferReported: boolean;
  /** The provider's instructions, or null until it returns them. */
  funding: {
    bank: string;
    accountName: string;
    accountNumber: string;
    expiresAt: string | null;
  } | null;
  stamps: JourneyStamps;
  /** When Vallo last read the provider's state, ISO, or null. */
  lastCheckedAt: string | null;
  links: { agreement: string; receipt: string | null; help: string; how: string };
  /**
   * One of the screens nobody asks for (`issues.ts`), read from the recorded
   * state, or absent. Drawn in place of the ordinary screen for the state.
   */
  issue?: ProtectedIssue | null;
  /** The lister has no payout account on Vallo (read under their own session). */
  listerPayoutMissing?: boolean;
  /** The partner mark beside the pay button: `partnerMarkReady` and `protected_partner_mark_on`, read on the server. */
  partnerMark?: boolean;
  /** What the receipt adds for a protected payment (BUILD 7.4). */
  receipt?: {
    providerReference: string | null;
    agreementVersion: number | null;
    refundRequestedAt: string | null;
  } | null;
};

/** One protected payment as a list row (payments, receipts). */
export type ProtectedPaymentSummary = {
  agreementId: string;
  reference: string;
  amountMinor: number;
  stage: ProtectedStage;
  title: string;
  role: "payer" | "lister";
  /** The latest recorded moment, ISO. */
  at: string;
  href: string;
};
