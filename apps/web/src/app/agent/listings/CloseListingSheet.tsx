"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { closeListingWithReason, type CloseReason } from "@/lib/landlord/close-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type CloseCopy = Dictionary["landlord"]["close"];

const REASONS: CloseReason[] = ["let_through_vallo", "let_elsewhere", "owner_withdrew", "mandate_ended"];

/**
 * V-48. "LET" IS AN EVENT: A RENTAL IS CLOSED WITH HOW IT ENDED.
 *
 * Four reasons, one tap each, then one confirm. The reason is a radio group of
 * full-width 48px rows rather than a dropdown, because on a phone a dropdown
 * hides three of the four answers and this question is the whole point of the
 * sheet. "Let through Vallo" is refused by the database unless a rent charge
 * on this listing was actually paid, and the refusal is said here in words
 * with the reason to choose instead.
 *
 * A let takes down every listing of the same property, which the sheet says
 * before the tap rather than after.
 */
export function CloseListingSheet({
  listingId,
  title,
  copy,
  onClose,
}: {
  listingId: string;
  title: string;
  copy: CloseCopy;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<CloseReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useSafeTransition();

  function run() {
    if (!reason) {
      setError(copy.choose);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await closeListingWithReason({ listingId, reason });
      if (!result.ok) {
        setError(result.fieldErrors?.reason === "no-rent" ? copy.noRent : copy.failed);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.title}
      footer={
        <div className="flex flex-wrap gap-md">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {copy.keep}
          </Button>
          <Button variant="dangerQuiet" className="flex-1" onClick={run} loading={pending} data-testid="close-listing-confirm">
            {copy.confirm}
          </Button>
        </div>
      }
    >
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">{copy.body}</p>
      <p className="mt-sm truncate text-[length:var(--nf-text-caption)] font-semibold">{title}</p>
      <fieldset className="mt-sm grid gap-xs">
        <legend className="sr-only">{copy.title}</legend>
        {REASONS.map((value) => (
          <label
            key={value}
            data-on={reason === value || undefined}
            className="flex min-h-[48px] cursor-pointer items-center gap-sm rounded-[var(--nf-radius-control)] border border-[var(--nf-border-subtle)] px-md text-[length:var(--nf-text-body-sm)] data-[on]:border-[var(--nf-brand-secondary)]"
          >
            <input
              type="radio"
              name="close-reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              data-testid={`close-reason-${value}`}
            />
            {copy.reasons[value]}
          </label>
        ))}
      </fieldset>
      {error && (
        <p
          role="alert"
          className="mt-sm rounded-[var(--nf-container-radius)] p-sm text-[length:var(--nf-text-caption)] font-semibold"
          style={{ background: "var(--nf-state-warning-surface)", color: "var(--nf-state-warning)" }}
        >
          {error}
        </p>
      )}
    </Sheet>
  );
}
