"use client";

import { banner } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { DragToConfirm } from "@/components/ui/DragToConfirm";
import { fundEscrowPayment } from "@/lib/money/fund-actions";
import { FUND_ARMED_LABEL, FUND_CONFIRMED_LABEL, FUND_CONFIRMING_LABEL, FUND_SWIPE_LABEL } from "@/lib/money/copy";

/**
 * Step 7: the renter's money swipe into escrow (it never auto-resets). The
 * server refuses anything the database would; on success the held screen
 * takes over, where Payluk's webhook turns "on its way" into "held".
 */
export function FundControl({ agreementId, amountLabel }: { agreementId: string; amountLabel: string }) {
  const router = useRouter();
  return (
    <div className="grid gap-sm" data-testid="fund-swipe">
      <DragToConfirm
        money
        label={`${FUND_SWIPE_LABEL}: ${amountLabel}`}
        armedLabel={FUND_ARMED_LABEL}
        confirmingLabel={FUND_CONFIRMING_LABEL}
        confirmedLabel={FUND_CONFIRMED_LABEL}
        errorLabel="The payment did not go through. Nothing has been taken."
        onConfirm={async () => {
          const result = await fundEscrowPayment({ agreementId });
          if (!result.ok) {
            banner.error(result.error);
            return false;
          }
          router.push(result.data.next);
          return true;
        }}
      />
    </div>
  );
}
