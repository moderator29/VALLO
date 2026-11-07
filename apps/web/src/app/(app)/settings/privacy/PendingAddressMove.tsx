"use client";

import { Button } from "@/components/ui/Button";
import { useActionState, useEffect } from "react";
import { banner } from "@/lib/ui/toast";
import type { AddressMoveCopy } from "@/components/app/account/settings-copy";
import { ownerCancelEmailRecovery } from "@/lib/admin/email-recovery-actions";
import type { PendingMove } from "@/lib/auth/pending-address-move";

/**
 * SEC-15: the owner's view of a request by support to move their account to
 * another address. Shown only while it is cooling off; the database refuses
 * a cancel on any request that is not theirs or not cooling off.
 */
export function PendingAddressMove({
  t,
  move,
}: {
  t: AddressMoveCopy;
  move: PendingMove;
}) {
  const [state, action, pending] = useActionState(
    ownerCancelEmailRecovery,
    null
  );
  const copy = t.settings.addressMove;
  /* The outcome goes to the one banner (Grade 1). Cancelled, the warning
     itself leaves: there is no longer a move to warn about. */
  useEffect(() => {
    if (!state) return;
    if (state.ok) banner.success(copy.cancelled);
    else banner.error(state.error);
  }, [state, copy.cancelled]);
  if (state?.ok) return null;
  return (
    <form
      action={action}
      className="nf-panel nf-panel--card grid gap-sm p-card"
      role="alert"
    >
      <h2 className="font-semibold">{copy.title}</h2>
      <p className="text-[length:var(--nf-text-body-sm)]">
        {copy.body
          .replace("{address}", move.newAddressMasked)
          .replace("{when}", move.earliest ?? copy.afterNotice)}
      </p>
      <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
        {copy.ifYou}
      </p>
      <input type="hidden" name="requestId" value={move.id} />
      <Button type="submit" variant="primary" disabled={pending}>
        {copy.cancel}
      </Button>
    </form>
  );
}
