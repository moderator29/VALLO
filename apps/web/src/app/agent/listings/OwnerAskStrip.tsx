"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { answerOwnerHeartbeat } from "@/lib/landlord/close-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * V-31 FOR A LISTING ITS OWNER PUT UP: "Is this still available?"
 *
 * The owner is the principal, so the fortnightly question comes to them here
 * and by notification rather than by SMS. "Yes" stops the 21 day clock; "It has
 * been let" opens the same close sheet every rental closes through, so a let is
 * always an event with a reason. The strip says what the answer does and
 * nothing it does not: an owner's own "yes" is not shown to renters as "Owner
 * confirmed" until staff have checked the ownership document.
 */
export function OwnerAskStrip({
  listingId,
  copy,
  onLet,
}: {
  listingId: string;
  copy: Dictionary["landlord"]["owner"];
  onLet: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  const [state, setState] = useState<"ask" | "done" | "failed">("ask");

  if (state === "done") {
    return (
      <p role="status" className="border-t border-[var(--nf-border-subtle)] px-md py-sm text-[length:var(--nf-text-caption)] text-[var(--nf-state-success)]">
        {copy.thanks}
      </p>
    );
  }

  return (
    <div className="border-t border-[var(--nf-border-subtle)] px-md py-sm" data-testid="owner-ask">
      <p className="text-[length:var(--nf-text-body-sm)] font-semibold">{copy.prompt}</p>
      <p className="mt-2xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">{copy.body}</p>
      <div className="mt-sm flex flex-wrap gap-sm">
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={pending}
          data-testid="owner-ask-yes"
          onClick={() =>
            startTransition(async () => {
              const result = await answerOwnerHeartbeat({ listingId });
              if (!result.ok) {
                setState("failed");
                return;
              }
              setState("done");
              router.refresh();
            })
          }
        >
          {copy.yes}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onLet}>
          {copy.let}
        </Button>
      </div>
      {state === "failed" && (
        <p role="alert" className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-state-error)]">
          {copy.failed}
        </p>
      )}
    </div>
  );
}
