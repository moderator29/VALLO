"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { retireExampleListings } from "@/lib/admin/payments-actions";
import type { ExampleListingView } from "@/lib/admin/examples-queries";
import { countOf } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * Taking the example properties off the catalogue.
 *
 * WHAT IT DOES, SAID BEFORE IT DOES IT. Retiring sets the listing's status to
 * SUSPENDED. The row stays exactly where it is, the catalogue and the map stop
 * returning it because `listings_select_published` only publishes PUBLISHED
 * rows, and putting one back is a status change rather than a restore from
 * backup. The confirmation says that in those words, because "retire" on its
 * own could reasonably be read as a delete and an operator should not have to
 * guess which one they are about to do.
 *
 * It is still shown as a count, a city breakdown and a named list before it
 * runs. Forty-two rows disappearing from the public catalogue is a change
 * anybody would want to have seen described first, even though it is reversible.
 *
 * No money moves here, so there is no amount and no counterparty to name. The
 * rule that a money movement states both is not weakened by this screen; it
 * simply is not a money movement.
 */
export function RetireExamples({ live }: { live: ExampleListingView[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useSafeTransition();

  const cities = new Set(
    live.map((listing) => listing.city).filter((city): city is string => !!city),
  );

  function run() {
    setError(null);
    start(async () => {
      const result = await retireExampleListings({
        listingIds: live.map((listing) => listing.id),
      });
      if (!result.ok) {
        setError(result.fieldErrors?.["listingIds"] ?? result.error);
        return;
      }
      setConfirming(false);
      setDone(result.data.retired);
      router.refresh();
    });
  }

  if (live.length === 0) {
    return (
      <div className="nf-panel nf-panel--card nf-admin-card p-card">
        <p className="nf-body font-semibold text-content">
          Every example is already off the catalogue.
        </p>
        <p className="nf-body-sm mt-row text-content-2">
          Nothing seeded is visible to the public. The rows are still here, so
          any of them can be published again if the catalogue needs filling out.
        </p>
      </div>
    );
  }

  return (
    <div className="nf-panel nf-panel--card nf-admin-card p-card">
      <p className="nf-h4">Retire the whole example set</p>
      <p className="nf-body-sm mt-row max-w-[68ch] text-content-2">
        The seeded properties exist so the catalogue is not empty while real
        supply arrives. The day it does, they should go, and they should go
        together rather than one at a time.
      </p>

      {!confirming && (
        <div className="mt-group">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDone(null);
              setConfirming(true);
            }}
          >
            {/* One string, not a text node and an expression. `.nf-btn` is a
                flex row with a gap, so two children put the gap AND the
                literal space between the words: the button read
                "Review  all 2 examples". */}
            {countOf(live.length, "reviewExamples")}
          </Button>
        </div>
      )}

      {/*
        ROSE, NOT THE PENDING CYAN, on the panel below. `--nf-state-warning`
        resolves to `--nf-cyan-400`, which is the token `--nf-status-pending`
        is defined as, so this panel asked "are you sure" in the colour the
        product reserves for "still going through". Nothing here is in flight:
        it is a confirmation for an action that takes rows off the public
        catalogue, and the button inside it is already `danger`.
      */}
      {confirming && (
        <div className="mt-group rounded-[var(--nf-radius-md)] border border-[color-mix(in_oklab,var(--nf-state-error)_45%,transparent)] p-card-sm">
          <p className="nf-body font-semibold text-content">
            This will take {countOf(live.length, "exampleProperties")}
            {cities.size > 0 &&
              ` across ${countOf(cities.size, "cities")}`}{" "}
            off the public catalogue.
          </p>
          <p className="nf-body-sm mt-row text-content-2">
            Each one is set to suspended. Nothing is deleted, search and the map
            stop returning them, and any of them can be published again later.
            No real listing is touched: the database matches on the example flag
            itself, not on this list.
          </p>

          <ul className="nf-rows mt-group max-h-[18rem] overflow-y-auto">
            {live.map((listing) => (
              <li key={listing.id} className="nf-row">
                <span className="min-w-0 flex-1">
                  <span className="nf-body-sm block font-semibold text-content">
                    {listing.title}
                  </span>
                  <span className="nf-caption block truncate">
                    {listing.city ?? "City not recorded"}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-group flex flex-wrap gap-inline">
            <Button type="button" variant="danger" loading={pending} onClick={run}>
              {`Retire ${countOf(live.length, "examples")}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="nf-body-sm mt-row font-semibold text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
      {done !== null && (
        <p className="nf-body-sm mt-row font-semibold text-[var(--nf-state-success)]">
          {done === 0
            ? "Nothing changed. They were already off the catalogue."
            : `${countOf(done, "examplesAre")} off the catalogue, with your name on the record.`}
        </p>
      )}
    </div>
  );
}
