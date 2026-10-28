"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { decidePropertyMatch, reopenClosedListing, splitFromProperty } from "@/lib/landlord/admin-actions";
import type { Dictionary } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * V-37. The reviewer's one-tap decision on a proposed match: "Same property"
 * joins the two listings on one property, "Not the same" records the pair as
 * kept apart so it is never proposed again, and "Take this listing off the
 * property" undoes a join. Each writes its own audit row in the database.
 */
export function PropertyMatchButtons({
  listingId,
  otherId,
  labels,
}: {
  listingId: string;
  otherId: string;
  labels: { join: string; apart: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "join" | "apart") {
    setError(null);
    startTransition(async () => {
      const result = await decidePropertyMatch({ listingId, otherId, decision });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-2xs">
      <div className="flex flex-wrap gap-sm">
        <Button type="button" size="sm" variant="primary" loading={pending} onClick={() => decide("join")} data-testid="property-join">
          {labels.join}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => decide("apart")} data-testid="property-apart">
          {labels.apart}
        </Button>
      </div>
      {error && (
        <p role="alert" className="nf-rv-msg" style={{ color: "var(--nf-state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function PropertySplitButton({ listingId, label }: { listingId: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2xs">
      <Button
        type="button"
        size="sm"
        variant="dangerQuiet"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await splitFromProperty({ listingId });
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {label}
      </Button>
      {error && (
        <p role="alert" className="nf-rv-msg" style={{ color: "var(--nf-state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * V-48: staff reopen a listing closed by mistake. A reason is required and is
 * written to the audit log with the reopen; nothing else can bring a closed
 * listing back.
 */
export function ReopenControl({ listingId, copy }: { listingId: string; copy: Dictionary["landlord"]["admin"] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-sm grid gap-xs">
      <label className="nf-label" htmlFor={`reopen-${listingId}`}>
        {copy.reopenLabel}
      </label>
      <textarea
        id={`reopen-${listingId}`}
        className="nf-field"
        rows={2}
        maxLength={400}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={pending}
          disabled={note.trim().length < 8}
          onClick={() =>
            startTransition(async () => {
              const result = await reopenClosedListing({ listingId, note });
              if (!result.ok) setError(result.error);
              else router.refresh();
            })
          }
        >
          {copy.reopen}
        </Button>
      </div>
      {error && (
        <p role="alert" className="nf-rv-msg" style={{ color: "var(--nf-state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
