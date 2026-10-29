"use client";

import { countOf } from "@vallo/i18n/core";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { confirmListingsAvailable } from "@/lib/agent/freshness-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

export type StillAvailableItem = { id: string; title: string; days: number | null };

/**
 * C5: the weekly "Still available?" card on the agent home. Live listings not
 * confirmed in 14 days, answerable one row at a time or all at once. A let
 * listing is taken down from the listings screen, which the card links to.
 */
export function StillAvailableCard({ items }: { items: StillAvailableItem[] }) {
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const router = useRouter();
  const left = items.filter((i) => !done.includes(i.id));
  if (items.length === 0) return null;

  const confirm = (ids: string[]) =>
    start(async () => {
      setError(null);
      const result = await confirmListingsAvailable({ listingIds: ids });
      if (!result.ok) setError(result.error);
      else {
        setDone((prev) => [...prev, ...ids]);
        router.refresh();
      }
    });

  return (
    <section className="nf-panel nf-panel--card p-card" data-testid="still-available-card" aria-labelledby="still-available-title">
      <h2 id="still-available-title" className="nf-h3">
        Still available?
      </h2>
      {left.length === 0 ? (
        <p className="nf-body mt-2xs" role="status">
          Thank you. Renters see these are current.
        </p>
      ) : (
        <>
          <p className="nf-body-sm mt-2xs text-[var(--nf-content-secondary)]">
            {countOf(left.length, "liveListingsHave", "en")} not been confirmed in two
            weeks. Confirm the ones still open; take down the ones that have gone.
          </p>
          <div className="mt-row">
            <ListGroup>
              {left.slice(0, 8).map((item) => (
                <ListRow
                  key={item.id}
                  title={item.title}
                  sub={item.days === null ? "Never confirmed" : `Last confirmed ${item.days} days ago`}
                  trailing={
                    <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => confirm([item.id])}>
                      Still available
                    </Button>
                  }
                />
              ))}
            </ListGroup>
          </div>
          <div className="mt-row flex flex-wrap gap-xs">
            <Button type="button" variant="primary" size="md" loading={pending} onClick={() => confirm(left.map((i) => i.id))}>
              All still available
            </Button>
            <Button type="button" variant="quiet" size="md" onClick={() => router.push("/agent/listings")}>
              Take some down
            </Button>
          </div>
        </>
      )}
      {error ? (
        <p className="nf-caption mt-2xs" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
