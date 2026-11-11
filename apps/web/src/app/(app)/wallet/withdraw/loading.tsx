import { StepFrameSkeleton } from "@/app/(app)/_frame/StepFrameSkeleton";

/**
 * Withdrawing, while it loads (SW12, round 3): the step frame the amount step
 * stands in, not the wallet overview's card, so nothing moves on arrival.
 */
export default function LoadingWalletWithdraw() {
  return <StepFrameSkeleton label="Loading" rows={3} overlay={false} />;
}
