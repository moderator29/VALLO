"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { destroyExpiredMoneyRecords } from "@/lib/admin/desk-reads/retention-actions";
import { confirmationMatches } from "@/lib/admin/desk-reads/retention";
import { fill } from "../_components/copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

type DestroyCopy = {
  destroyBody: string;
  confirmLabel: string;
  confirmHint: string;
  confirmButton: string;
  confirmPhrase: string;
  bankLabel: string;
  payoutLabel: string;
  walletLabel: string;
  done: string;
  nothingToDo: string;
};

/**
 * THE TYPED CONFIRMATION. Nothing is destroyed by a click alone: the button
 * stays shut until the phrase is typed exactly, and the count it sends back
 * is the count the person was shown, so a list that changed in between
 * destroys nothing (the database refuses on the mismatch).
 */
export function DestroyRecords({
  expected,
  totals,
  copy,
  cancel,
}: {
  expected: number;
  totals: { bank: number; payout: number; wallet: number };
  copy: DestroyCopy;
  cancel: string;
}) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  function run() {
    setConfirmError(null);
    start(async () => {
      try {
        const result = await destroyExpiredMoneyRecords({ confirm: typed, expected });
        if (!result.ok) {
          /* A word about the typed phrase stays under the field; anything
             else is the outcome, and the banner says it. */
          const about = result.fieldErrors?.["confirm"];
          if (about) setConfirmError(about);
          else banner.error(result.error, { retry: run });
          return;
        }
        setOpen(false);
        setTyped("");
        banner.success("redacted" in result.data ? fill(copy.done, { count: result.data.redacted }) : copy.nothingToDo);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <div>
      <p className="nf-body-sm max-w-[68ch] text-content-2">{copy.destroyBody}</p>
      <dl className="mt-row flex flex-wrap gap-x-block gap-y-xs">
        <div>
          <dt className="nf-caption">{copy.bankLabel}</dt>
          <dd className="nf-body font-semibold tabular-nums">{totals.bank}</dd>
        </div>
        <div>
          <dt className="nf-caption">{copy.payoutLabel}</dt>
          <dd className="nf-body font-semibold tabular-nums">{totals.payout}</dd>
        </div>
        <div>
          <dt className="nf-caption">{copy.walletLabel}</dt>
          <dd className="nf-body font-semibold tabular-nums">{totals.wallet}</dd>
        </div>
      </dl>

      {!open ? (
        <div className="mt-group">
          <Button
            type="button"
            variant="danger"
            onClick={() => setOpen(true)}
          >
            {fill(copy.confirmButton, { count: expected })}
          </Button>
        </div>
      ) : (
        <form
          className="mt-group rounded-[var(--nf-radius-md)] border border-[color-mix(in_oklab,var(--nf-state-error)_45%,transparent)] p-card-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (confirmationMatches(typed)) run();
          }}
        >
          <label className="nf-label block" htmlFor={`${id}-phrase`}>
            {fill(copy.confirmLabel, { phrase: copy.confirmPhrase })}
          </label>
          <input
            id={`${id}-phrase`}
            className="nf-field mt-xs font-mono"
            value={typed}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={`${id}-hint`}
            onChange={(event) => setTyped(event.target.value)}
          />
          <p id={`${id}-hint`} className="nf-caption mt-xs">
            {copy.confirmHint}
          </p>
          {confirmError && (
            <p role="alert" className="nf-body-sm mt-row font-semibold text-[var(--nf-state-error)]">
              {confirmError}
            </p>
          )}
          <div className="mt-row flex flex-wrap gap-inline">
            <Button type="submit" variant="danger" loading={pending} disabled={!confirmationMatches(typed)}>
              {fill(copy.confirmButton, { count: expected })}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              {cancel}
            </Button>
          </div>
        </form>
      )}

    </div>
  );
}
