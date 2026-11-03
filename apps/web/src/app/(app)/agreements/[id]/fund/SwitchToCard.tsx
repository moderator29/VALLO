"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { switchEscrowToCard } from "@/lib/money/fund-fallback-actions";
import { PAY_CHOICE_CARD_REVIEW, SWITCH_TO_CARD_LABEL, SWITCH_TO_CARD_LEAD } from "@/lib/money/copy";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * The calm way from the escrow step to card (founder instruction, 13 October
 * 2026): drawn only where card is allowed on this deal. The server withdraws
 * an unfunded escrow at the partner first, then stores card as the payer's
 * choice; nothing is charged until the card checkout.
 */
export function SwitchToCard({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="grid gap-xs" data-testid="fund-switch-to-card">
      <p className="nf-caption">{SWITCH_TO_CARD_LEAD}</p>
      <Button
        variant="secondary"
        full
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              const result = await switchEscrowToCard({ agreementId });
              if (!result.ok) {
                setMessage(result.error);
                return;
              }
              if (result.data.review) setMessage(PAY_CHOICE_CARD_REVIEW);
              router.push(result.data.next);
            } catch (error) {
              if (!tapFailedOffline(error)) throw error;
            }
          });
        }}
      >
        {SWITCH_TO_CARD_LABEL}
      </Button>
      {message ? (
        <p role="status" className="nf-caption" data-testid="fund-switch-to-card-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
