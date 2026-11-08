"use client";

import { useActionState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/lib/actions/envelope";
import { reopenEddReview } from "@/lib/compliance/edd-actions";
import { useActionBanner } from "@/components/ui/use-action-banner";

/** SCUML item 15: reopen a cleared person's EDD review; the gates shut until it is cleared again. Staff only. */
export function ReopenEddButton({ userId, copy }: { userId: string; copy: Dictionary["complianceRisk"]["lane"] }) {
  const [state, run, pending] = useActionState<ActionResult<null> | null, FormData>(reopenEddReview, null);
  /* Saved or refused, said by the one banner at the top of the screen (founder, 7 November 2026). */
  useActionBanner(state, { ok: copy.reopened });
  return (
    <form action={run} className="flex flex-wrap items-center gap-xs">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="secondary" loading={pending} disabled={state?.ok === true}>
        {copy.reopen}
      </Button>
    </form>
  );
}
