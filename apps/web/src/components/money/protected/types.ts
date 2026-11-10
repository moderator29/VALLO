import type { ArrangementStatus } from "@/lib/money/arrangement-states";
import type { ProtectedCategory } from "@/lib/money/protected-categories";
import type { JourneyStamps, MilestoneKind } from "@/lib/money/protected-journey";

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
};
