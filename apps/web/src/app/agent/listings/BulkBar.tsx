"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { submitListing, unpublishListing } from "@/lib/agent/listings-actions";
import { confirmListingsAvailable } from "@/lib/agent/freshness-actions";
import { bulkSummary, type BulkPlan } from "./bulk";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * C5: the bar that appears while listings are selected. Every action loops
 * through the per-listing server action one listing at a time, so each guard
 * and audit row is what one tap would have made; "Still available" is one
 * call. Take down asks for a second press, as a single take down does in its
 * sheet. It says what happened, including what could not be done and why.
 */
export function BulkBar({ plan, count, onClear }: { plan: BulkPlan; count: number; onClear: () => void }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loop = (ids: string[], act: (id: string) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      let done = 0;
      const failures: string[] = [];
      for (const id of ids) {
        const result = await act(id);
        if (result.ok) done += 1;
        else failures.push(result.error ?? "That did not go through.");
      }
      setMessage(bulkSummary(done, failures));
      setArmed(false);
      onClear();
      router.refresh();
    });

  return (
    <div
      className="nf-panel nf-panel--card sticky bottom-[calc(var(--nf-tabbar-clearance)+var(--nf-space-xs))] z-10 mt-block p-card-sm lg:bottom-md"
      role="region"
      aria-label="Selected listings"
      data-testid="bulk-bar"
    >
      <p className="nf-body-sm font-semibold" aria-live="polite">
        {count} selected
      </p>
      <div className="mt-xs flex flex-wrap gap-xs">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || plan.confirm.length === 0}
          onClick={() =>
            start(async () => {
              const result = await confirmListingsAvailable({ listingIds: plan.confirm });
              setMessage(result.ok ? bulkSummary(result.data.confirmed, []) : result.error);
              if (result.ok) {
                onClear();
                router.refresh();
              }
            })
          }
        >
          Still available ({plan.confirm.length})
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending || plan.submit.length === 0}
          onClick={() => loop(plan.submit, (listingId) => submitListing({ listingId }))}
        >
          Send for review ({plan.submit.length})
        </Button>
        <Button
          type="button"
          variant={armed ? "danger" : "secondary"}
          size="sm"
          disabled={pending || plan.takeDown.length === 0}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            loop(plan.takeDown, (listingId) => unpublishListing({ listingId }));
          }}
        >
          {armed ? `Press again to take down ${plan.takeDown.length}` : `Take down (${plan.takeDown.length})`}
        </Button>
        <Button type="button" variant="quiet" size="sm" disabled={pending} onClick={onClear}>
          Clear
        </Button>
      </div>
      {plan.takeDown.length === 0 && plan.confirm.length > 0 ? (
        <p className="nf-caption mt-2xs">A live rental is closed with a reason, one at a time, from its own row.</p>
      ) : null}
      {message ? (
        <p className="nf-caption mt-2xs" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
