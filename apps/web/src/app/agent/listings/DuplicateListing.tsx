"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { duplicateListing } from "@/lib/agent/duplicate-actions";
import { MAX_COPIES } from "@/lib/agent/duplicate";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * V-29: "List another like this", on a row of the lister's own listings. A
 * sheet asks how many units (one to twenty, for a block of identical flats),
 * makes that many drafts, and links to the first so the lister can change
 * what differs. Every state is drawn: asking, making, made, failed.
 */
export function DuplicateListing({
  listingId,
  copy,
}: {
  listingId: string;
  copy: Dictionary["frontDoor"]["duplicate"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [made, setMade] = useState<string[] | null>(null);
  const [asked, setAsked] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        leadingIcon="document"
        onClick={() => {
          setOpen(true);
          setMade(null);
          setError(null);
        }}
        data-testid="listing-duplicate"
      >
        {copy.action}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={copy.title} detents={[0.55]}>
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.body}</p>
        {made ? (
          <div className="mt-group flex flex-col gap-row" data-testid="duplicate-made">
            <p className="nf-body-sm text-[var(--nf-content-primary)]">
              {made.length < asked
                ? copy.madePartial.replace("{made}", String(made.length)).replace("{asked}", String(asked))
                : made.length === 1
                  ? copy.madeOne
                  : copy.made.replace("{count}", String(made.length))}
            </p>
            <ButtonLink href={`/agent/list?id=${made[0]}`} variant="primary" full>
              {copy.open}
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-group flex flex-col gap-row">
            <label className="block">
              <span className="nf-label">{copy.copies}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_COPIES}
                className="nf-field"
                value={count}
                onChange={(e) => setCount(Math.min(MAX_COPIES, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
            <Button
              variant="primary"
              full
              loading={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const result = await duplicateListing({ listingId, copies: count });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setMade(result.data.ids);
                  setAsked(result.data.asked);
                  router.refresh();
                });
              }}
            >
              {pending ? copy.making : copy.make}
            </Button>
            <Button variant="ghost" full onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
            {error && (
              <p className="nf-body-sm font-semibold text-[var(--nf-state-error)]" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
