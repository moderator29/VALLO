"use client";

import { banner } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { switchEscrowToCard } from "@/lib/money/fund-fallback-actions";
import { PAY_CHOICE_CARD_REVIEW, SWITCH_TO_CARD_LABEL, SWITCH_TO_CARD_LEAD } from "@/lib/money/copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The calm way from the escrow step to card (founder instruction, 13 October
 * 2026): drawn only where card is allowed on this deal. The server withdraws
 * an unfunded escrow at the partner first, then stores card as the payer's
 * choice; nothing is charged until the card checkout.
 */
export function SwitchToCard({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  return (
    <div className="grid gap-xs" data-testid="fund-switch-to-card">
      <p className="nf-caption">{SWITCH_TO_CARD_LEAD}</p>
      <Button
        variant="secondary"
        full
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              const result = await switchEscrowToCard({ agreementId });
              /* Said by the one banner at the top of the screen (Grade 1). */
              if (!result.ok) {
                banner.error(result.error, { "data-testid": "fund-switch-to-card-message" });
                return;
              }
              if (result.data.review) banner.info(PAY_CHOICE_CARD_REVIEW, { "data-testid": "fund-switch-to-card-message" });
              router.push(result.data.next);
            } catch (error) {
              if (!tapFailedOffline(error)) throw error;
            }
          });
        }}
      >
        {SWITCH_TO_CARD_LABEL}
      </Button>
    </div>
  );
}
