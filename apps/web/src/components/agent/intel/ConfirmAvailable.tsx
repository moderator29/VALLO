"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { confirmListingsAvailable } from "@/lib/agent/freshness-actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * "STILL AVAILABLE", FOR ONE LISTING, FROM ITS HEALTH PAGE (C5's action).
 *
 * The same server action the weekly card on the agent home calls
 * (`confirmListingsAvailable`), which writes the lister's own confirmation
 * through `lister_confirm_available` and ignores any id that is not the
 * caller's live listing. Nothing here decides anything: the button sends,
 * and the page re-reads, so the availability row turns to "In place" only
 * once the database has the new date.
 *
 * The button morphs (loading ring, then the tick) because this is the one
 * deliberate action on the page; the result is said in words beneath it in
 * a polite live region, and a failure says nothing changed.
 */
export function ConfirmAvailable({
  listingId,
  label,
  done,
  failed,
}: {
  listingId: string;
  label: string;
  done: string;
  failed: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  const confirm = () =>
    start(async () => {
      try {
        const result = await confirmListingsAvailable({ listingIds: [listingId] }).catch(() => null);
        if (result?.ok) {
          setState("done");
          router.refresh();
        } else {
          setState("failed");
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        morph
        loading={pending}
        done={state === "done"}
        onClick={confirm}
        data-testid="health-confirm-available"
      >
        {label}
      </Button>
      <p className="nf-caption mt-xs min-h-[1lh] text-[var(--nf-content-secondary)]" role="status" aria-live="polite">
        {state === "done" ? done : state === "failed" ? failed : ""}
      </p>
    </div>
  );
}
