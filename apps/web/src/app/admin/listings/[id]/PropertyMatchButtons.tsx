"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { decidePropertyMatch, reopenClosedListing, splitFromProperty } from "@/lib/landlord/admin-actions";
import type { Dictionary } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

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

  function decide(decision: "join" | "apart") {
    startTransition(async () => {
      try {
        const result = await decidePropertyMatch({ listingId, otherId, decision });
        if (!result.ok) banner.error(result.error, { retry: () => decide(decision) });
        else {
          banner.success(decision === "join" ? "Joined" : "Kept apart");
          router.refresh();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
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
    </div>
  );
}

export function PropertySplitButton({ listingId, label }: { listingId: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();

  function split() {
    startTransition(async () => {
      try {
        const result = await splitFromProperty({ listingId });
        if (!result.ok) banner.error(result.error, { retry: split });
        else {
          banner.success("Split from property");
          router.refresh();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div className="grid gap-2xs">
      <Button
        type="button"
        size="sm"
        variant="dangerQuiet"
        loading={pending}
        onClick={split}
      >
        {label}
      </Button>
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

  function reopen() {
    startTransition(async () => {
      try {
        const result = await reopenClosedListing({ listingId, note });
        if (!result.ok) banner.error(result.error, { retry: reopen });
        else {
          banner.success("Listing reopened");
          router.refresh();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

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
          onClick={reopen}
        >
          {copy.reopen}
        </Button>
      </div>
    </div>
  );
}
