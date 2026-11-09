"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useDoneFlash } from "@/lib/ui/use-done-flash";
import type { ActionResult } from "@/lib/actions/envelope";
import { useActionBanner } from "@/components/ui/use-action-banner";

/**
 * SCUML item 19: one button that a SECOND member of staff presses. The
 * database refuses the proposer anyway; the lane hides the button from them
 * and shows `ownLine` instead. Staff only.
 */
export function ApproveForm({
  action,
  fieldName,
  value,
  label,
  doneLabel,
  own,
  ownLine,
}: {
  action: (prev: ActionResult<null> | null, formData: FormData) => Promise<ActionResult<null>>;
  fieldName: string;
  value: string;
  label: string;
  doneLabel: string;
  own: boolean;
  ownLine: string;
}) {
  const [state, run, pending] = useActionState<ActionResult<null> | null, FormData>(action, null);
  /* Saved or refused, said by the one banner at the top of the screen (founder, 7 November 2026). */
  useActionBanner(state, { ok: doneLabel });
  /* The tick is held for a beat only once the server has said yes. */
  const [done, flash] = useDoneFlash();
  const accepted = state?.ok === true;
  useEffect(() => {
    if (accepted) flash();
  }, [accepted, flash]);
  if (own) return <p className="nf-caption text-[var(--nf-content-muted)]">{ownLine}</p>;
  return (
    <form action={run} className="flex flex-wrap items-center gap-xs">
      <input type="hidden" name={fieldName} value={value} />
      <Button type="submit" variant="primary" morph loading={pending} done={done} disabled={accepted}>
        {label}
      </Button>
    </form>
  );
}
